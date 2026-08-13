"""Database access for the recommender.

All SQL lives here. Retrieval uses pgvector for semantic similarity and PostGIS
for real-world distance; both are exact at the current catalogue size.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg
import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Destination reads
# ---------------------------------------------------------------------------

_ORIGIN_SQL = """
select uid, name, country_name, country_code, region, description,
       destination_type, tags, embedding, latitude, longitude
from public.destinations
where uid = $1 and active
"""


async def get_origin(pool: asyncpg.Pool, uid: str) -> asyncpg.Record | None:
    async with pool.acquire() as conn:
        return await conn.fetchrow(_ORIGIN_SQL, uid)


async def get_query_embedding(pool: asyncpg.Pool, uid: str):
    """Returns the precomputed no-intent query vector for an origin.

    Populated by scripts.seed_destinations. None means the seeder has not run
    since migration 002, in which case EMBEDDING_MODE=precomputed cannot serve
    this destination.
    """
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "select query_embedding from public.destinations "
            "where uid = $1 and active",
            uid,
        )


# Semantic retrieval. `<=>` is pgvector cosine DISTANCE (0 = identical), so
# similarity is 1 - distance. Sequential scan is intentional: at ~45 rows it is
# both faster and exact, unlike an approximate ANN index.
_SEMANTIC_SQL = """
select d.uid, d.name, d.country_name, d.country_code, d.region, d.tags,
       d.popularity_score,
       1 - (d.embedding <=> $2) as semantic_score,
       case
         when d.location is not null and o.location is not null
         then extensions.st_distance(d.location, o.location) / 1000.0
         else null
       end as distance_km,
       nullif(d.metadata->>'hotel_count', '')::int as hotel_count
from public.destinations d
cross join (select location from public.destinations where uid = $1) o
where d.uid <> $1
  and d.active
  and d.embedding is not null
order by d.embedding <=> $2
limit $3
"""

# Geographic retrieval. ST_DWithin (rather than filtering on ST_Distance) lets
# Postgres use the GiST index on location.
_GEOGRAPHIC_SQL = """
select d.uid, d.name, d.country_name, d.country_code, d.region, d.tags,
       d.popularity_score,
       1 - (d.embedding <=> $2) as semantic_score,
       extensions.st_distance(d.location, o.location) / 1000.0 as distance_km,
       nullif(d.metadata->>'hotel_count', '')::int as hotel_count
from public.destinations d
cross join (select location from public.destinations where uid = $1) o
where d.uid <> $1
  and d.active
  and d.location is not null
  and o.location is not null
  and ($4::float8 is null or extensions.st_dwithin(d.location, o.location, $4 * 1000))
order by d.location <-> o.location
limit $3
"""


async def fetch_semantic_candidates(
    pool: asyncpg.Pool, origin_uid: str, query_vector: np.ndarray, limit: int
) -> list[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetch(_SEMANTIC_SQL, origin_uid, query_vector, limit)


async def fetch_geographic_candidates(
    pool: asyncpg.Pool,
    origin_uid: str,
    query_vector: np.ndarray,
    limit: int,
    max_distance_km: float | None,
) -> list[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetch(
            _GEOGRAPHIC_SQL, origin_uid, query_vector, limit, max_distance_km
        )


# ---------------------------------------------------------------------------
# Telemetry writes
# ---------------------------------------------------------------------------

_INSERT_RUN = """
insert into public.recommendation_runs (
    session_id, user_id, origin_uid, intent, strategy,
    model_version, ranking_version, request_metadata, latency_ms
) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
returning id
"""


async def create_run(
    pool: asyncpg.Pool,
    *,
    origin_uid: str,
    strategy: str,
    model_version: str,
    ranking_version: str,
    intent: str | None = None,
    session_id: str | None = None,
    user_id: UUID | None = None,
    request_metadata: dict[str, Any] | None = None,
    latency_ms: int | None = None,
) -> UUID:
    async with pool.acquire() as conn:
        return await conn.fetchval(
            _INSERT_RUN,
            session_id,
            user_id,
            origin_uid,
            intent,
            strategy,
            model_version,
            ranking_version,
            json.dumps(request_metadata or {}),
            latency_ms,
        )


_UPSERT_ITEM = """
insert into public.recommendation_items (
    run_id, destination_uid, initial_rank, final_rank,
    semantic_score, distance_km, distance_score, availability_score,
    price_score, popularity_score, final_score,
    hotel_count, available_hotels, priced_hotel_count,
    minimum_price, currency, explanation
) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
on conflict (run_id, destination_uid) do update set
    final_rank         = excluded.final_rank,
    final_score        = excluded.final_score,
    availability_score = excluded.availability_score,
    price_score        = excluded.price_score,
    hotel_count        = excluded.hotel_count,
    available_hotels   = excluded.available_hotels,
    priced_hotel_count = excluded.priced_hotel_count,
    minimum_price      = excluded.minimum_price,
    currency           = excluded.currency,
    explanation        = excluded.explanation
"""


async def save_items(
    pool: asyncpg.Pool, run_id: UUID, rows: list[dict[str, Any]]
) -> None:
    """Persists the feature snapshot used at ranking time.

    This snapshot is what a future learning-to-rank model trains on; it must
    not be reconstructed later from mutable destination or inventory tables.
    """
    if not rows:
        return
    async with pool.acquire() as conn:
        async with conn.transaction():
            for row in rows:
                await conn.execute(
                    _UPSERT_ITEM,
                    run_id,
                    row["destination_uid"],
                    row["initial_rank"],
                    row.get("final_rank"),
                    row.get("semantic_score"),
                    row.get("distance_km"),
                    row.get("distance_score"),
                    row.get("availability_score"),
                    row.get("price_score"),
                    row.get("popularity_score"),
                    row.get("final_score"),
                    row.get("hotel_count"),
                    row.get("available_hotels"),
                    row.get("priced_hotel_count"),
                    row.get("minimum_price"),
                    row.get("currency"),
                    json.dumps(row.get("explanation") or {}),
                )


_INSERT_EVENT = """
insert into public.recommendation_events (
    run_id, destination_uid, event_type, event_metadata
) values ($1,$2,$3,$4)
returning id
"""


async def record_event(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    destination_uid: str | None,
    event_type: str,
    event_metadata: dict[str, Any],
) -> UUID | None:
    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            "select 1 from public.recommendation_runs where id = $1", run_id
        )
        if not exists:
            return None
        return await conn.fetchval(
            _INSERT_EVENT,
            run_id,
            destination_uid,
            event_type,
            json.dumps(event_metadata),
        )
