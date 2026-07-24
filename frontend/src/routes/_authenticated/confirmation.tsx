import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CalendarCheck,
  CheckCircle2,
  Copy,
  CreditCard,
  Gem,
  Mail,
  Printer,
  RotateCcw,
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { StepIndicator } from '@/components/booking/StepIndicator'
import { HotelImage } from '@/components/ui/HotelImage'
import { Button } from '@/components/ui/Button'
import { parseConfirmationSearch } from '@/lib/search'
import {
  formatCurrency,
  formatDateLong,
  formatGuestsSummary,
  formatPoints,
  nightsBetween,
} from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/confirmation')({
  validateSearch: parseConfirmationSearch,
  component: Confirmation,
})

function Confirmation() {
  const search = Route.useSearch()
  const [copied, setCopied] = useState(false)

  const nights = nightsBetween(search.checkIn, search.checkOut)
  const subtotal = search.pricePerNight * nights * search.rooms
  const taxesAndFees = Math.max(0, search.total - subtotal)

  function handleCopy() {
    navigator.clipboard.writeText(search.ref).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <StepIndicator current={3} />

        <div className="mt-8 flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success">
            <CheckCircle2 className="h-9 w-9" strokeWidth={1.75} />
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold text-ink">
            Booking confirmed!
          </h1>
          <p className="mt-2 text-sm text-muted">
            A confirmation email is on its way to{' '}
            <span className="font-medium text-ink">{search.email}</span>.
          </p>

          <button
            type="button"
            onClick={handleCopy}
            className="mt-6 flex items-center gap-3 rounded-card border border-border bg-surface px-5 py-3 transition-colors hover:bg-accent-light"
          >
            <div className="text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Booking reference
              </p>
              <p className="font-display text-lg font-bold tracking-wide text-ink">
                {search.ref}
              </p>
            </div>
            <Copy className="h-4 w-4 text-accent" />
            {copied && (
              <span className="text-xs font-semibold text-success">
                Copied!
              </span>
            )}
          </button>
        </div>

        <div className="mt-10 rounded-card border border-accent-light bg-accent-light px-5 py-4">
          <p className="flex items-center gap-2 font-display font-bold text-accent-dark">
            <Gem className="h-5 w-5" />
            You&apos;ve earned {formatPoints(search.points)} points
          </p>
          <p className="mt-1 text-sm text-accent-dark/80">
            They&apos;ll appear in your rewards account within 24 hours and can
            be redeemed on your next stay.
          </p>
        </div>

        <div className="mt-6 rounded-card border border-border bg-white p-5">
          <div className="flex items-center gap-4">
            <HotelImage
              src={search.hotelImage}
              alt={search.hotelName}
              className="h-20 w-20 shrink-0 rounded-btn"
            />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-ink">
                {search.hotelName}
              </p>
              <p className="text-sm text-muted">{search.hotelAddress}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2.5 text-ink">
              <CalendarCheck className="h-4 w-4 text-muted" />
              <span>
                {formatDateLong(search.checkIn)} –{' '}
                {formatDateLong(search.checkOut)} · {nights} night
                {nights !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-ink">{search.roomName}</div>
            <div className="text-ink">
              {formatGuestsSummary(
                search.adults,
                search.childrenCount,
                search.rooms,
              )}
            </div>
            {search.guestName && (
              <div className="text-ink">Guest: {search.guestName}</div>
            )}
          </div>

          <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
            <div className="flex justify-between text-muted">
              <span>
                {formatCurrency(search.pricePerNight)} &times; {nights} night
                {nights !== 1 ? 's' : ''}
                {search.rooms > 1 ? ` × ${search.rooms} rooms` : ''}
              </span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Taxes &amp; fees</span>
              <span>{formatCurrency(taxesAndFees)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-display font-bold text-ink">
              <span>Total charged</span>
              <span>{formatCurrency(search.total)}</span>
            </div>
          </div>

          {search.last4 && (
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-5">
              <CreditCard className="h-5 w-5 text-muted" />
              <div className="text-sm">
                <p className="font-medium text-ink">
                  &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;
                  &bull;&bull;&bull;&bull; {search.last4}
                </p>
                {search.guestName && (
                  <p className="text-muted">{search.guestName}</p>
                )}
              </div>
            </div>
          )}

          <p className="mt-5 flex items-center gap-1.5 border-t border-border pt-5 text-sm text-success">
            <RotateCcw className="h-4 w-4" />
            Free cancellation policies may apply — check your booking terms.
          </p>
        </div>

        <div className="mt-6 rounded-card border border-border bg-surface p-5">
          <p className="font-display text-sm font-bold text-ink">
            What&apos;s next
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              Confirmation sent to {search.email}
            </li>
            <li className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 shrink-0" />
              Manage or cancel this booking anytime under &ldquo;My trips&rdquo;
            </li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print confirmation
          </Button>
          <Link
            to="/"
            className="ml-auto text-sm font-semibold text-accent hover:underline sm:self-center"
          >
            Back to home
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}
