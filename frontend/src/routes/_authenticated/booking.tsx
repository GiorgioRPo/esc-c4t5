import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CreditCard, Lock } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { StepIndicator } from '@/components/booking/StepIndicator'
import { HotelImage } from '@/components/ui/HotelImage'
import { PointsBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getHotelById, HOTELS } from '@/data/hotels'
import { parseBookingSearch } from '@/lib/search'
import {
  formatCurrency,
  formatDateLong,
  generateBookingRef,
  maskCardNumber,
  nightsBetween,
  pointsForAmount,
} from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/booking')({
  validateSearch: parseBookingSearch,
  component: Booking,
})

function formatCardNumberInput(digits: string): string {
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiryInput(digits: string): string {
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function Booking() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const hotel = getHotelById(search.hotelId) ?? HOTELS[0]
  const room = hotel.rooms.find((r) => r.id === search.roomId) ?? hotel.rooms[0]
  const nights = nightsBetween(search.checkIn, search.checkOut)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')

  const subtotal = room.pricePerNight * nights * search.rooms
  const taxesAndFees = Math.round(subtotal * 0.12)
  const total = subtotal + taxesAndFees
  const points = pointsForAmount(total)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate({
      to: '/confirmation',
      search: {
        ...search,
        ref: generateBookingRef(),
        last4: maskCardNumber(cardNumber),
        guestName: `${firstName} ${lastName}`.trim(),
        email,
        total,
        points,
      },
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <StepIndicator current={2} />

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
              <HotelImage
                src={hotel.images[0]}
                alt={hotel.name}
                className="h-16 w-16 shrink-0 rounded-btn"
              />
              <div className="min-w-0">
                <p className="font-display font-bold text-ink">{hotel.name}</p>
                <p className="text-sm text-muted">
                  {room.name} · {formatDateLong(search.checkIn)} –{' '}
                  {formatDateLong(search.checkOut)}
                </p>
              </div>
            </div>

            <div className="rounded-card border border-border bg-white p-6">
              <h2 className="font-display text-lg font-bold text-ink">
                Guest details
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-ink">
                    First name
                  </span>
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink">
                    Last name
                  </span>
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink">Email</span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink">Phone</span>
                  <input
                    required
                    type="tel"
                    className="mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-ink">Country</span>
                  <select
                    required
                    defaultValue=""
                    className="mt-1.5 w-full rounded-btn border border-border bg-white px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                  >
                    <option value="" disabled>
                      Select your country
                    </option>
                    <option>United States</option>
                    <option>United Kingdom</option>
                    <option>Portugal</option>
                    <option>Spain</option>
                    <option>New Zealand</option>
                    <option>Canada</option>
                    <option>Australia</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-ink">
                    Special requests (optional)
                  </span>
                  <textarea
                    rows={3}
                    placeholder="E.g. late check-in, high floor, accessible room"
                    className="mt-1.5 w-full resize-none rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-card border border-border bg-white p-6">
              <h2 className="font-display text-lg font-bold text-ink">
                Payment details
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-ink">
                    Cardholder name
                  </span>
                  <input
                    required
                    className="mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink">
                    Card number
                  </span>
                  <div className="mt-1.5 flex items-center gap-2.5 rounded-btn border border-border px-3.5 py-2.5 focus-within:border-accent">
                    <CreditCard className="h-4 w-4 shrink-0 text-muted" />
                    <input
                      required
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      value={formatCardNumberInput(cardNumber)}
                      onChange={(e) =>
                        setCardNumber(
                          e.target.value.replace(/\D/g, '').slice(0, 16),
                        )
                      }
                      className="w-full bg-transparent text-sm focus:outline-none"
                    />
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-ink">
                      Expiry (MM/YY)
                    </span>
                    <input
                      required
                      inputMode="numeric"
                      placeholder="MM/YY"
                      value={formatExpiryInput(expiry)}
                      onChange={(e) =>
                        setExpiry(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      className="mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-ink">CVC</span>
                    <input
                      required
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="123"
                      className="mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-ink">
                    Billing postal code
                  </span>
                  <input
                    required
                    className="mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                  Save this card for future bookings
                </label>
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                <Lock className="h-3.5 w-3.5" />
                Payments are encrypted and PCI-DSS compliant.
              </p>
            </div>

            {room.freeCancellation && (
              <div className="rounded-card border border-success/30 bg-success-light px-4 py-3 text-sm text-success">
                Free cancellation until {formatDateLong(search.checkIn)} at no
                charge.
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-card border border-border bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-bold text-ink">
                Price summary
              </h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted">
                  <span>
                    {formatCurrency(room.pricePerNight)} &times; {nights} night
                    {nights !== 1 ? 's' : ''}
                    {search.rooms > 1 ? ` × ${search.rooms} rooms` : ''}
                  </span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Taxes &amp; fees</span>
                  <span>{formatCurrency(taxesAndFees)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="font-display font-bold text-ink">Total</span>
                <span className="font-display text-xl font-bold text-ink">
                  {formatCurrency(total)}
                </span>
              </div>
              <PointsBadge points={points} className="mt-3" />
              <Button type="submit" size="lg" className="mt-5 w-full">
                Confirm &amp; pay
              </Button>
              <p className="mt-3 text-center text-xs text-muted">
                By confirming, you agree to Ascenda&apos;s booking terms and the
                property&apos;s policies.
              </p>
            </div>
          </aside>
        </div>
      </form>

      <Footer />
    </div>
  )
}
