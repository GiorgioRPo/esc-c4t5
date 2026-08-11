"""FastAPI application entry point.

Only Hono calls this service. The browser must never reach it directly, which
is why there is no CORS middleware and every non-health route requires the
internal bearer token.
"""

import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Request, status

from app import repositories
from app.config import get_settings
from app.database import check_health, create_pool
from app.embedding import SentenceTransformerEmbeddingProvider
from app.ranking import (
    RANKING_VERSION,
    RETRIEVAL_VERSION,
    WeightedHybridRanker,
    assign_category,
    build_reasons,
    diversify,
)
from app.retrieval import generate_candidates
from app.schemas import (
    CandidateRequest,
    CandidateResponse,
    EventRequest,
    EventResponse,
    RankRequest,
    RankResponse,
    Recommendation,
)
from app.security import require_internal_token

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )

    started = time.perf_counter()
    app.state.settings = settings
    app.state.model_ready = False

    app.state.pool = await create_pool(settings)

    provider = SentenceTransformerEmbeddingProvider(
        settings.embedding_model, settings.embedding_dimension
    )
    provider.warm()
    app.state.embedding = provider
    app.state.model_ready = True
    app.state.ranker = WeightedHybridRanker(settings.distance_scale_km)

    logger.info("startup complete in %.2fs", time.perf_counter() - started)
    try:
        yield
    finally:
        await app.state.pool.close()
        logger.info("shutdown complete")


app = FastAPI(
    title="Ascenda Destination Recommender",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health/live", tags=["health"])
async def health_live() -> dict[str, str]:
    """Process is alive. Deliberately does not touch the DB or model, so a
    transient database blip cannot cause Docker to kill a healthy process."""
    return {"status": "alive"}


@app.get("/health/ready", tags=["health"])
async def health_ready() -> dict[str, object]:
    db_ok = await check_health(app.state.pool)
    model_ok = bool(getattr(app.state, "model_ready", False))
    return {
        "status": "ready" if (db_ok and model_ok) else "not_ready",
        "database": db_ok,
        "model": model_ok,
        "embedding_model": app.state.settings.embedding_model,
    }


# ---------------------------------------------------------------------------
# Candidate generation
# ---------------------------------------------------------------------------


@app.post(
    "/v1/candidates",
    response_model=CandidateResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["recommendations"],
)
async def candidates(payload: CandidateRequest, request: Request) -> CandidateResponse:
    settings = request.app.state.settings
    pool = request.app.state.pool
    started = time.perf_counter()

    origin = await repositories.get_origin(pool, payload.origin_uid)
    if origin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown or inactive destination: {payload.origin_uid}",
        )

    limit = min(payload.limit, settings.max_candidate_limit)

    results, _ = await generate_candidates(
        pool,
        request.app.state.embedding,
        origin,
        strategy=payload.strategy,
        intent=payload.intent,
        limit=limit,
        max_distance_km=payload.max_distance_km,
        semantic_k=settings.semantic_candidate_count,
        geographic_k=settings.geographic_candidate_count,
        distance_scale_km=settings.distance_scale_km,
    )

    latency_ms = int((time.perf_counter() - started) * 1000)

    run_id = await repositories.create_run(
        pool,
        origin_uid=payload.origin_uid,
        strategy=payload.strategy.value,
        model_version=settings.embedding_model,
        ranking_version=RETRIEVAL_VERSION,
        intent=payload.intent,
        request_metadata={
            "limit": limit,
            "max_distance_km": payload.max_distance_km,
            "candidate_count": len(results),
        },
        latency_ms=latency_ms,
    )

    await repositories.save_items(
        pool,
        run_id,
        [
            {
                "destination_uid": c.uid,
                "initial_rank": index,
                "semantic_score": c.semantic_score,
                "distance_km": c.distance_km,
                "distance_score": c.distance_score,
                "popularity_score": c.popularity_score,
                "hotel_count": c.hotel_count,
            }
            for index, c in enumerate(results, start=1)
        ],
    )

    logger.info(
        "candidates run_id=%s origin=%s returned=%d latency_ms=%d",
        run_id, payload.origin_uid, len(results), latency_ms,
    )

    return CandidateResponse(
        run_id=run_id,
        model_version=settings.embedding_model,
        ranking_version=RETRIEVAL_VERSION,
        origin={"uid": origin["uid"], "name": origin["name"]},
        candidates=results,
    )


