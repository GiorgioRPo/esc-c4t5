import { Link } from '@tanstack/react-router'
import { MapPin, Building2, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import { useImpression } from '@/hooks/useImpression'
import {
  recordRecommendationEvent,
  searchForRecommendation,
  type DestinationRecommendation,
  type RecommendationCategory,
} from '@/lib/recommendations'
import { cn, formatCurrency } from '@/lib/utils'
import type { StaySearch } from '@/lib/types'

const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  nearby: 'Nearby',
  similar_experience: 'Similar experience',
  better_value: 'Better value',
  strong_availability: 'Strong availability',
  popular_alternative: 'Popular alternative',
}

const CATEGORY_TONE: Record<RecommendationCategory, BadgeTone> = {
  nearby: 'accent',
  similar_experience: 'neutral',
  better_value: 'success',
  strong_availability: 'accent',
  popular_alternative: 'gold',
}

export function RecommendationCard({
  recommendation,
  search,
  runId,
  pricingStatus,
}: {
  recommendation: DestinationRecommendation
  search: StaySearch
  runId: string | null
  pricingStatus: 'complete' | 'pending'
}) {
  const impressionRef = useImpression<HTMLDivElement>(
    () => {
      if (!runId) return
      recordRecommendationEvent({
        runId,
        destinationUid: recommendation.uid,
        eventType: 'impression',
        metadata: { position: recommendation.rank, category: recommendation.category },
      })
    },
    { enabled: Boolean(runId) },
  )

  function handleClick() {
    if (!runId) return
    recordRecommendationEvent({
      runId,
      destinationUid: recommendation.uid,
      eventType: 'click',
      metadata: { position: recommendation.rank },
    })
  }

  const label = CATEGORY_LABEL[recommendation.category] ?? 'Suggested'
  const tone = CATEGORY_TONE[recommendation.category] ?? 'neutral'

  return (
    <div
      ref={impressionRef}
      className="flex h-full flex-col rounded-card border border-border bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink">
            {recommendation.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {recommendation.country}
          </p>
        </div>
        <Badge tone={tone} className="shrink-0">
          {label}
        </Badge>
      </div>

      {recommendation.reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {recommendation.reasons.map((reason) => (
            <li
              key={reason.code}
              className="flex items-start gap-1.5 text-xs leading-relaxed text-muted"
            >
              <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
              {reason.text}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            {recommendation.min_price != null && recommendation.currency ? (
              <>
                <p className="text-[11px] text-muted">From</p>
                <p className="font-display text-lg font-bold text-ink">
                  {formatCurrency(recommendation.min_price)}
                </p>
              </>
            ) : pricingStatus === 'pending' ? (
              // Honest placeholder: Ascenda's async pricing has not finished.
              // Never invent a price to fill this space.
              <p className="text-xs text-muted">Checking prices&hellip;</p>
            ) : (
              <p className="text-xs text-muted">Price unavailable</p>
            )}
          </div>

          {recommendation.hotel_count != null && (
            <p className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
              <Building2 className="h-3 w-3" />
              {recommendation.hotel_count.toLocaleString()} hotels
            </p>
          )}
        </div>

        <Link
          to="/hotels"
          search={searchForRecommendation(recommendation, search)}
          onClick={handleClick}
          aria-label={`Search hotels in ${recommendation.name}, ${recommendation.country}`}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-1.5 rounded-btn',
            'border border-border px-3 py-2 text-sm font-semibold text-ink',
            'hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          Search hotels
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
