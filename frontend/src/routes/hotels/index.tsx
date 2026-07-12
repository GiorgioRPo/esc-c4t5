import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SlidersHorizontal, X } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { SearchBar } from '@/components/search/SearchBar'
import { HotelCard } from '@/components/hotels/HotelCard'
import { HotelCardSkeleton } from '@/components/hotels/HotelCardSkeleton'
import {
  FilterSidebar,
  DEFAULT_FILTERS,
  applyFilters,
} from '@/components/hotels/FilterSidebar'
import type { Filters } from '@/components/hotels/FilterSidebar'
import { Button } from '@/components/ui/Button'
import {
  fetchHotels,
  fetchHotelPrices,
  mapToHotel,
} from '@/lib/ascenda'
import type { AscendaPricesResponse } from '@/lib/ascenda'
import type { Hotel, StaySearch } from '@/lib/types'
import {
  cn,
  formatDateShort,
  formatGuestsSummary,
  nightsBetween,
} from '@/lib/utils'
import { parseStaySearch } from '@/lib/search'

export const Route = createFileRoute('/hotels/')({
  validateSearch: parseStaySearch,
  component: HotelsResults,
})

type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'rating-desc' | 'stars-desc'

function cheapestPrice(hotel: Hotel): number {
  return hotel.rooms.length > 0
    ? Math.min(...hotel.rooms.map((r) => r.pricePerNight))
    : Infinity
}

function sortHotels(hotels: Hotel[], sort: SortKey): Hotel[] {
  const copy = [...hotels]
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => cheapestPrice(a) - cheapestPrice(b))
    case 'price-desc':
      return copy.sort((a, b) => cheapestPrice(b) - cheapestPrice(a))
    case 'stars-desc':
      return copy.sort((a, b) => b.starRating - a.starRating)
    default:
      return copy.sort((a, b) => b.guestRating - a.guestRating)
  }
}