# ---------------------------------------------------------------------------
# Final ranking
# ---------------------------------------------------------------------------


@app.post(
    "/v1/rank",
    response_model=RankResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["recommendations"],
)
async def rank(payload: RankRequest, request: Request) -> RankResponse:
    settings = request.app.state.settings
    pool = request.app.state.pool
    started = time.perf_counter()

    if not payload.candidates:
        return RankResponse(
            run_id=payload.run_id,
            ranking_version=RANKING_VERSION,
            recommendations=[],
            generated_at=datetime.now(timezone.utc),
        )

    scored = request.app.state.ranker.rank(
        payload.candidates, payload.strategy, payload.origin_min_price
    )
    selected = diversify(scored, min(payload.limit, settings.default_result_limit))

    recommendations: list[Recommendation] = []
    for item in selected:
        item.category = assign_category(item, payload.origin_min_price)
        item.reasons = build_reasons(item, payload.currency, payload.origin_min_price)
        c = item.candidate
        recommendations.append(
            Recommendation(
                uid=c.uid,
                name=c.name,
                country=c.country,
                rank=item.final_rank,
                final_score=item.final_score,
                category=item.category,
                distance_km=c.distance_km,
                hotel_count=c.hotel_count,
                available_hotels=c.available_hotels,
                priced_hotel_count=c.priced_hotel_count,
                min_price=c.min_price,
                currency=payload.currency if c.min_price is not None else None,
                reasons=item.reasons,
                score_breakdown=item.contributions,
            )
        )

    await repositories.save_items(
        pool,
        payload.run_id,
        [
            {
                "destination_uid": item.candidate.uid,
                "initial_rank": item.initial_rank,
                "final_rank": item.final_rank or None,
                "semantic_score": item.features["semantic"],
                "distance_km": item.candidate.distance_km,
                "distance_score": item.features["distance"],
                "availability_score": item.features["inventory"],
                "price_score": item.features["price"],
                "popularity_score": item.features["popularity"],
                "final_score": item.final_score,
                "hotel_count": item.candidate.hotel_count,
                "available_hotels": item.candidate.available_hotels,
                "priced_hotel_count": item.candidate.priced_hotel_count,
                "minimum_price": item.candidate.min_price,
                "currency": payload.currency,
                "explanation": {
                    "category": item.category,
                    "reason_codes": [r.code for r in item.reasons],
                    "inventory_source": item.inventory_source,
                },
            }
            for item in scored
        ],
    )

    logger.info(
        "rank run_id=%s scored=%d returned=%d latency_ms=%d",
        payload.run_id, len(scored), len(recommendations),
        int((time.perf_counter() - started) * 1000),
    )

    return RankResponse(
        run_id=payload.run_id,
        ranking_version=RANKING_VERSION,
        recommendations=recommendations,
        generated_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


@app.post(
    "/v1/events",
    response_model=EventResponse,
    dependencies=[Depends(require_internal_token)],
    tags=["telemetry"],
)
async def events(payload: EventRequest, request: Request) -> EventResponse:
    event_id = await repositories.record_event(
        request.app.state.pool,
        run_id=payload.run_id,
        destination_uid=payload.destination_uid,
        event_type=payload.event_type,
        event_metadata=payload.event_metadata,
    )
    if event_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown recommendation run",
        )
    return EventResponse(accepted=True, event_id=event_id)
