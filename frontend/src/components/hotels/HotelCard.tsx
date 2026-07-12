import { Link } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { HotelImage } from '@/components/ui/HotelImage'
import { StarRating } from '@/components/ui/StarRating'
import { RatingPill } from '@/components/ui/RatingPill'
import { Badge, PointsBadge } from '@/components/ui/Badge'
import { buttonVariants } from '@/components/ui/Button'
import { FACILITY_MAP } from '@/data/facilities'
import { cn, formatCurrency, pointsForAmount } from '@/lib/utils'
import type { Hotel, StaySearch } from '@/lib/types'

export function HotelCard({
  hotel,
  search,
}: {
  hotel: Hotel
  search: StaySearch
}) {
  const cheapest = [...hotel.rooms].sort(
    (a, b) => a.pricePerNight - b.pricePerNight,
  )[0]
  const hasFreeCancellation = hotel.rooms.some((r) => r.freeCancellation)
  const topFacilities = hotel.facilities.slice(0, 4)

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-white transition-shadow hover:shadow-md sm:flex-row">
      <Link
        to="/hotels/$hotelId"
        params={{ hotelId: hotel.id }}
        search={search}
        className="relative block h-56 shrink-0 sm:h-auto sm:w-72"
      >
        <HotelImage
          src={hotel.images[0]}
          alt={hotel.name}
          className="h-full w-full"
        />
        {hasFreeCancellation && (
          <Badge
            tone="success"
            className="absolute left-3 top-3 bg-white shadow-sm"
          >
            Free cancellation
          </Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link
          to="/hotels/$hotelId"
          params={{ hotelId: hotel.id }}
          search={search}
          className="font-display text-lg font-bold text-ink hover:text-accent"
        >
          {hotel.name}
        </Link>
        <StarRating rating={hotel.starRating} size={14} className="mt-1.5" />
        <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
          <MapPin className="h-3.5 w-3.5" />
          {hotel.city}, {hotel.country}
        </p>

        <div className="mt-3 flex items-center gap-3">
          {topFacilities.map((key) => {
            const facility = FACILITY_MAP[key]
            const Icon = facility.icon
            return (
              <span key={key} title={facility.label} className="text-muted">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
            )
          })}
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-muted">
          {hotel.description}
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
          <RatingPill
            score={hotel.guestRating}
            reviewCount={hotel.reviewCount}
            size="sm"
          />
          <div className="text-right">
            {cheapest.originalPricePerNight && (
              <p className="text-xs text-muted line-through">
                {formatCurrency(cheapest.originalPricePerNight)}
              </p>
            )}
            <p className="text-xl font-bold text-ink">
              {formatCurrency(cheapest.pricePerNight)}
              <span className="text-sm font-normal text-muted"> / night</span>
            </p>
            <p className="text-xs text-muted">+ taxes &amp; fees</p>
            <div className="mt-2 flex items-center justify-end gap-2">
              <PointsBadge points={pointsForAmount(cheapest.pricePerNight)} />
              <Link
                to="/hotels/$hotelId"
                params={{ hotelId: hotel.id }}
                search={search}
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'sm' }),
                )}
              >
                View details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
