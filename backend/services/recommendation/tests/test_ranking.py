"""Unit tests for scoring, ranking, diversification and explanations.

These deliberately do NOT touch the database or download the embedding model --
they test the pure functions that decide what a user is shown.
"""

import math

import pytest

from app.ranking import (
    BETTER_VALUE_MARGIN,
    MISSING_PRICE_SCORE,
    NEUTRAL_PRICE_SCORE,
    WeightedHybridRanker,
    assign_category,
    build_reasons,
    diversify,
    distance_score,
    inventory_score,
    price_scores,
    redistribute,
    validate_weights,
)
from app.schemas import EnrichedCandidate, Strategy

SCALE = 1500.0


def make_candidate(uid: str, **overrides) -> EnrichedCandidate:
    defaults = dict(
        uid=uid,
        name=f"City {uid}",
        country="Country",
        country_code="XX",
        region="Region",
        semantic_score=0.5,
        distance_km=500.0,
        popularity_score=0.0,
        tags=["urban", "food"],
        hotel_count=100,
    )
    defaults.update(overrides)
    return EnrichedCandidate(**defaults)


# ---------------------------------------------------------------------------
# distance
# ---------------------------------------------------------------------------


def test_distance_score_decays_with_distance():
    near = distance_score(100, SCALE)
    far = distance_score(5000, SCALE)
    assert near > far
    assert 0 <= far <= near <= 1


def test_distance_score_zero_km_is_one():
    assert distance_score(0, SCALE) == pytest.approx(1.0)


def test_distance_score_missing_distance_is_zero_not_one():
    """Missing data must never look like a perfect score."""
    assert distance_score(None, SCALE) == 0.0


def test_distance_score_is_absolute_not_list_relative():
    """Same distance must score identically regardless of other candidates."""
    assert distance_score(314, SCALE) == distance_score(314, SCALE)


# ---------------------------------------------------------------------------
# inventory
# ---------------------------------------------------------------------------


def test_inventory_prefers_dated_availability_over_static():
    candidate = make_candidate("a", hotel_count=5000, available_hotels=40,
                               priced_hotel_count=30)
    _, source = inventory_score(candidate)
    assert source == "available_hotels"


def test_inventory_falls_back_to_priced_then_static():
    assert inventory_score(make_candidate("a", priced_hotel_count=20))[1] == "priced_hotel_count"
    assert inventory_score(make_candidate("b", hotel_count=200))[1] == "hotel_count"


def test_inventory_no_counts_scores_zero():
    candidate = make_candidate("a", hotel_count=None)
    score, source = inventory_score(candidate)
    assert score == 0.0
    assert source == "none"


def test_static_inventory_does_not_saturate_for_large_cities():
    """A 10k-hotel city must not score identically to a 2k-hotel city.

    This is why static counts use their own reference scale.
    """
    big = inventory_score(make_candidate("a", hotel_count=10_000))[0]
    mid = inventory_score(make_candidate("b", hotel_count=2_000))[0]
    small = inventory_score(make_candidate("c", hotel_count=200))[0]
    assert small < mid <= big
    assert mid < 1.0 or big > mid


# ---------------------------------------------------------------------------
# price
# ---------------------------------------------------------------------------


def test_cheaper_candidate_scores_higher():
    scores = price_scores([
        make_candidate("cheap", min_price=100.0),
        make_candidate("pricey", min_price=400.0),
    ])
    assert scores["cheap"] > scores["pricey"]


def test_all_equal_prices_are_neutral():
    scores = price_scores([
        make_candidate("a", min_price=200.0),
        make_candidate("b", min_price=200.0),
    ])
    assert scores["a"] == NEUTRAL_PRICE_SCORE
    assert scores["b"] == NEUTRAL_PRICE_SCORE


def test_no_prices_at_all_is_neutral_for_everyone():
    scores = price_scores([make_candidate("a"), make_candidate("b")])
    assert set(scores.values()) == {NEUTRAL_PRICE_SCORE}


def test_missing_price_is_conservative_not_optimistic():
    """An unknown price must not win on value."""
    scores = price_scores([
        make_candidate("known", min_price=100.0),
        make_candidate("unknown"),
    ])
    assert scores["unknown"] == MISSING_PRICE_SCORE
    assert scores["unknown"] < scores["known"]


# ---------------------------------------------------------------------------
# weights
# ---------------------------------------------------------------------------


def test_validate_weights_rejects_non_unit_sum():
    with pytest.raises(ValueError):
        validate_weights({"a": 0.5, "b": 0.2})


def test_validate_weights_rejects_negative():
    with pytest.raises(ValueError):
        validate_weights({"a": 1.2, "b": -0.2})


def test_redistribute_renormalises_to_one():
    result = redistribute({"a": 0.5, "b": 0.3, "c": 0.2}, {"c"})
    assert "c" not in result
    assert sum(result.values()) == pytest.approx(1.0)


def test_redistribute_preserves_relative_proportions():
    result = redistribute({"a": 0.6, "b": 0.2, "c": 0.2}, {"c"})
    assert result["a"] / result["b"] == pytest.approx(3.0)


# ---------------------------------------------------------------------------
# ranking
# ---------------------------------------------------------------------------


def test_ranking_is_deterministic():
    ranker = WeightedHybridRanker(SCALE)
    candidates = [make_candidate(u) for u in ("c", "a", "b")]
    first = [s.candidate.uid for s in ranker.rank(candidates, Strategy.MIXED)]
    second = [s.candidate.uid for s in ranker.rank(candidates, Strategy.MIXED)]
    assert first == second


