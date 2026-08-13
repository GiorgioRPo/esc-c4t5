/**
 * Destination recommendations API client.
 *
 * The browser only ever talks to Hono. The FastAPI recommender and its
 * internal token are never reachable from here.
 */

import type { StaySearch } from '@/lib/types'
import { apiUrl } from '@/lib/api'

export type RecommendationSource =
  | 'ai-ranked'
  | 'retrieval-only'
  | 'fallback'
  | 'unavailable'

export type RecommendationCategory =
  | 'nearby'
  | 'similar_experience'
  | 'better_value'
  | 'strong_availability'
  | 'popular_alternative'

export interface RecommendationReason {
  code: string
  text: string
}

export interface DestinationRecommendation {
  uid: string
  name: string
  country: string
  rank: number
  final_score: number
  category: RecommendationCategory
  distance_km: number | null
  /** Static Ascenda inventory. NOT dated availability. */
  hotel_count: number | null
  available_hotels: number | null
  priced_hotel_count: number | null
  min_price: number | null
  currency: string | null
  reasons: RecommendationReason[]
}

export interface RecommendationsResponse {
  runId: string | null
  source: RecommendationSource
  modelVersion: string | null
  rankingVersion: string | null
  /** 'pending' means Ascenda's async pricing had not finished; show a placeholder. */
  pricingStatus: 'complete' | 'pending'
  origin: { uid: string; name: string } | null
  recommendations: DestinationRecommendation[]
}

export interface RecommendationParams {
  originUid: string
  checkIn: string
  checkOut: string
  adults: number
  rooms: number
  currency?: string
  strategy?: 'mixed' | 'similar' | 'nearby' | 'value'
  limit?: number
}

export async function fetchRecommendations(
  params: RecommendationParams,
  signal?: AbortSignal,
): Promise<RecommendationsResponse> {
  const res = await fetch(apiUrl('/api/recommendations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originUid: params.originUid,
      strategy: params.strategy ?? 'mixed',
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: params.adults,
      rooms: params.rooms,
      currency: params.currency ?? 'SGD',
      limit: params.limit ?? 5,
    }),
    signal,
  })

  if (!res.ok) {
    throw new Error(`Recommendations request failed (${res.status})`)
  }
  return res.json()
}

export type RecommendationEventType =
  | 'impression'
  | 'click'
  | 'hotel_search'
  | 'hotel_view'
  | 'booking_started'
  | 'booking_completed'

/**
 * Fire-and-forget telemetry. A failed analytics call must never surface to the
 * user, so this deliberately swallows errors.
 */
export function recordRecommendationEvent(payload: {
  runId: string
  destinationUid?: string
  eventType: RecommendationEventType
  metadata?: Record<string, unknown>
}): void {
  const body = JSON.stringify({
    runId: payload.runId,
    destinationUid: payload.destinationUid,
    eventType: payload.eventType,
    metadata: payload.metadata ?? {},
  })

  // keepalive lets the request survive the page navigation that a click causes.
  fetch(apiUrl('/api/recommendations/events'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* telemetry is best-effort */
  })
}

/**
 * Builds the search params for navigating to a recommended destination,
 * preserving the traveller's original dates and party size.
 */
export function searchForRecommendation(
  recommendation: DestinationRecommendation,
  current: StaySearch,
): StaySearch {
  return {
    ...current,
    destination: `${recommendation.name}, ${recommendation.country}`,
    destinationId: recommendation.uid,
  }
}
