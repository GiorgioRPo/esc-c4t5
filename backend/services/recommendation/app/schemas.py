"""Pydantic request/response contracts for the recommender API.

These are the wire contract with Hono. Field names use snake_case; Hono owns
the camelCase transformation at its public boundary.
"""

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class Strategy(str, Enum):
    MIXED = "mixed"
    SIMILAR = "similar"
    NEARBY = "nearby"
    VALUE = "value"


# ---------------------------------------------------------------------------
# /v1/candidates
# ---------------------------------------------------------------------------


class CandidateRequest(BaseModel):
    origin_uid: str = Field(..., min_length=1, max_length=64)
    intent: str | None = Field(default=None, max_length=300)
    strategy: Strategy = Strategy.MIXED
    limit: int = Field(default=12, ge=1, le=30)
    max_distance_km: float | None = Field(default=None, gt=0, le=20_000)

    @field_validator("intent")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class Candidate(BaseModel):
    uid: str
    name: str
    country: str
    country_code: str | None = None
    region: str | None = None
    semantic_score: float
    distance_km: float | None
    distance_score: float
    popularity_score: float
    retrieval_score: float
    retrieval_sources: list[str]
    # Static Ascenda inventory count. NOT dated availability.
    hotel_count: int | None = None
    tags: list[str] = Field(default_factory=list)


class CandidateResponse(BaseModel):
    run_id: UUID
    model_version: str
    ranking_version: str
    origin: dict[str, str]
    candidates: list[Candidate]


# ---------------------------------------------------------------------------
# /v1/rank
# ---------------------------------------------------------------------------


class EnrichedCandidate(BaseModel):
    """A candidate after Hono has enriched it with live Ascenda data.

    The three count fields are deliberately distinct:
      hotel_count        - static inventory, always available, weakest signal
      available_hotels   - dated availability, only if the API confirms it
      priced_hotel_count - hotels that returned a dated price, strongest proof
    """

    uid: str
    name: str
    country: str
    country_code: str | None = None
    region: str | None = None
    semantic_score: float = Field(..., ge=0, le=1)
    distance_km: float | None = None
    popularity_score: float = Field(default=0.0, ge=0, le=1)
    tags: list[str] = Field(default_factory=list)

    hotel_count: int | None = Field(default=None, ge=0)
    available_hotels: int | None = Field(default=None, ge=0)
    priced_hotel_count: int | None = Field(default=None, ge=0)
    min_price: float | None = Field(default=None, ge=0)


class RankRequest(BaseModel):
    run_id: UUID
    strategy: Strategy = Strategy.MIXED
    currency: str = Field(default="SGD", min_length=3, max_length=3)
    limit: int = Field(default=6, ge=1, le=20)
    # Origin's own median/minimum price, when Hono could obtain it. Enables
    # the "cheaper than where you searched" comparison; omitted when unknown.
    origin_min_price: float | None = Field(default=None, ge=0)
    candidates: list[EnrichedCandidate]


class Reason(BaseModel):
    code: str
    text: str


class Recommendation(BaseModel):
    uid: str
    name: str
    country: str
    rank: int
    final_score: float
    category: str
    distance_km: float | None
    hotel_count: int | None
    available_hotels: int | None
    priced_hotel_count: int | None
    min_price: float | None
    currency: str | None
    reasons: list[Reason]
    # Per-feature contributions, useful for debugging and tuning weights.
    score_breakdown: dict[str, float]


class RankResponse(BaseModel):
    run_id: UUID
    ranking_version: str
    recommendations: list[Recommendation]
    generated_at: datetime


# ---------------------------------------------------------------------------
# /v1/events
# ---------------------------------------------------------------------------

EventType = Literal[
    "impression",
    "click",
    "hotel_search",
    "hotel_view",
    "booking_started",
    "booking_completed",
]


class EventRequest(BaseModel):
    run_id: UUID
    destination_uid: str | None = Field(default=None, max_length=64)
    event_type: EventType
    event_metadata: dict = Field(default_factory=dict)

    @field_validator("event_metadata")
    @classmethod
    def _bounded_metadata(cls, value: dict) -> dict:
        if len(value) > 20:
            raise ValueError("event_metadata may not exceed 20 keys")
        for key, item in value.items():
            if isinstance(item, str) and len(item) > 500:
                raise ValueError(f"event_metadata['{key}'] exceeds 500 characters")
        return value


class EventResponse(BaseModel):
    accepted: bool
    event_id: UUID
