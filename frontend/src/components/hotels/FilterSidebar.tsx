import { FACILITIES } from '@/data/facilities'
import { StarRating } from '@/components/ui/StarRating'
import { formatCurrency } from '@/lib/utils'
import type { Hotel } from '@/lib/types'

export interface Filters {
  starRatings: number[]
  minGuestRating: number
  maxPrice: number
  facilities: string[]
}

export const PRICE_MIN = 100
export const PRICE_MAX = 500

export const DEFAULT_FILTERS: Filters = {
  starRatings: [],
  minGuestRating: 0,
  maxPrice: PRICE_MAX,
  facilities: [],
}

const GUEST_RATING_OPTIONS = [
  { label: 'Any rating', value: 0 },
  { label: '9+ Exceptional', value: 9 },
  { label: '8+ Excellent', value: 8 },
  { label: '7+ Very good', value: 7 },
]

export function FilterSidebar({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (next: Filters) => void
}) {
  function toggleStar(star: number) {
    const next = filters.starRatings.includes(star)
      ? filters.starRatings.filter((s) => s !== star)
      : [...filters.starRatings, star]
    onChange({ ...filters, starRatings: next })
  }

  function toggleFacility(key: string) {
    const next = filters.facilities.includes(key)
      ? filters.facilities.filter((f) => f !== key)
      : [...filters.facilities, key]
    onChange({ ...filters, facilities: next })
  }

  const isDefault =
    filters.starRatings.length === 0 &&
    filters.minGuestRating === 0 &&
    filters.maxPrice === PRICE_MAX &&
    filters.facilities.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink">Filters</h2>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink">Star rating</h3>
        <div className="mt-3 space-y-2.5">
          {[5, 4, 3, 2, 1].map((star) => (
            <label
              key={star}
              className="flex cursor-pointer items-center gap-2.5"
            >
              <input
                type="checkbox"
                checked={filters.starRatings.includes(star)}
                onChange={() => toggleStar(star)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              <StarRating rating={star} size={13} />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink">Guest rating</h3>
        <div className="mt-3 space-y-2.5">
          {GUEST_RATING_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2.5 text-sm text-ink"
            >
              <input
                type="radio"
                name="minGuestRating"
                checked={filters.minGuestRating === opt.value}
                onChange={() =>
                  onChange({ ...filters, minGuestRating: opt.value })
                }
                className="h-4 w-4 border-border text-accent focus:ring-accent"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink">Price per night</h3>
        <p className="mt-1 text-xs text-muted">
          Up to {formatCurrency(filters.maxPrice)}
        </p>
        <input
          type="range"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={10}
          value={filters.maxPrice}
          onChange={(e) =>
            onChange({ ...filters, maxPrice: Number(e.target.value) })
          }
          className="mt-3 w-full accent-accent"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink">Facilities</h3>
        <div className="mt-3 space-y-2.5">
          {FACILITIES.map((f) => {
            const Icon = f.icon
            return (
              <label
                key={f.key}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={filters.facilities.includes(f.key)}
                  onChange={() => toggleFacility(f.key)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
                {f.label}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function applyFilters(hotels: Hotel[], filters: Filters): Hotel[] {
  return hotels.filter((hotel) => {
    if (
      filters.starRatings.length > 0 &&
      !filters.starRatings.includes(hotel.starRating)
    )
      return false
    if (
      filters.minGuestRating > 0 &&
      hotel.guestRating < filters.minGuestRating
    )
      return false
    const cheapest = Math.min(...hotel.rooms.map((r) => r.pricePerNight))
    if (cheapest > filters.maxPrice) return false
    if (
      filters.facilities.length > 0 &&
      !filters.facilities.every((f) => hotel.facilities.includes(f))
    )
      return false
    return true
  })
}