function HotelsResults() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [draftSearch, setDraftSearch] = useState<StaySearch>(search)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortKey>('recommended')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [pricesComplete, setPricesComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancelRef = useRef(false)
  const nights = nightsBetween(search.checkIn, search.checkOut)

  useEffect(() => {
    setDraftSearch(search)
  }, [search])

  useEffect(() => {
    if (!search.destinationId) {
      setLoading(false)
      return
    }

    cancelRef.current = false
    setLoading(true)
    setPricesComplete(false)
    setHotels([])
    setError(null)

    async function load() {
      try {
        const priceParams = {
          destinationId: search.destinationId,
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          adults: search.adults,
          rooms: search.rooms,
        }

        const [staticHotels, firstPriceRes] = await Promise.all([
          fetchHotels(search.destinationId),
          fetchHotelPrices(priceParams),
        ])
        if (cancelRef.current) return

        const staticMap = new Map(staticHotels.map((h) => [h.id, h]))

        function mergeHotels(priceRes: AscendaPricesResponse): Hotel[] {
          const merged: Hotel[] = []
          for (const priceData of priceRes.hotels) {
            const staticHotel = staticMap.get(priceData.id)
            if (staticHotel && priceData.lowest_converted_price > 0) {
              merged.push(mapToHotel(staticHotel, priceData))
            }
          }
          return merged
        }

        async function pollPrices(attempt = 0, lastRes: AscendaPricesResponse = firstPriceRes) {
          if (cancelRef.current) return

          const merged = mergeHotels(lastRes)
          setHotels(merged)

          if (lastRes.completed || attempt > 10) {
            setLoading(false)
            setPricesComplete(true)
            return
          }

          if (merged.length > 0) {
            setLoading(false)
          }

          setTimeout(async () => {
            if (cancelRef.current) return
            const nextRes = await fetchHotelPrices(priceParams).catch(() => ({ ...lastRes, completed: true }))
            pollPrices(attempt + 1, nextRes)
          }, 3000)
        }

        pollPrices(0, firstPriceRes)
      } catch {
        if (!cancelRef.current) {
          setError('Could not load hotels. Please try again.')
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelRef.current = true
    }
  }, [
    search.destinationId,
    search.checkIn,
    search.checkOut,
    search.adults,
    search.rooms,
  ])

  const [page, setPage] = useState(1)

  const results = useMemo(
    () => sortHotels(applyFilters(hotels, filters), sort),
    [hotels, filters, sort],
  )

  useEffect(() => { setPage(1) }, [results])

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const pagedResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSearchSubmit() {
    navigate({ to: '/hotels', search: draftSearch })
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <div className="border-b border-border bg-white py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SearchBar
            value={draftSearch}
            onChange={(patch) =>
              setDraftSearch((prev) => ({ ...prev, ...patch }))
            }
            onSubmit={handleSearchSubmit}
            variant="compact"
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-2xl font-bold text-ink">
              {loading
                ? 'Searching…'
                : `${results.length} stays found`}
            </h1>
            {!pricesComplete && !loading && (
              <span className="text-sm text-muted">
                (updating prices…)
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {search.destination} ·{' '}
            {formatDateShort(search.checkIn)} –{' '}
            {formatDateShort(search.checkOut)} · {nights} night
            {nights !== 1 ? 's' : ''} ·{' '}
            {formatGuestsSummary(search.adults, search.childrenCount, search.rooms)}
          </p>
        </div>

        <div className="flex gap-8">
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-24 rounded-card border border-border bg-white p-5">
              <FilterSidebar filters={filters} onChange={setFilters} />
            </div>
          </aside>

          <main className="flex-1">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 lg:hidden"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <label htmlFor="sort" className="text-sm text-muted">
                  Sort by
                </label>
                <select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-btn border border-border bg-white px-3 py-2 text-sm font-medium text-ink focus:border-accent focus:outline-none"
                >
                  <option value="recommended">Top picks</option>
                  <option value="price-asc">Price (low to high)</option>
                  <option value="price-desc">Price (high to low)</option>
                  <option value="rating-desc">Guest rating</option>
                  <option value="stars-desc">Star rating</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5">
              {error ? (
                <div className="rounded-card border border-red-200 bg-red-50 p-6 text-center">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
              ) : loading ? (
                <>
                  <HotelCardSkeleton />
                  <HotelCardSkeleton />
                  <HotelCardSkeleton />
                </>
              ) : !search.destinationId ? (
                <div className="rounded-card border border-border bg-surface p-10 text-center">
                  <p className="font-display text-lg font-bold text-ink">
                    Search for a destination to get started
                  </p>
                  <p className="mt-1.5 text-sm text-muted">
                    Use the search bar above to find hotels.
                  </p>
                </div>
              ) : results.length > 0 ? (
                pagedResults.map((hotel) => (
                  <HotelCard key={hotel.id} hotel={hotel} search={search} />
                ))
              ) : (
                <div className="rounded-card border border-border bg-surface p-10 text-center">
                  <p className="font-display text-lg font-bold text-ink">
                    No stays match your filters
                  </p>
                  <p className="mt-1.5 text-sm text-muted">
                    Try widening your price range or clearing a filter.
                  </p>
                  <Button
                    className="mt-4"
                    variant="secondary"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                  >
                    Clear all filters
                  </Button>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  disabled={page === 1}
                  className="flex h-9 items-center rounded-btn border border-border px-3 text-sm font-medium text-ink hover:bg-surface disabled:pointer-events-none disabled:opacity-40"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | 'gap')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('gap')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((item, idx) =>
                    item === 'gap' ? (
                      <span key={`gap-${idx}`} className="px-1 text-muted">…</span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => { setPage(item); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-btn border text-sm font-medium',
                          item === page
                            ? 'border-accent bg-accent text-white'
                            : 'border-border text-ink hover:bg-surface',
                        )}
                      >
                        {item}
                      </button>
                    ),
                  )}
                <button
                  type="button"
                  onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  disabled={page === totalPages}
                  className="flex h-9 items-center rounded-btn border border-border px-3 text-sm font-medium text-ink hover:bg-surface disabled:pointer-events-none disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between pb-4">
              <h2 className="font-display text-lg font-bold text-ink">
                Filters
              </h2>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setMobileFiltersOpen(false)}
                className="text-muted hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <FilterSidebar filters={filters} onChange={setFilters} />
            <Button
              className="mt-6 w-full"
              onClick={() => setMobileFiltersOpen(false)}
            >
              Show {results.length} stays
            </Button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
