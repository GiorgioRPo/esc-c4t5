"""Latency and throughput benchmark for the recommendation service.

Measures the REAL system. Nothing here is simulated or extrapolated.

    python -m scripts.benchmark
    python -m scripts.benchmark --concurrency 1 2 4 8 --iterations 20

Outputs console tables plus docs/benchmarks/latency.json for the report.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
import numpy as np
from pgvector.asyncpg import register_vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.database import create_pool  # noqa: E402
from app.embedding import SentenceTransformerEmbeddingProvider  # noqa: E402
from app.ranking import WeightedHybridRanker, diversify  # noqa: E402
from app.retrieval import generate_candidates  # noqa: E402
from app.schemas import EnrichedCandidate, Strategy  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[4]
OUT_DIR = REPO_ROOT / "docs" / "benchmarks"


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(int(round(p / 100 * (len(ordered) - 1))), len(ordered) - 1)
    return ordered[index]


def summarise(name: str, samples: list[float]) -> dict:
    return {
        "stage": name,
        "n": len(samples),
        "mean_ms": round(statistics.fmean(samples), 2) if samples else 0.0,
        "p50_ms": round(percentile(samples, 50), 2),
        "p95_ms": round(percentile(samples, 95), 2),
        "max_ms": round(max(samples), 2) if samples else 0.0,
    }


def process_rss_mb() -> float | None:
    """Resident set size, if psutil is available."""
    try:
        import psutil  # type: ignore

        return round(psutil.Process(os.getpid()).memory_info().rss / 1_048_576, 1)
    except Exception:
        return None


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=20)
    parser.add_argument("--concurrency", type=int, nargs="+", default=[1, 2, 4, 8])
    args = parser.parse_args()

    settings = get_settings()
    results: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "embedding_model": settings.embedding_model,
        "note": "Measured on the real service against the live database. "
        "No values are simulated.",
    }

    # --- Cold start ---------------------------------------------------------
    rss_before = process_rss_mb()
    load_start = time.perf_counter()
    embedder = SentenceTransformerEmbeddingProvider(
        settings.embedding_model, settings.embedding_dimension
    )
    load_ms = (time.perf_counter() - load_start) * 1000

    warm_start = time.perf_counter()
    embedder.warm()
    warm_ms = (time.perf_counter() - warm_start) * 1000
    rss_after = process_rss_mb()

    results["cold_start"] = {
        "model_load_ms": round(load_ms, 1),
        "first_inference_ms": round(warm_ms, 1),
        "rss_before_model_mb": rss_before,
        "rss_after_model_mb": rss_after,
        "model_memory_mb": (
            round(rss_after - rss_before, 1)
            if rss_before is not None and rss_after is not None
            else None
        ),
    }
    print(f"Model load:        {load_ms:8.1f} ms")
    print(f"First inference:   {warm_ms:8.1f} ms")
    if rss_after is not None:
        print(f"Process RSS:       {rss_after:8.1f} MB")

    pool = await create_pool(settings)
    ranker = WeightedHybridRanker(settings.distance_scale_km)

    async with pool.acquire() as conn:
        origins = [
            r["uid"]
            for r in await conn.fetch(
                "select uid from public.destinations "
                "where active and embedding is not null order by uid"
            )
        ]
    print(f"Origins available: {len(origins)}\n")

    # --- Per-stage latency --------------------------------------------------
    embed_ms: list[float] = []
    retrieval_ms: list[float] = []
    rank_ms: list[float] = []
    total_ms: list[float] = []

    async with pool.acquire() as conn:
        pass  # ensure pool warm

    for i in range(args.iterations):
        origin_uid = origins[i % len(origins)]
        async with pool.acquire() as conn:
            origin = await conn.fetchrow(
                "select uid, name, country_name, description, tags, location "
                "from public.destinations where uid = $1",
                origin_uid,
            )

        t0 = time.perf_counter()
        embedder.embed_query(f"Find travel destinations similar to {origin['name']}.")
        t1 = time.perf_counter()
        embed_ms.append((t1 - t0) * 1000)

        t2 = time.perf_counter()
        candidates, _ = await generate_candidates(
            pool, embedder, origin,
            strategy=Strategy.MIXED, intent=None, limit=12,
            max_distance_km=None,
            semantic_k=settings.semantic_candidate_count,
            geographic_k=settings.geographic_candidate_count,
            distance_scale_km=settings.distance_scale_km,
        )
        t3 = time.perf_counter()
        retrieval_ms.append((t3 - t2) * 1000)

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

        t4 = time.perf_counter()
        scored = ranker.rank(enriched, Strategy.MIXED, None)
        diversify(scored, 5)
        t5 = time.perf_counter()
        rank_ms.append((t5 - t4) * 1000)
        total_ms.append((t5 - t2) * 1000)

    results["stages"] = [
        summarise("embed_query", embed_ms),
        summarise("retrieval_pgvector_postgis", retrieval_ms),
        summarise("rank_and_diversify", rank_ms),
        summarise("total_excluding_ascenda", total_ms),
    ]

    print(f"{'stage':32} {'n':>4} {'mean':>9} {'p50':>9} {'p95':>9} {'max':>9}")
    print("-" * 76)
    for row in results["stages"]:
        print(
            f"{row['stage']:32} {row['n']:>4} {row['mean_ms']:>8.2f}ms "
            f"{row['p50_ms']:>8.2f}ms {row['p95_ms']:>8.2f}ms {row['max_ms']:>8.2f}ms"
        )

    # --- Throughput under concurrency --------------------------------------
    print(f"\n{'concurrency':>12} {'requests':>9} {'wall_s':>9} {'req/s':>9} {'p95_ms':>9}")
    print("-" * 54)
    throughput = []

    async def one_request(uid: str) -> float:
        start = time.perf_counter()
        async with pool.acquire() as conn:
            origin = await conn.fetchrow(
                "select uid, name, country_name, description, tags, location "
                "from public.destinations where uid = $1",
                uid,
            )
        candidates, _ = await generate_candidates(
            pool, embedder, origin,
            strategy=Strategy.MIXED, intent=None, limit=12,
            max_distance_km=None,
            semantic_k=settings.semantic_candidate_count,
            geographic_k=settings.geographic_candidate_count,
            distance_scale_km=settings.distance_scale_km,
        )
        enriched = [
            EnrichedCandidate(
                uid=c.uid, name=c.name, country=c.country,
                semantic_score=c.semantic_score, distance_km=c.distance_km,
                popularity_score=c.popularity_score, tags=c.tags,
                hotel_count=c.hotel_count,
            )
            for c in candidates
        ]
        diversify(ranker.rank(enriched, Strategy.MIXED, None), 5)
        return (time.perf_counter() - start) * 1000

    for concurrency in args.concurrency:
        total_requests = concurrency * 5
        uids = [origins[i % len(origins)] for i in range(total_requests)]
        started = time.perf_counter()

        latencies: list[float] = []
        semaphore = asyncio.Semaphore(concurrency)

        async def guarded(uid: str) -> None:
            async with semaphore:
                latencies.append(await one_request(uid))

        await asyncio.gather(*(guarded(u) for u in uids))
        wall = time.perf_counter() - started

        row = {
            "concurrency": concurrency,
            "requests": total_requests,
            "wall_seconds": round(wall, 3),
            "requests_per_second": round(total_requests / wall, 1),
            "p95_ms": round(percentile(latencies, 95), 2),
        }
        throughput.append(row)
        print(
            f"{row['concurrency']:>12} {row['requests']:>9} {row['wall_seconds']:>8.3f}s "
            f"{row['requests_per_second']:>8.1f} {row['p95_ms']:>8.2f}ms"
        )

    results["throughput"] = throughput

    await pool.close()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "latency.json"
    out.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(f"\nWritten to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
