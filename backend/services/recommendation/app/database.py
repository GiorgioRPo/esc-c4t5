"""Async Postgres connection pool with pgvector support."""

import logging
from typing import Any

import asyncpg
from pgvector.asyncpg import register_vector

from app.config import Settings

logger = logging.getLogger(__name__)


_settings: Settings | None = None
_vector_schema: str | None = None


async def _resolve_vector_schema(conn: asyncpg.Connection) -> str:
    """Finds which schema the `vector` extension actually lives in.

    Supabase installs extensions into `extensions` by default, but pgvector's
    register_vector() defaults to looking in `public`. Explicit schema lookups
    ignore search_path, so we have to pass the real one.
    """
    row = await conn.fetchrow(
        "select extnamespace::regnamespace::text as schema "
        "from pg_extension where extname = 'vector'"
    )
    if row is None:
        raise RuntimeError(
            "The 'vector' extension is not installed in this database. "
            "Enable it in Supabase (Database > Extensions > vector) or run: "
            "create extension if not exists vector with schema extensions;"
        )
    return row["schema"]


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Runs once per new pooled connection."""
    global _vector_schema

    settings = _settings
    assert settings is not None, "pool created before settings were bound"

    await conn.execute(f"set search_path to {settings.database_search_path}")

    if _vector_schema is None:
        _vector_schema = await _resolve_vector_schema(conn)
        logger.info("vector extension found in schema '%s'", _vector_schema)

    try:
        await register_vector(conn, schema=_vector_schema)
    except TypeError:
        # Older pgvector releases don't accept a schema kwarg.
        await register_vector(conn)



async def create_pool(settings: Settings) -> asyncpg.Pool:
    global _settings
    _settings = settings

    kwargs: dict[str, Any] = {
        "min_size": settings.database_pool_min_size,
        "max_size": settings.database_pool_max_size,
        "command_timeout": settings.database_command_timeout,
        "init": _init_connection,
    }

    # statement_cache_size=0 is required for the Supabase transaction pooler
    # (6543). Harmless but unnecessary on the session pooler (5432).
    if settings.database_statement_cache_size == 0:
        kwargs["statement_cache_size"] = 0

    pool = await asyncpg.create_pool(settings.database_url, **kwargs)
    if pool is None:
        raise RuntimeError("asyncpg.create_pool returned None")

    logger.info(
        "database pool ready (min=%d max=%d)",
        settings.database_pool_min_size,
        settings.database_pool_max_size,
    )
    return pool


async def check_health(pool: asyncpg.Pool) -> bool:
    """Cheap liveness probe for the database. Never raises."""
    try:
        async with pool.acquire() as conn:
            return await conn.fetchval("select 1") == 1
    except Exception:
        logger.exception("database health check failed")
        return False
