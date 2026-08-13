import { Skeleton } from '@/components/ui/Skeleton'
import { useRecommendations } from '@/hooks/useRecommendations'
import { RecommendationCard } from './RecommendationCard'
import type { StaySearch } from '@/lib/types'

function RecommendationSkeleton() {
  return (
    <div className="rounded-card border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="w-full space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <Skeleton className="mt-5 h-9 w-full rounded-btn" />
    </div>
  )
}

/**
 * "Because you searched X" -- alternative destination suggestions.
 *
 * Renders below the hotel results and loads independently of them. Every
 * failure mode degrades to rendering nothing rather than showing an error:
 * this section is additive, and must never interrupt someone trying to book.
 */
export function DestinationRecommendations({ search }: { search: StaySearch }) {
  const enabled = Boolean(
    search.destinationId && search.checkIn && search.checkOut,
  )

  const { data, isLoading, isError } = useRecommendations(
    enabled
      ? {
          originUid: search.destinationId,
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          adults: search.adults,
          rooms: search.rooms,
        }
      : null,
  )

  if (!enabled) return null

  // Fail silently. A broken recommender must not produce a visible error on a
  // page whose primary job is booking a hotel.
  if (isError) return null

  if (isLoading) {
    return (
      <section
        aria-busy="true"
        aria-label="Loading destination suggestions"
        className="mt-12 border-t border-border pt-8"
      >
        <Skeleton className="h-7 w-72" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RecommendationSkeleton />
          <RecommendationSkeleton />
          <RecommendationSkeleton />
        </div>
      </section>
    )
  }

  // No trustworthy results -- hide the section entirely rather than showing an
  // empty shell.
  if (!data || data.recommendations.length === 0) return null

  const originName = data.origin?.name ?? search.destination

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="font-display text-xl font-bold text-ink">
        Because you searched {originName}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Alternative destinations for the same dates and guests.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.uid}
            recommendation={recommendation}
            search={search}
            runId={data.runId}
            pricingStatus={data.pricingStatus}
          />
        ))}
      </div>
    </section>
  )
}
