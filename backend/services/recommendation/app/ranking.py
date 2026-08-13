"""Scoring, ranking, diversification and deterministic explanations.

This module is the single source of truth for every feature formula. Event
logging, offline evaluation and any future learning-to-rank model must import
from here rather than re-deriving the maths, or the training features will not
match what actually produced the recommendation.

RANKING IS HEURISTIC, NOT TRAINED. Do not describe it as a learned model.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.schemas import EnrichedCandidate, Reason, Strategy

RANKING_VERSION = "heuristic-ranker-v1"
RETRIEVAL_VERSION = "retrieval-v1"
FEATURE_SCHEMA_VERSION = "destination-ranking-features-v1"

# ---------------------------------------------------------------------------
# Normalisation references
# ---------------------------------------------------------------------------

# Reference counts for the log-scaled inventory score. Different count types
# live on wildly different scales: a dated priced-hotel count for one search is
# tens, while Ascenda's static inventory for London is ~11,000. Using one
# reference for both would saturate every static count to 1.0 and destroy all
# discrimination between destinations.
PRICED_COUNT_REFERENCE = 50.0
AVAILABLE_COUNT_REFERENCE = 50.0
# Chosen above the largest static inventory in the catalogue (London, ~10,900)
# so the score does not saturate at 1.0 for every major city. At 2,000 the top
# ~15 destinations were indistinguishable, which a unit test caught.
STATIC_INVENTORY_REFERENCE = 12_000.0

# Price-value scores when a comparison is not possible.
NEUTRAL_PRICE_SCORE = 0.5
MISSING_PRICE_SCORE = 0.25  # conservative: unknown price should not win on value


# ---------------------------------------------------------------------------
# Individual feature scores
# ---------------------------------------------------------------------------


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def distance_score(distance_km: float | None, scale_km: float) -> float:
    """Exponential decay with distance.

    A stable function of distance alone -- deliberately NOT min-max normalised
    across the candidate list, because that would make the same pair of
    destinations score differently depending on who else happened to be
    retrieved.
    """
    if distance_km is None:
        return 0.0
    return clamp(math.exp(-distance_km / scale_km))


def inventory_score(candidate: EnrichedCandidate) -> tuple[float, str]:
    """Log-scaled inventory strength.

    Returns (score, source) where source names which count was actually used,
    strongest first. The source matters: it decides whether we are allowed to
    make dated-availability claims in the explanation.
    """
    if candidate.available_hotels is not None:
        count, reference, source = (
            candidate.available_hotels,
            AVAILABLE_COUNT_REFERENCE,
            "available_hotels",
        )
    elif candidate.priced_hotel_count is not None:
        count, reference, source = (
            candidate.priced_hotel_count,
            PRICED_COUNT_REFERENCE,
            "priced_hotel_count",
        )
    elif candidate.hotel_count is not None:
        count, reference, source = (
            candidate.hotel_count,
            STATIC_INVENTORY_REFERENCE,
            "hotel_count",
        )
    else:
        return 0.0, "none"

    if count <= 0:
        return 0.0, source

    # log1p keeps a 10,000-hotel city from dominating purely on property count.
    return clamp(math.log1p(count) / math.log1p(reference)), source


def price_scores(candidates: list[EnrichedCandidate]) -> dict[str, float]:
    """Candidate-relative price scoring: cheaper is better.

    Min-max over log1p(price) within this candidate set only. Prices are
    comparable because Hono requested every candidate with the same dates,
    party size and currency.
    """
    priced = [c for c in candidates if c.min_price is not None and c.min_price > 0]

    if not priced:
        return {c.uid: NEUTRAL_PRICE_SCORE for c in candidates}

    logs = {c.uid: math.log1p(c.min_price) for c in priced}  # type: ignore[arg-type]
    low, high = min(logs.values()), max(logs.values())

    scores: dict[str, float] = {}
    for candidate in candidates:
        if candidate.uid not in logs:
            scores[candidate.uid] = MISSING_PRICE_SCORE
        elif high == low:
            # All priced candidates cost the same -- none is better value.
            scores[candidate.uid] = NEUTRAL_PRICE_SCORE
        else:
            normalised = (logs[candidate.uid] - low) / (high - low)
            scores[candidate.uid] = clamp(1.0 - normalised)
    return scores


# ---------------------------------------------------------------------------
# Weights
# ---------------------------------------------------------------------------

RETRIEVAL_WEIGHTS: dict[Strategy, dict[str, float]] = {
    Strategy.MIXED: {"semantic": 0.60, "distance": 0.30, "popularity": 0.10},
    Strategy.SIMILAR: {"semantic": 0.80, "distance": 0.10, "popularity": 0.10},
    Strategy.NEARBY: {"semantic": 0.30, "distance": 0.60, "popularity": 0.10},
    # At retrieval time price is unknown; value ranking happens after enrichment.
    Strategy.VALUE: {"semantic": 0.70, "distance": 0.20, "popularity": 0.10},
}

RANKING_WEIGHTS: dict[Strategy, dict[str, float]] = {
    Strategy.MIXED: {
        "semantic": 0.50, "distance": 0.15, "inventory": 0.20,
        "price": 0.10, "popularity": 0.05,
    },
    Strategy.SIMILAR: {
        "semantic": 0.70, "distance": 0.05, "inventory": 0.15,
        "price": 0.05, "popularity": 0.05,
    },
    Strategy.NEARBY: {
        "semantic": 0.25, "distance": 0.45, "inventory": 0.15,
        "price": 0.10, "popularity": 0.05,
    },
    Strategy.VALUE: {
        "semantic": 0.35, "distance": 0.05, "inventory": 0.20,
        "price": 0.35, "popularity": 0.05,
    },
}


def validate_weights(weights: dict[str, float]) -> None:
    if any(w < 0 for w in weights.values()):
        raise ValueError("negative ranking weights are not supported")
    total = sum(weights.values())
    if not math.isclose(total, 1.0, abs_tol=1e-6):
        raise ValueError(f"ranking weights must sum to 1.0, got {total}")


def redistribute(weights: dict[str, float], inactive: set[str]) -> dict[str, float]:
    """Removes weights for features with no usable data and renormalises.

    Without this, an unavailable feature silently contributes zero to every
    candidate, which does not change the ordering but does shrink the effective
    score range and makes scores incomparable between requests.
    """
    active = {k: v for k, v in weights.items() if k not in inactive}
    total = sum(active.values())
    if total <= 0:
        raise ValueError("all ranking features are inactive")
    return {k: v / total for k, v in active.items()}


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------


@dataclass
class ScoredCandidate:
    candidate: EnrichedCandidate
    features: dict[str, float]
    contributions: dict[str, float]
    final_score: float
    inventory_source: str
    initial_rank: int = 0
    final_rank: int = 0
    category: str = "similar_experience"
    reasons: list[Reason] = field(default_factory=list)


class WeightedHybridRanker:
    """Transparent heuristic ranker used for cold start."""

    name = "weighted-hybrid"
    version = RANKING_VERSION

    def __init__(self, distance_scale_km: float) -> None:
        self._distance_scale_km = distance_scale_km

    def rank(
        self,
        candidates: list[EnrichedCandidate],
        strategy: Strategy,
        origin_min_price: float | None = None,
    ) -> list[ScoredCandidate]:
        if not candidates:
            return []

        weights = dict(RANKING_WEIGHTS[strategy])
        validate_weights(weights)

        prices = price_scores(candidates)

        # Deactivate features that carry no information in this request.
        inactive: set[str] = set()
        if all(c.min_price is None for c in candidates):
            inactive.add("price")
        if all(c.popularity_score == 0 for c in candidates):
            # No behavioural data collected yet -- do not spend weight on it.
            inactive.add("popularity")
        if all(c.distance_km is None for c in candidates):
            inactive.add("distance")
        if inactive:
            weights = redistribute(weights, inactive)

        scored: list[ScoredCandidate] = []
        for candidate in candidates:
            inv_score, inv_source = inventory_score(candidate)
            features = {
                "semantic": clamp(candidate.semantic_score),
                "distance": distance_score(candidate.distance_km, self._distance_scale_km),
                "inventory": inv_score,
                "price": prices[candidate.uid],
                "popularity": clamp(candidate.popularity_score),
            }
            contributions = {
                key: round(features[key] * weight, 6)
                for key, weight in weights.items()
            }
            scored.append(
                ScoredCandidate(
                    candidate=candidate,
                    features=features,
                    contributions=contributions,
                    final_score=round(sum(contributions.values()), 6),
                    inventory_source=inv_source,
                )
            )

        # Deterministic tie-break on uid so identical inputs always produce an
        # identical ordering.
        scored.sort(key=lambda s: (-s.final_score, s.candidate.uid))
        for index, item in enumerate(scored, start=1):
            item.initial_rank = index
        return scored


# ---------------------------------------------------------------------------
# Diversification
# ---------------------------------------------------------------------------

MAX_PER_COUNTRY = 2


def diversify(scored: list[ScoredCandidate], limit: int) -> list[ScoredCandidate]:
    """Greedy selection with a per-country cap.

    A pure score sort tends to return five variations of the same place. The
    cap costs a little relevance and buys a lot of useful variety.
    """
    selected: list[ScoredCandidate] = []
    per_country: dict[str, int] = {}
    deferred: list[ScoredCandidate] = []

    for item in scored:
        key = (item.candidate.country_code or item.candidate.country or "").upper()
        if per_country.get(key, 0) >= MAX_PER_COUNTRY:
            deferred.append(item)
            continue
        selected.append(item)
        per_country[key] = per_country.get(key, 0) + 1
        if len(selected) == limit:
            break

    # Backfill from deferred rather than returning fewer than requested.
    if len(selected) < limit:
        selected.extend(deferred[: limit - len(selected)])

    for index, item in enumerate(selected, start=1):
        item.final_rank = index
    return selected


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

NEARBY_DISTANCE_KM = 800.0
SIMILAR_SEMANTIC_THRESHOLD = 0.60
STRONG_INVENTORY_THRESHOLD = 0.70
BETTER_VALUE_MARGIN = 0.10  # candidate must be >=10% cheaper to claim value


def assign_category(
    item: ScoredCandidate, origin_min_price: float | None
) -> str:
    """Picks ONE display category from feature evidence.

    Order matters: the most specific, most verifiable claim wins.
    """
    candidate = item.candidate

    if (
        origin_min_price
        and candidate.min_price
        and candidate.min_price <= origin_min_price * (1 - BETTER_VALUE_MARGIN)
    ):
        return "better_value"

    if candidate.distance_km is not None and candidate.distance_km <= NEARBY_DISTANCE_KM:
        return "nearby"

    if (
        item.features["inventory"] >= STRONG_INVENTORY_THRESHOLD
        and item.inventory_source in ("available_hotels", "priced_hotel_count")
    ):
        return "strong_availability"

    if candidate.semantic_score >= SIMILAR_SEMANTIC_THRESHOLD:
        return "similar_experience"

    return "similar_experience"


# ---------------------------------------------------------------------------
# Deterministic explanations
# ---------------------------------------------------------------------------


def _format_distance(km: float) -> str:
    if km < 100:
        return f"Only {round(km)} km away"
    return f"About {round(km / 10) * 10:,} km away"


def build_reasons(
    item: ScoredCandidate,
    currency: str,
    origin_min_price: float | None,
    max_reasons: int = 3,
) -> list[Reason]:
    """Generates grounded reasons from feature evidence.

    Every reason must be traceable to retrieved data. No LLM is involved, and
    no claim is made about data we do not have -- in particular, static
    inventory is never described as dated availability.
    """
    candidate = item.candidate
    reasons: list[Reason] = []

    # 1. Experience similarity, only above the threshold.
    if candidate.semantic_score >= SIMILAR_SEMANTIC_THRESHOLD:
        shared = [t for t in candidate.tags if t in _EXPERIENCE_TAGS][:3]
        if shared:
            pretty = ", ".join(shared[:-1]) + (
                f" and {shared[-1]}" if len(shared) > 1 else shared[-1]
            ) if len(shared) > 1 else shared[0]
            reasons.append(
                Reason(
                    code="SIMILAR_EXPERIENCE",
                    text=f"Similar {pretty} experience",
                )
            )
        else:
            reasons.append(
                Reason(
                    code="SIMILAR_EXPERIENCE",
                    text="Offers a similar travel experience",
                )
            )

    # 2. Price -- only when a like-for-like comparison exists.
    if (
        origin_min_price
        and candidate.min_price
        and candidate.min_price <= origin_min_price * (1 - BETTER_VALUE_MARGIN)
    ):
        pct = round((1 - candidate.min_price / origin_min_price) * 100)
        reasons.append(
            Reason(
                code="LOWER_STARTING_PRICE",
                text=f"{pct}% lower starting price for your dates",
            )
        )
    elif candidate.min_price:
        reasons.append(
            Reason(
                code="STARTING_PRICE",
                text=f"Prices from {currency} {candidate.min_price:,.0f}",
            )
        )

    # 3. Distance.
    if candidate.distance_km is not None and candidate.distance_km <= NEARBY_DISTANCE_KM:
        reasons.append(
            Reason(code="NEARBY_DESTINATION", text=_format_distance(candidate.distance_km))
        )

    # 4. Inventory -- wording depends strictly on which count we actually have.
    if candidate.priced_hotel_count:
        reasons.append(
            Reason(
                code="PRICED_AVAILABILITY",
                text=f"{candidate.priced_hotel_count} hotels priced for your dates",
            )
        )
    elif candidate.available_hotels:
        reasons.append(
            Reason(
                code="STRONG_AVAILABILITY",
                text=f"{candidate.available_hotels} hotels available",
            )
        )
    elif candidate.hotel_count:
        # Deliberately says "in our inventory", never "available".
        reasons.append(
            Reason(
                code="INVENTORY_SIZE",
                text=f"{candidate.hotel_count:,} hotels in our inventory",
            )
        )

    return reasons[:max_reasons]


_EXPERIENCE_TAGS = {
    "food", "shopping", "nightlife", "culture", "history", "beach",
    "nature", "family", "luxury", "budget", "romantic", "islands",
    "mountain", "skiing", "diving", "wine", "desert", "urban",
}
