import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle2, Heart, MapPin, Share2 } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Gallery } from '@/components/hotel-detail/Gallery'
import { RoomCard } from '@/components/hotel-detail/RoomCard'
import { StarRating } from '@/components/ui/StarRating'
import { RatingPill } from '@/components/ui/RatingPill'
import { buttonVariants } from '@/components/ui/Button'
import { HotelCardSkeleton } from '@/components/hotels/HotelCardSkeleton'
import { FACILITY_MAP } from '@/data/facilities'
import {
  fetchHotels,
  fetchHotelPrices,
  fetchHotelRoomPrices,
  mapToHotel,
  mapRooms,
} from '@/lib/ascenda'
import { parseStaySearch } from '@/lib/search'
import type { Hotel } from '@/lib/types'
import {
  cn,
  formatCurrency,
  formatDateShort,
  formatGuestsSummary,
  guestRatingLabel,
  nightsBetween,
} from '@/lib/utils'

export const Route = createFileRoute('/hotels/$hotelId')({
  validateSearch: parseStaySearch,
  component: HotelDetail,
})

function HotelDetail() {
  const { hotelId } = Route.useParams()
  const search = Route.useSearch()

  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!search.destinationId) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setNotFound(false)

    const roomParams = {
      destinationId: search.destinationId,
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      adults: search.adults,
      rooms: search.rooms,
    }

    async function load() {
      const [hotels, pricesRes] = await Promise.all([
        fetchHotels(search.destinationId),
        fetchHotelPrices(roomParams),
      ])

      const apiHotel = hotels.find((h) => h.id === hotelId)
      const priceData = pricesRes.hotels.find((p) => p.id === hotelId)

      if (!apiHotel || !priceData || priceData.lowest_converted_price <= 0) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const baseHotel = mapToHotel(apiHotel, priceData)
      setHotel(baseHotel)
      setLoading(false)

      // Poll room prices until completed
      let attempts = 0
      const MAX_ATTEMPTS = 10
      async function pollRooms() {
        if (attempts >= MAX_ATTEMPTS) return
        attempts++
        const res = await fetchHotelRoomPrices(hotelId, roomParams)
        if (res.rooms.length > 0) {
          setHotel((prev) => prev ? { ...prev, rooms: mapRooms(res.rooms) } : prev)
        }
        if (!res.completed) {
          setTimeout(pollRooms, 3000)
        }
      }
      pollRooms()
    }

    load().catch(() => {
      setNotFound(true)
      setLoading(false)
    })
  }, [hotelId, search.destinationId, search.checkIn, search.checkOut, search.adults, search.rooms])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Navbar />
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <HotelCardSkeleton />
          <HotelCardSkeleton />
        </div>
        <Footer />
      </div>
    )
  }

  if (notFound || !hotel) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Navbar />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            We can&apos;t find that stay
          </h1>
          <p className="text-sm text-muted">
            It may have been removed, or the link is incorrect.
          </p>
          <Link
            to="/hotels"
            search={search}
            className={cn(buttonVariants({ variant: 'primary' }), 'mt-2')}
          >
            Back to all stays
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  const cheapest = [...hotel.rooms].sort(
    (a, b) => a.pricePerNight - b.pricePerNight,
  )[0]
  const nights = nightsBetween(search.checkIn, search.checkOut)
  const hasValidCoords = hotel.lat !== 0 && hotel.lng !== 0

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1.5 text-sm text-muted">
          <Link to="/" className="hover:text-ink">
            Home
          </Link>
          <span>/</span>
          <Link to="/hotels" search={search} className="hover:text-ink">
            Hotels
          </Link>
          <span>/</span>
          <span className="text-ink">{hotel.name}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">
              {hotel.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <StarRating rating={hotel.starRating} size={16} />
              <span className="flex items-center gap-1 text-sm text-muted">
                <MapPin className="h-4 w-4" />
                {hotel.address}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RatingPill
              score={hotel.guestRating}
              reviewCount={hotel.reviewCount}
            />
            <button
              type="button"
              aria-label="Share this hotel"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted hover:bg-surface"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Save this hotel"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted hover:bg-surface"
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-6">
          <Gallery images={hotel.images} alt={hotel.name} />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {hotel.description && (
              <section>
                <h2 className="font-display text-xl font-bold text-ink">
                  About this hotel
                </h2>
                <div
                  className="mt-3 text-sm leading-relaxed text-muted [&_p]:mt-2 [&_br]:hidden"
                  dangerouslySetInnerHTML={{ __html: hotel.description }}
                />
              </section>
            )}

            {hotel.facilities.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-ink">
                  Amenities
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {hotel.facilities.map((key) => {
                    const facility = FACILITY_MAP[key]
                    if (!facility) return null
                    const Icon = facility.icon
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-2.5 rounded-btn bg-surface px-3 py-2.5 text-sm text-ink"
                      >
                        <Icon
                          className="h-4 w-4 text-accent"
                          strokeWidth={1.75}
                        />
                        {facility.label}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section>
              <h2 className="font-display text-xl font-bold text-ink">
                Location
              </h2>
              <div className="mt-4 overflow-hidden rounded-card border border-border">
                {hasValidCoords ? (
                  <iframe
                    title={`${hotel.name} location`}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${hotel.lng - 0.01},${hotel.lat - 0.01},${hotel.lng + 0.01},${hotel.lat + 0.01}&layer=mapnik&marker=${hotel.lat},${hotel.lng}`}
                    className="h-64 w-full border-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center bg-surface text-sm text-muted">
                    Location not available
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border bg-white px-4 py-3">
                  <p className="text-sm text-ink">{hotel.address}</p>
                  {hasValidCoords && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${hotel.lat}&mlon=${hotel.lng}&zoom=15`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-accent hover:underline"
                    >
                      Get directions
                    </a>
                  )}
                </div>
              </div>
            </section>

            {hotel.guestRating > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-ink">
                  Guest reviews
                </h2>
                <div className="mt-4 flex flex-col gap-6 sm:flex-row">
                  <div className="flex shrink-0 flex-col items-center justify-center rounded-card border border-border bg-surface px-6 py-5 sm:w-40">
                    <p className="font-display text-3xl font-bold text-navy">
                      {hotel.guestRating.toFixed(1)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {guestRatingLabel(hotel.guestRating)}
                    </p>
                  </div>
                  {hotel.ratingBreakdown.length > 0 && (
                    <div className="flex-1 space-y-2.5">
                      {hotel.ratingBreakdown.map((item) => (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className="w-24 text-sm text-muted">
                            {item.label}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${(item.score / 10) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-sm font-semibold text-ink">
                            {item.score.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {hotel.reviews.length > 0 && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {hotel.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-card border border-border bg-white p-4"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-light text-sm font-semibold text-accent-dark">
                            {review.name.charAt(0)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {review.name}
                            </p>
                            <p className="text-xs text-muted">
                              {formatDateShort(review.date)}
                            </p>
                          </div>
                          <span className="ml-auto rounded-md bg-navy px-1.5 py-0.5 text-xs font-bold text-white">
                            {review.rating.toFixed(1)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-muted">
                          &ldquo;{review.comment}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-card border border-border bg-white p-5 shadow-sm">
              <p className="text-sm text-muted">Prices from</p>
              <p className="font-display text-2xl font-bold text-ink">
                {formatCurrency(cheapest.pricePerNight)}
                <span className="text-sm font-normal text-muted"> / night</span>
              </p>
              <div className="mt-3 space-y-1.5 text-sm text-muted">
                <p>
                  {formatDateShort(search.checkIn)} –{' '}
                  {formatDateShort(search.checkOut)} · {nights} night
                  {nights !== 1 ? 's' : ''}
                </p>
                <p>
                  {formatGuestsSummary(
                    search.adults,
                    search.childrenCount,
                    search.rooms,
                  )}
                </p>
              </div>
              <a
                href="#rooms"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'lg' }),
                  'mt-4 w-full',
                )}
              >
                See availability
              </a>
              {hotel.freeCancellationUntilDays > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Free cancellation available
                </p>
              )}
            </div>
          </aside>
        </div>

        <section id="rooms" className="mt-12">
          <h2 className="font-display text-xl font-bold text-ink">
            Choose your room
          </h2>
          <div className="mt-4 space-y-4">
            {hotel.rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                hotelId={hotel.id}
                hotelName={hotel.name}
                hotelImage={hotel.images[0] ?? ''}
                hotelAddress={hotel.address}
                search={search}
              />
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
