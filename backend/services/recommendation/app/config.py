"""Configuration for the recommender service.

All settings come from environment variables and are validated at import time,
so the service fails fast with a clear message rather than dying on the first
request.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Database -----------------------------------------------------------
    database_url: str = Field(
        ...,
        alias="RECOMMENDER_DATABASE_URL",
        description="Postgres DSN. Use the Supabase SESSION pooler (port 5432).",
    )
    database_pool_min_size: int = Field(default=1, ge=1)
    database_pool_max_size: int = Field(default=5, ge=1)
    database_command_timeout: float = Field(default=10.0, gt=0)

    # Supabase installs extensions into a dedicated schema. Every connection
    # gets this search_path so `vector` and PostGIS functions resolve unqualified.
    database_search_path: str = Field(default="public,extensions")

    # asyncpg caches prepared statements, which the Supabase TRANSACTION pooler
    # (port 6543) cannot support. Set to 0 only if you must use port 6543.
    database_statement_cache_size: int = Field(default=100, ge=0)

    # --- Security -----------------------------------------------------------
    internal_token: str = Field(..., alias="RECOMMENDER_INTERNAL_TOKEN", min_length=32)

    # --- Embeddings ---------------------------------------------------------
    embedding_model: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")
    embedding_dimension: int = Field(default=384, gt=0)
    embedding_version: str = Field(default="destination-document-v1")

    # live        - load the model and embed queries at request time.
    # precomputed - use query vectors stored by the seeder; the model is never
    #               loaded, so the container needs no PyTorch (~150 MB image,
    #               ~80 MB RSS). Requests carrying `intent` are rejected,
    #               because that text cannot be known in advance.
    embedding_mode: Literal["live", "precomputed"] = "live"

    # --- Retrieval ----------------------------------------------------------
    distance_scale_km: float = Field(default=1500.0, gt=0)
    semantic_candidate_count: int = Field(default=10, ge=1, le=50)
    geographic_candidate_count: int = Field(default=10, ge=1, le=50)
    default_candidate_limit: int = Field(default=12, ge=1, le=30)
    max_candidate_limit: int = Field(default=30, ge=1)
    default_result_limit: int = Field(default=6, ge=1)

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @field_validator("database_url")
    @classmethod
    def _reject_placeholder(cls, value: str) -> str:
        if "YOUR-PASSWORD" in value or "[" in value or "]" in value:
            raise ValueError(
                "RECOMMENDER_DATABASE_URL still contains a placeholder or an "
                "unencoded bracket. Percent-encode the password or reset it to "
                "an alphanumeric value."
            )
        if not value.startswith(("postgresql://", "postgres://")):
            raise ValueError("RECOMMENDER_DATABASE_URL must be a postgresql:// DSN")
        return value

    @field_validator("database_pool_max_size")
    @classmethod
    def _max_ge_min(cls, value: int, info) -> int:
        minimum = info.data.get("database_pool_min_size", 1)
        if value < minimum:
            raise ValueError("pool max_size must be >= min_size")
        return value


@lru_cache
def get_settings() -> Settings:
    """Cached so the env is parsed exactly once per process."""
    return Settings()  # type: ignore[call-arg]
