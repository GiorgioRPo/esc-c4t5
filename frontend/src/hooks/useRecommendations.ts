import { useQuery } from '@tanstack/react-query'
import {
  fetchRecommendations,
  type RecommendationParams,
  type RecommendationsResponse,
} from '@/lib/recommendations'

/**
 * Recommendations for the currently searched destination.
 *
 * Runs completely independently of the main hotel search -- it must never
 * block or slow the primary results.
 */
export function useRecommendations(params: RecommendationParams | null) {
  return useQuery<RecommendationsResponse>({
    // Every value that changes the result belongs in the key.
    queryKey: [
      'recommendations',
      params?.originUid,
      params?.checkIn,
      params?.checkOut,
      params?.adults,
      params?.rooms,
      params?.currency ?? 'SGD',
      params?.strategy ?? 'mixed',
    ],
    queryFn: ({ signal }) => fetchRecommendations(params!, signal),
    enabled: Boolean(params?.originUid && params?.checkIn && params?.checkOut),
    // Recommendations change slowly; do not re-run this on every remount.
    staleTime: 12 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    // One retry only. This section is optional -- failing quietly beats
    // hammering a struggling service.
    retry: 1,
  })
}
