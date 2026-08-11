/**
 * Client for the internal FastAPI recommendation service.
 *
 * All FastAPI calls go through here -- raw fetches must not be scattered
 * across route files. The internal bearer token never leaves this module and
 * is never returned to the browser.
 */

const RECOMMENDER_URL = process.env.RECOMMENDER_URL ?? "http://localhost:8000";
const INTERNAL_TOKEN = process.env.RECOMMENDER_INTERNAL_TOKEN ?? "";

/** Timeouts are deliberately short: recommendations must never hold up a page. */
const CANDIDATES_TIMEOUT_MS = 3000;
const RANK_TIMEOUT_MS = 2000;
const EVENT_TIMEOUT_MS = 2000;

export type Strategy = "mixed" | "similar" | "nearby" | "value";

export interface RecommenderCandidate {
  uid: string;
  name: string;
  country: string;
  country_code: string | null;
  region: string | null;
  semantic_score: number;
  distance_km: number | null;
  distance_score: number;
  popularity_score: number;
  retrieval_score: number;
  retrieval_sources: string[];
  hotel_count: number | null;
  tags: string[];
}

export interface CandidatesResponse {
  run_id: string;
  model_version: string;
  ranking_version: string;
  origin: { uid: string; name: string };
  candidates: RecommenderCandidate[];
}

export interface EnrichedCandidate extends Omit<
  RecommenderCandidate,
  "distance_score" | "retrieval_score" | "retrieval_sources"
> {
  available_hotels?: number | null;
  priced_hotel_count?: number | null;
  min_price?: number | null;
}

export interface Reason {
  code: string;
  text: string;
}

export interface Recommendation {
  uid: string;
  name: string;
  country: string;
  rank: number;
  final_score: number;
  category: string;
  distance_km: number | null;
  hotel_count: number | null;
  available_hotels: number | null;
  priced_hotel_count: number | null;
  min_price: number | null;
  currency: string | null;
  reasons: Reason[];
  score_breakdown: Record<string, number>;
}

export interface RankResponse {
  run_id: string;
  ranking_version: string;
  recommendations: Recommendation[];
  generated_at: string;
}

export class RecommenderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RecommenderError";
  }
}

async function callRecommender<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  if (!INTERNAL_TOKEN) {
    throw new RecommenderError("RECOMMENDER_INTERNAL_TOKEN is not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${RECOMMENDER_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTERNAL_TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Deliberately does not forward the upstream body: it may contain
      // internal detail that should not reach the browser.
      throw new RecommenderError(
        `Recommender ${path} returned ${response.status}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof RecommenderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new RecommenderError(`Recommender ${path} timed out`, 504);
    }
    throw new RecommenderError(`Recommender ${path} unreachable`);
  } finally {
    clearTimeout(timer);
  }
}

export function fetchCandidates(payload: {
  origin_uid: string;
  intent?: string;
  strategy: Strategy;
  limit?: number;
  max_distance_km?: number;
}): Promise<CandidatesResponse> {
  return callRecommender<CandidatesResponse>(
    "/v1/candidates",
    payload,
    CANDIDATES_TIMEOUT_MS,
  );
}

export function rankCandidates(payload: {
  run_id: string;
  strategy: Strategy;
  currency: string;
  limit?: number;
  origin_min_price?: number | null;
  candidates: EnrichedCandidate[];
}): Promise<RankResponse> {
  return callRecommender<RankResponse>("/v1/rank", payload, RANK_TIMEOUT_MS);
}

export function recordEvent(payload: {
  run_id: string;
  destination_uid?: string | null;
  event_type: string;
  event_metadata?: Record<string, unknown>;
}): Promise<{ accepted: boolean; event_id: string }> {
  return callRecommender("/v1/events", payload, EVENT_TIMEOUT_MS);
}
