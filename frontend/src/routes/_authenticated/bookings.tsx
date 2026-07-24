import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { HotelImage } from '@/components/ui/HotelImage'
import { supabase } from '@/lib/supabase'
import { fetchHotels } from '@/lib/ascenda'
import {
  formatCurrency,
  formatDateLong,
  formatGuestsSummary,
  nightsBetween,
} from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/bookings')({
  component: Bookings,
})

interface BookingRecord {
  id: string
  destination_id: string
  hotel_id: string
  start_date: string
  end_date: string
  adults: number
  children: number
  message_to_hotel?: string
  room_types: string[]
  price_paid: number
  created_at: string
}

function Bookings() {
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [hotelNames, setHotelNames] = useState<Record<string, string>>({})
  const [hotelImages, setHotelImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setError('Not signed in.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/bookings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        setError('Failed to load bookings.')
        setLoading(false)
        return
      }

      const data: BookingRecord[] = await res.json()
      setBookings(data)

      const uniqueDestinations = [...new Set(data.map((b) => b.destination_id))]
      const nameMap: Record<string, string> = {}
      const imageMap: Record<string, string> = {}

      await Promise.all(
        uniqueDestinations.map(async (destId) => {
          const hotels = await fetchHotels(destId)
          for (const h of hotels) {
            nameMap[h.id] = h.name
            if (h.image_details) {
              imageMap[h.id] = `${h.image_details.prefix}1${h.image_details.suffix}`
            }
          }
        }),
      )

      setHotelNames(nameMap)
      setHotelImages(imageMap)
      setLoading(false)
    }

    load().catch(() => {
      setError('Something went wrong.')
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl font-bold text-ink">My bookings</h1>

        {loading && (
          <div className="mt-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-card bg-surface"
              />
            ))}
          </div>
        )}

        {error && (
          <p className="mt-8 text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <CalendarCheck className="h-12 w-12 text-muted" strokeWidth={1.25} />
            <p className="font-display text-lg font-bold text-ink">
              No bookings yet
            </p>
            <p className="text-sm text-muted">
              Your confirmed stays will appear here.
            </p>
            <Link
              to="/"
              className="mt-2 text-sm font-semibold text-accent hover:underline"
            >
              Start searching
            </Link>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div className="mt-6 space-y-3">
            {bookings.map((b) => {
              const hotelName = hotelNames[b.hotel_id] ?? b.hotel_id
              const hotelImage = hotelImages[b.hotel_id] ?? ''
              const startDate = b.start_date.slice(0, 10)
              const endDate = b.end_date.slice(0, 10)
              const nights = nightsBetween(startDate, endDate)
              const isExpanded = expanded === b.id

              return (
                <div
                  key={b.id}
                  className="rounded-card border border-border bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : b.id)}
                    className="flex w-full items-center gap-4 p-4 text-left"
                  >
                    <HotelImage
                      src={hotelImage}
                      alt={hotelName}
                      className="h-16 w-16 shrink-0 rounded-btn"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-ink truncate">
                        {hotelName}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatDateLong(startDate)} – {formatDateLong(endDate)}{' '}
                        · {nights} night{nights !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display font-bold text-ink">
                        {formatCurrency(b.price_paid)}
                      </p>
                      <p className="text-xs text-muted">Total paid</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-4">
                      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                            Booking reference
                          </dt>
                          <dd className="mt-0.5 font-mono font-semibold text-ink">
                            {b.id.slice(0, 8).toUpperCase()}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                            Guests
                          </dt>
                          <dd className="mt-0.5 text-ink">
                            {formatGuestsSummary(b.adults, b.children, 1)}
                          </dd>
                        </div>
                        {b.room_types.length > 0 && (
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                              Room
                            </dt>
                            <dd className="mt-0.5 text-ink">
                              {b.room_types[0]}
                            </dd>
                          </div>
                        )}
                        {b.message_to_hotel && (
                          <div className="sm:col-span-2">
                            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                              Special requests
                            </dt>
                            <dd className="mt-0.5 text-ink">
                              {b.message_to_hotel}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                            Booked on
                          </dt>
                          <dd className="mt-0.5 text-ink">
                            {formatDateLong(b.created_at.slice(0, 10))}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