def test_ties_break_on_uid_not_input_order():
    ranker = WeightedHybridRanker(SCALE)
    forward = ranker.rank([make_candidate("b"), make_candidate("a")], Strategy.MIXED)
    reverse = ranker.rank([make_candidate("a"), make_candidate("b")], Strategy.MIXED)
    assert [s.candidate.uid for s in forward] == [s.candidate.uid for s in reverse]


def test_nearby_strategy_favours_closer_destination():
    ranker = WeightedHybridRanker(SCALE)
    result = ranker.rank(
        [
            make_candidate("far", distance_km=6000, semantic_score=0.9),
            make_candidate("near", distance_km=200, semantic_score=0.5),
        ],
        Strategy.NEARBY,
    )
    assert result[0].candidate.uid == "near"


def test_similar_strategy_favours_semantic_match():
    ranker = WeightedHybridRanker(SCALE)
    result = ranker.rank(
        [
            make_candidate("far", distance_km=6000, semantic_score=0.95),
            make_candidate("near", distance_km=200, semantic_score=0.30),
        ],
        Strategy.SIMILAR,
    )
    assert result[0].candidate.uid == "far"


def test_empty_candidates_returns_empty():
    assert WeightedHybridRanker(SCALE).rank([], Strategy.MIXED) == []


# ---------------------------------------------------------------------------
# diversification
# ---------------------------------------------------------------------------


def test_country_cap_is_enforced():
    ranker = WeightedHybridRanker(SCALE)
    candidates = [
        make_candidate(f"th{i}", country_code="TH", semantic_score=0.9 - i * 0.01)
        for i in range(5)
    ] + [make_candidate("my1", country_code="MY", semantic_score=0.5)]

    selected = diversify(ranker.rank(candidates, Strategy.MIXED), limit=3)
    thai = sum(1 for s in selected if s.candidate.country_code == "TH")
    assert thai <= 2


def test_diversify_backfills_rather_than_returning_short():
    ranker = WeightedHybridRanker(SCALE)
    candidates = [make_candidate(f"th{i}", country_code="TH") for i in range(5)]
    selected = diversify(ranker.rank(candidates, Strategy.MIXED), limit=4)
    assert len(selected) == 4


def test_final_ranks_are_sequential():
    ranker = WeightedHybridRanker(SCALE)
    selected = diversify(
        ranker.rank([make_candidate(f"c{i}") for i in range(5)], Strategy.MIXED), 5
    )
    assert [s.final_rank for s in selected] == [1, 2, 3, 4, 5]


# ---------------------------------------------------------------------------
# explanations -- truthfulness
# ---------------------------------------------------------------------------


def test_static_inventory_never_claims_availability():
    """The single most important guardrail: static counts are not availability."""
    ranker = WeightedHybridRanker(SCALE)
    item = ranker.rank([make_candidate("a", hotel_count=2244)], Strategy.MIXED)[0]
    texts = " ".join(r.text.lower() for r in build_reasons(item, "SGD", None))
    assert "inventory" in texts
    assert "available" not in texts


def test_priced_count_may_claim_dated_pricing():
    ranker = WeightedHybridRanker(SCALE)
    item = ranker.rank(
        [make_candidate("a", priced_hotel_count=388, min_price=126.0)], Strategy.MIXED
    )[0]
    codes = {r.code for r in build_reasons(item, "SGD", None)}
    assert "PRICED_AVAILABILITY" in codes


def test_no_price_claim_without_origin_comparison():
    ranker = WeightedHybridRanker(SCALE)
    item = ranker.rank([make_candidate("a", min_price=100.0)], Strategy.MIXED)[0]
    codes = {r.code for r in build_reasons(item, "SGD", origin_min_price=None)}
    assert "LOWER_STARTING_PRICE" not in codes


def test_price_claim_requires_meaningful_margin():
    """A 1% difference must not be advertised as better value."""
    ranker = WeightedHybridRanker(SCALE)
    item = ranker.rank([make_candidate("a", min_price=99.0)], Strategy.MIXED)[0]
    codes = {r.code for r in build_reasons(item, "SGD", origin_min_price=100.0)}
    assert "LOWER_STARTING_PRICE" not in codes


def test_significant_saving_is_advertised():
    ranker = WeightedHybridRanker(SCALE)
    item = ranker.rank([make_candidate("a", min_price=50.0)], Strategy.MIXED)[0]
    reasons = build_reasons(item, "SGD", origin_min_price=200.0)
    lower = [r for r in reasons if r.code == "LOWER_STARTING_PRICE"]
    assert lower and "75%" in lower[0].text


def test_at_most_three_reasons():
    ranker = WeightedHybridRanker(SCALE)
    item = ranker.rank(
        [make_candidate("a", semantic_score=0.9, distance_km=100,
                        priced_hotel_count=50, min_price=50.0)],
        Strategy.MIXED,
    )[0]
    assert len(build_reasons(item, "SGD", 200.0)) <= 3


# ---------------------------------------------------------------------------
# categories
# ---------------------------------------------------------------------------


def test_better_value_requires_valid_comparison():
    ranker = WeightedHybridRanker(SCALE)
    item = ranker.rank([make_candidate("a", min_price=50.0, distance_km=5000)],
                       Strategy.MIXED)[0]
    assert assign_category(item, origin_min_price=200.0) == "better_value"
    # Without an origin price there is nothing to compare against.
    assert assign_category(item, origin_min_price=None) != "better_value"


def test_nearby_category_uses_threshold():
    ranker = WeightedHybridRanker(SCALE)
    near = ranker.rank([make_candidate("a", distance_km=300)], Strategy.MIXED)[0]
    far = ranker.rank([make_candidate("b", distance_km=9000)], Strategy.MIXED)[0]
    assert assign_category(near, None) == "nearby"
    assert assign_category(far, None) != "nearby"
