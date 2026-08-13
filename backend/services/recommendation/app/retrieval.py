"""Candidate generation.

Retrieval and ranking are deliberately separate concerns. Retrieval casts a
wide, cheap net using only stored data; ranking happens later, after Hono has
enriched the shortlist with live Ascenda inventory.
"""

from __future__ import annotations

import logging

import asyncpg
import numpy as np

from app import repositories
from app.embedding import EmbeddingProvider
from app.ranking import RETRIEVAL_WEIGHTS, clamp, distance_score
from app.schemas import Candidate, Strategy

logger = logging.getLogger(__name__)


def build_query_text(origin: asyncpg.Record, intent: str | None) -> str:
    """Composes the text embedded for semantic retrieval.

    Mirrors the structure of the stored destination documents so query and
    document embeddings live in comparable space, then optionally appends the
    traveller's stated intent.
    """
    parts = [
        f"Find travel destinations similar to {origin['name']}, "
        f"{origin['country_name']}."
    ]
    if origin["description"]:
        parts.append(f"Origin characteristics: {origin['description']}")
    if origin["tags"]:
        parts.append(
            "Origin experiences and attributes: " + ", ".join(sorted(origin["tags"])) + "."
        )
    if intent:
        parts.append(f"Traveller preferences: {intent}.")
    return "\n".join(parts)


def _row_to_candidate(
    row: asyncpg.Record, sources: list[str], distance_scale_km: float, weights: dict
) -> Candidate:
    semantic = clamp(float(row["semantic_score"] or 0.0))
    distance_km = float(row["distance_km"]) if row["distance_km"] is not None else None
    dist_score = distance_score(distance_km, distance_scale_km)
    popularity = clamp(float(row["popularity_score"] or 0.0))

    retrieval_score = (
        weights["semantic"] * semantic
        + weights["distance"] * dist_score
        + weights["popularity"] * popularity
    )

    return Candidate(
        uid=row["uid"],
        name=row["name"],
        country=row["country_name"],
        country_code=row["country_code"],
        region=row["region"],
        semantic_score=round(semantic, 6),
        distance_km=round(distance_km, 2) if distance_km is not None else None,
        distance_score=round(dist_score, 6),
        popularity_score=round(popularity, 6),
        retrieval_score=round(retrieval_score, 6),
        retrieval_sources=sources,
        hotel_count=row["hotel_count"],
        tags=list(row["tags"] or []),
    )


async def generate_candidates(
    pool: asyncpg.Pool,
    embedder: EmbeddingProvider,
    origin: asyncpg.Record,
    *,
    strategy: Strategy,
    intent: str | None,
    limit: int,
    max_distance_km: float | None,
    semantic_k: int,
    geographic_k: int,
    distance_scale_km: float,
) -> tuple[list[Candidate], np.ndarray]:
    """Runs both retrieval channels, unions them, and scores for shortlisting."""
    weights = RETRIEVAL_WEIGHTS[strategy]

    query_text = build_query_text(origin, intent)
    query_vector = embedder.embed_query(query_text)

    semantic_rows = await repositories.fetch_semantic_candidates(
        pool, origin["uid"], query_vector, semantic_k
    )
    geographic_rows = await repositories.fetch_geographic_candidates(
        pool, origin["uid"], query_vector, geographic_k, max_distance_km
    )

    # Union by canonical uid, preserving which channels found each destination.
    merged: dict[str, tuple[asyncpg.Record, list[str]]] = {}
    for row in semantic_rows:
        merged[row["uid"]] = (row, ["semantic"])
    for row in geographic_rows:
        if row["uid"] in merged:
            existing_row, sources = merged[row["uid"]]
            if "geographic" not in sources:
                sources.append("geographic")
            merged[row["uid"]] = (existing_row, sources)
        else:
            merged[row["uid"]] = (row, ["geographic"])

    candidates = [
        _row_to_candidate(row, sources, distance_scale_km, weights)
        for row, sources in merged.values()
    ]

    # Deterministic ordering: score desc, then uid so ties never reshuffle.
    candidates.sort(key=lambda c: (-c.retrieval_score, c.uid))

    logger.info(
        "retrieval origin=%s strategy=%s semantic=%d geographic=%d union=%d -> %d",
        origin["uid"], strategy.value, len(semantic_rows),
        len(geographic_rows), len(merged), min(limit, len(candidates)),
    )
    return candidates[:limit], query_vector
