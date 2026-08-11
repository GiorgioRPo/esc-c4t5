/**
 * Public recommendation API.
 *
 * Orchestration only -- the browser talks to this route, never to FastAPI.
 *
 *   1. validate the request
 *   2. ask FastAPI for candidates (stored features only)
 *   3. enrich the shortlist with live Ascenda inventory
 *   4. ask FastAPI to rank the enriched set
 *   5. return one frontend-friendly payload
 *
 * The main hotel search must keep working even if every step here fails, so
 * each stage degrades to a weaker but still useful response.
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  fetchCandidates,
  rankCandidates,
  recordEvent,
  type EnrichedCandidate,
  type Recommendation,
} from "../lib/recommender.js";
import { enrichCandidates } from "../lib/enrichment.js";

const recommendations = new Hono();

/** How many of the returned candidates we spend Ascenda calls on. */
const ENRICH_TOP_N = 8;

const requestSchema = z
  .object({
    originUid: z.string().min(1).max(64),
    intent: z.string().max(300).optional(),
    strategy: z.enum(["mixed", "similar", "nearby", "value"]).default("mixed"),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn must be YYYY-MM-DD"),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut must be YYYY-MM-DD"),
    adults: z.number().int().min(1).max(20).default(2),
    children: z.number().int().min(0).max(20).default(0),
    rooms: z.number().int().min(1).max(10).default(1),
    currency: z.string().length(3).default("SGD"),
    countryCode: z.string().length(2).default("SG"),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .refine((data) => new Date(data.checkOut) > new Date(data.checkIn), {
    message: "checkOut must be after checkIn",
    path: ["checkOut"],
  });

/** Ascenda's guests parameter is pipe-separated per room, e.g. "2|2". */
function buildGuestsParam(adults: number, rooms: number): string {
  return Array(rooms).fill(adults).join("|");
}

type Source = "ai-ranked" | "retrieval-only" | "fallback" | "unavailable";

interface ResponseBody {
  runId: string | null;
  source: Source;
  modelVersion: string | null;
  rankingVersion: string | null;
  pricingStatus: "complete" | "pending";
  origin: { uid: string; name: string } | null;
  recommendations: Recommendation[];
}

recommendations.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const input = parsed.data;
  const empty: ResponseBody = {
    runId: null,
    source: "unavailable",
    modelVersion: null,
    rankingVersion: null,
    pricingStatus: "pending",
    origin: null,
    recommendations: [],
  };

  // --- Stage 1: candidate generation ---------------------------------------
  let candidateSet;
  try {
    candidateSet = await fetchCandidates({
      origin_uid: input.originUid,
      intent: input.intent,
      strategy: input.strategy,
      limit: 12,
    });
  } catch (error) {
    console.warn("[recommendations] candidate generation failed:", error);
    // Recommender is down. Return an empty set -- never a 5xx, because the
    // hotel results page renders this section inline.
    return c.json(empty, 200);
  }

  if (candidateSet.candidates.length === 0) {
    return c.json({ ...empty, runId: candidateSet.run_id, source: "fallback" }, 200);
  }

  // --- Stage 2: live Ascenda enrichment (bounded, partial-failure tolerant) --
  const shortlist = candidateSet.candidates.slice(0, ENRICH_TOP_N);
  const enrichmentParams = {
    checkin: input.checkIn,
    checkout: input.checkOut,
    guests: buildGuestsParam(input.adults, input.rooms),
    currency: input.currency,
    countryCode: input.countryCode,
  };

  const [candidateEnrichment, originEnrichment] = await Promise.all([
    enrichCandidates(
      shortlist.map((c) => c.uid),
      enrichmentParams,
    ),
    // The origin's own price makes "X% cheaper" claims possible. If it fails,
    // we simply do not make price-comparison claims.
    enrichCandidates([input.originUid], enrichmentParams).catch(() => null),
  ]);

  const originMinPrice =
    originEnrichment?.signals.get(input.originUid)?.min_price ?? null;

  const enriched: EnrichedCandidate[] = shortlist.map((candidate) => {
    const signals = candidateEnrichment.signals.get(candidate.uid);
    return {
      uid: candidate.uid,
      name: candidate.name,
      country: candidate.country,
      country_code: candidate.country_code,
      region: candidate.region,
      semantic_score: candidate.semantic_score,
      distance_km: candidate.distance_km,
      popularity_score: candidate.popularity_score,
      tags: candidate.tags,
      hotel_count: candidate.hotel_count,
      // Ascenda's price response does not confirm availability, so this stays
      // null. Only priced_hotel_count is claimable from this data.
      available_hotels: null,
      priced_hotel_count: signals?.priced_hotel_count ?? null,
      min_price: signals?.min_price ?? null,
    };
  });

  const pricingStatus: "complete" | "pending" =
    candidateEnrichment.pricingComplete ? "complete" : "pending";

  // --- Stage 3: final ranking ----------------------------------------------
  try {
    const ranked = await rankCandidates({
      run_id: candidateSet.run_id,
      strategy: input.strategy,
      currency: input.currency,
      limit: input.limit,
      origin_min_price: originMinPrice,
      candidates: enriched,
    });

    console.info(
      `[recommendations] runId=${candidateSet.run_id} origin=${input.originUid} ` +
        `candidates=${candidateSet.candidates.length} enriched=${shortlist.length} ` +
        `returned=${ranked.recommendations.length} ` +
        `enrichFailures=${candidateEnrichment.failureCount} pricing=${pricingStatus}`,
    );

    return c.json(
      {
        runId: ranked.run_id,
        source: "ai-ranked" as Source,
        modelVersion: candidateSet.model_version,
        rankingVersion: ranked.ranking_version,
        pricingStatus,
        origin: candidateSet.origin,
        recommendations: ranked.recommendations,
      },
      200,
    );
  } catch (error) {
    console.warn("[recommendations] ranking failed, degrading to retrieval order:", error);

    // Ranking is down but retrieval worked -- serve retrieval order with the
    // enrichment we already have, and no reasons (we cannot justify a ranking
    // we did not compute).
    const degraded: Recommendation[] = enriched
      .slice(0, input.limit)
      .map((candidate, index) => ({
        uid: candidate.uid,
        name: candidate.name,
        country: candidate.country,
        rank: index + 1,
        final_score: 0,
        category: "similar_experience",
        distance_km: candidate.distance_km,
        hotel_count: candidate.hotel_count ?? null,
        available_hotels: null,
        priced_hotel_count: candidate.priced_hotel_count ?? null,
        min_price: candidate.min_price ?? null,
        currency: candidate.min_price != null ? input.currency : null,
        reasons: [],
        score_breakdown: {},
      }));

    return c.json(
      {
        runId: candidateSet.run_id,
        source: "retrieval-only" as Source,
        modelVersion: candidateSet.model_version,
        rankingVersion: candidateSet.ranking_version,
        pricingStatus,
        origin: candidateSet.origin,
        recommendations: degraded,
      },
      200,
    );
  }
});

// ---------------------------------------------------------------------------
// Event proxy
// ---------------------------------------------------------------------------

const eventSchema = z.object({
  runId: z.string().uuid(),
  destinationUid: z.string().max(64).optional(),
  // Allowlist only. Arbitrary event names must not reach the database.
  eventType: z.enum([
    "impression",
    "click",
    "hotel_search",
    "hotel_view",
    "booking_started",
    "booking_completed",
  ]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

recommendations.post("/events", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    await recordEvent({
      run_id: parsed.data.runId,
      destination_uid: parsed.data.destinationUid ?? null,
      event_type: parsed.data.eventType,
      event_metadata: parsed.data.metadata as Record<string, unknown>,
    });
    // 202: telemetry is fire-and-forget from the browser's perspective.
    return c.json({ accepted: true }, 202);
  } catch (error) {
    console.warn("[recommendations] event forwarding failed:", error);
    // A dropped analytics event must never surface as a user-visible error.
    return c.json({ accepted: false }, 202);
  }
});

export default recommendations;
