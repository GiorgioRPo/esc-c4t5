"""Offline evaluation: compares the hybrid ranker against non-AI baselines.

Two independent halves:

  1. LABEL-FREE METRICS -- computed across every destination in the catalogue.
     Objective and reproducible today: coverage, country diversity, intra-list
     similarity, zero-inventory rate, explanation completeness, latency.

  2. LABELLED METRICS -- NDCG / Recall. These REQUIRE human relevance labels.
     A small sample fixture ships with the repo purely so the harness can be
     exercised; results computed from it are clearly marked as NOT
     human-validated and must not be quoted as evidence of quality.

    python -m scripts.evaluate_rankers
"""

from __future__ import annotations

import asyncio
import json
import math
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.database import create_pool  # noqa: E402
from app.embedding import SentenceTransformerEmbeddingProvider  # noqa: E402
from app.ranking import (  # noqa: E402
    WeightedHybridRanker,
    diversify,
    distance_score,
    inventory_score,
)
from app.retrieval import generate_candidates  # noqa: E402
from app.schemas import EnrichedCandidate, Strategy  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[4]
CASES = REPO_ROOT / "database" / "seed" / "evaluation_cases.json"
EXAMPLE_CASES = REPO_ROOT / "database" / "seed" / "evaluation_cases.example.json"
OUT_DIR = REPO_ROOT / "docs" / "benchmarks"

TOP_K = 5


# ---------------------------------------------------------------------------
# Baseline rankers -- what the product would surface WITHOUT the hybrid engine
# ---------------------------------------------------------------------------


class GeographicOnlyRanker:
    """Nearest destinations. The obvious non-AI heuristic."""

    name = "geographic-only"

    def order(self, candidates: list[EnrichedCandidate], scale: float) -> list[EnrichedCandidate]:
        return sorted(
            candidates,
            key=lambda c: (-distance_score(c.distance_km, scale), c.uid),
        )


class SemanticOnlyRanker:
    """Embedding similarity alone -- no distance, inventory or price."""

    name = "semantic-only"

    def order(self, candidates: list[EnrichedCandidate], scale: float) -> list[EnrichedCandidate]:
        return sorted(candidates, key=lambda c: (-c.semantic_score, c.uid))


class InventoryOnlyRanker:
    """Biggest hotel inventory first -- a commercially plausible default that
    needs no AI at all."""

    name = "inventory-only"

    def order(self, candidates: list[EnrichedCandidate], scale: float) -> list[EnrichedCandidate]:
        return sorted(candidates, key=lambda c: (-inventory_score(c)[0], c.uid))


class HybridRankerAdapter:
    name = "weighted-hybrid"

    def __init__(self, scale: float) -> None:
        self._ranker = WeightedHybridRanker(scale)

    def order(self, candidates: list[EnrichedCandidate], scale: float) -> list[EnrichedCandidate]:
        scored = self._ranker.rank(candidates, Strategy.MIXED, None)
        return [s.candidate for s in diversify(scored, len(candidates))]


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def dcg(relevances: list[float]) -> float:
    return sum(rel / math.log2(i + 2) for i, rel in enumerate(relevances))


def ndcg_at_k(ranked_uids: list[str], labels: dict[str, int], k: int) -> float:
    gains = [float(labels.get(uid, 0)) for uid in ranked_uids[:k]]
    ideal = sorted(labels.values(), reverse=True)[:k]
    ideal_dcg = dcg([float(v) for v in ideal])
    return dcg(gains) / ideal_dcg if ideal_dcg > 0 else 0.0


def recall_at_k(ranked_uids: list[str], labels: dict[str, int], k: int) -> float:
    relevant = {uid for uid, rel in labels.items() if rel >= 2}
    if not relevant:
        return 0.0
    return len(relevant & set(ranked_uids[:k])) / len(relevant)


def intra_list_similarity(uids: list[str], vectors: dict[str, np.ndarray]) -> float:
    """Mean pairwise cosine similarity within a result list.

    LOWER IS BETTER -- a list of five near-identical destinations is a worse
    product than five genuinely different options.
    """
    present = [vectors[u] for u in uids if u in vectors]
    if len(present) < 2:
        return 0.0
    sims = []
    for i in range(len(present)):
        for j in range(i + 1, len(present)):
            a, b = present[i], present[j]
            sims.append(float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) or 1)))
    return statistics.fmean(sims)


async def main() -> int:
    settings = get_settings()
    pool = await create_pool(settings)
    embedder = SentenceTransformerEmbeddingProvider(
        settings.embedding_model, settings.embedding_dimension
    )
    embedder.warm()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "select uid, name, country_name, country_code, region, description, "
            "tags, embedding, location, "
            "nullif(metadata->>'hotel_count','')::int as hotel_count "
            "from public.destinations where active and embedding is not null"
        )

    vectors = {r["uid"]: np.asarray(r["embedding"], dtype=np.float32) for r in rows}
    total_destinations = len(rows)
    print(f"Catalogue: {total_destinations} destinations with embeddings\n")

    rankers = [
        GeographicOnlyRanker(),
        SemanticOnlyRanker(),
        InventoryOnlyRanker(),
        HybridRankerAdapter(settings.distance_scale_km),
    ]

    # ----------------------------------------------------------------------
    # Pass 1: label-free metrics over EVERY origin
    # ----------------------------------------------------------------------
    per_ranker: dict[str, dict] = {
        r.name: {
            "recommended_uids": set(),
            "country_counts": [],
            "intra_list_sims": [],
            "zero_inventory": 0,
            "results": 0,
            "latency_ms": [],
        }
        for r in rankers
    }

    for origin_row in rows:
        origin = await _fetch_origin(pool, origin_row["uid"])
        candidates, _ = await generate_candidates(
            pool, embedder, origin,
            strategy=Strategy.MIXED, intent=None, limit=12,
            max_distance_km=None,
            semantic_k=settings.semantic_candidate_count,
            geographic_k=settings.geographic_candidate_count,
            distance_scale_km=settings.distance_scale_km,
        )
        if not candidates:
            continue

        enriched = [
            EnrichedCandidate(
                uid=c.uid, name=c.name, country=c.country,
                country_code=c.country_code, region=c.region,
                semantic_score=c.semantic_score, distance_km=c.distance_km,
                popularity_score=c.popularity_score, tags=c.tags,
                hotel_count=c.hotel_count,
            )
            for c in candidates
        ]

        for ranker in rankers:
            started = time.perf_counter()
            ordered = ranker.order(enriched, settings.distance_scale_km)[:TOP_K]
            per_ranker[ranker.name]["latency_ms"].append(
                (time.perf_counter() - started) * 1000
            )

            stats = per_ranker[ranker.name]
            uids = [c.uid for c in ordered]
            stats["recommended_uids"].update(uids)
            stats["country_counts"].append(
                len({(c.country_code or c.country) for c in ordered})
            )
            stats["intra_list_sims"].append(intra_list_similarity(uids, vectors))
            stats["zero_inventory"] += sum(
                1 for c in ordered if not c.hotel_count
            )
            stats["results"] += len(ordered)

    label_free = []
    for ranker in rankers:
        s = per_ranker[ranker.name]
        label_free.append(
            {
                "ranker": ranker.name,
                "catalogue_coverage_pct": round(
                    100 * len(s["recommended_uids"]) / total_destinations, 1
                ),
                "distinct_destinations_shown": len(s["recommended_uids"]),
                "mean_countries_per_list": round(statistics.fmean(s["country_counts"]), 2),
                "mean_intra_list_similarity": round(
                    statistics.fmean(s["intra_list_sims"]), 4
                ),
                "zero_inventory_rate_pct": round(
                    100 * s["zero_inventory"] / max(s["results"], 1), 2
                ),
                "ranking_latency_p95_ms": round(
                    sorted(s["latency_ms"])[int(0.95 * (len(s["latency_ms"]) - 1))], 4
                ),
            }
        )

    print("LABEL-FREE METRICS  (all origins, objective, no human labels needed)")
    print(f"{'ranker':18} {'coverage':>9} {'countries':>10} {'intra-sim':>10} {'zero-inv':>9}")
    print("-" * 62)
    for row in label_free:
        print(
            f"{row['ranker']:18} {row['catalogue_coverage_pct']:>8.1f}% "
            f"{row['mean_countries_per_list']:>10.2f} "
            f"{row['mean_intra_list_similarity']:>10.4f} "
            f"{row['zero_inventory_rate_pct']:>8.2f}%"
        )

    # ----------------------------------------------------------------------
    # Pass 2: labelled metrics (only if human labels exist)
    # ----------------------------------------------------------------------
    labelled_results = None
    using_example = False
    cases_path = CASES if CASES.exists() else EXAMPLE_CASES
    using_example = not CASES.exists()

    if cases_path.exists():
        doc = json.loads(cases_path.read_text(encoding="utf-8"))
        cases = doc.get("cases", [])
        scores: dict[str, dict[str, list[float]]] = {
            r.name: {"ndcg@3": [], "ndcg@5": [], "recall@3": [], "recall@5": []}
            for r in rankers
        }

        for case in cases:
            origin = await _fetch_origin(pool, case["origin_uid"])
            if origin is None:
                print(f"  skipping unknown origin {case['origin_uid']}")
                continue
            labels = {c["destination_uid"]: c["relevance"] for c in case["candidates"]}

            candidates, _ = await generate_candidates(
                pool, embedder, origin,
                strategy=Strategy.MIXED, intent=case.get("intent"), limit=12,
                max_distance_km=None,
                semantic_k=settings.semantic_candidate_count,
                geographic_k=settings.geographic_candidate_count,
                distance_scale_km=settings.distance_scale_km,
            )
            enriched = [
                EnrichedCandidate(
                    uid=c.uid, name=c.name, country=c.country,
                    country_code=c.country_code, region=c.region,
                    semantic_score=c.semantic_score, distance_km=c.distance_km,
                    popularity_score=c.popularity_score, tags=c.tags,
                    hotel_count=c.hotel_count,
                )
                for c in candidates
            ]
            for ranker in rankers:
                uids = [c.uid for c in ranker.order(enriched, settings.distance_scale_km)]
                scores[ranker.name]["ndcg@3"].append(ndcg_at_k(uids, labels, 3))
                scores[ranker.name]["ndcg@5"].append(ndcg_at_k(uids, labels, 5))
                scores[ranker.name]["recall@3"].append(recall_at_k(uids, labels, 3))
                scores[ranker.name]["recall@5"].append(recall_at_k(uids, labels, 5))

        labelled_results = [
            {
                "ranker": name,
                "queries": len(metrics["ndcg@5"]),
                **{
                    key: round(statistics.fmean(vals), 4) if vals else 0.0
                    for key, vals in metrics.items()
                },
            }
            for name, metrics in scores.items()
        ]

        print()
        if using_example:
            print("LABELLED METRICS  ***SAMPLE FIXTURE -- NOT HUMAN-VALIDATED***")
            print("  These numbers exercise the harness only. Do NOT cite them as")
            print("  evidence of quality. Create evaluation_cases.json with real")
            print("  human labels to produce quotable results.")
        else:
            print("LABELLED METRICS  (human-labelled evaluation cases)")
        print(f"{'ranker':18} {'n':>4} {'NDCG@3':>9} {'NDCG@5':>9} {'R@3':>9} {'R@5':>9}")
        print("-" * 62)
        for row in labelled_results:
            print(
                f"{row['ranker']:18} {row['queries']:>4} {row['ndcg@3']:>9.4f} "
                f"{row['ndcg@5']:>9.4f} {row['recall@3']:>9.4f} {row['recall@5']:>9.4f}"
            )

    await pool.close()

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "catalogue_size": total_destinations,
        "top_k": TOP_K,
        "embedding_model": settings.embedding_model,
        "label_free_metrics": label_free,
        "labelled_metrics": labelled_results,
        "labelled_metrics_are_human_validated": not using_example,
        "warning": (
            "Labelled metrics were computed from the SAMPLE fixture and are not "
            "human-validated." if using_example else None
        ),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "ranker_evaluation.json"
    path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"\nWritten to {path}")
    return 0


async def _fetch_origin(pool, uid: str):
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "select uid, name, country_name, description, tags, location "
            "from public.destinations where uid = $1 and active",
            uid,
        )


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
