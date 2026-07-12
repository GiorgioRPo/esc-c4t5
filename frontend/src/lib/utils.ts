import type { StaySearch } from '@/lib/types'

export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPoints(points: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(points))
}

export function pointsForAmount(amount: number): number {
  return Math.round(amount * 10)
}

const DATE_FORMAT_SHORT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
}

const DATE_FORMAT_LONG: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}

export function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(
    'en-US',
    DATE_FORMAT_SHORT,
  )
}

export function formatDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(
    'en-US',
    DATE_FORMAT_LONG,
  )
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00`).getTime()
  const b = new Date(`${checkOut}T00:00:00`).getTime()
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)))
}

const BOOKING_REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXY23456789'

export function generateBookingRef(): string {
  let ref = 'ASC-'
  for (let i = 0; i < 6; i++) {
    ref +=
      BOOKING_REF_CHARS[Math.floor(Math.random() * BOOKING_REF_CHARS.length)]
  }
  return ref
}

export function maskCardNumber(digits: string): string {
  return digits.slice(-4)
}

export function guestRatingLabel(score: number): string {
  if (score >= 9) return 'Exceptional'
  if (score >= 8) return 'Excellent'
  if (score >= 7) return 'Very Good'
  if (score >= 6) return 'Good'
  return 'Fair'
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function searchFieldClass(size: 'lg' | 'md' = 'lg'): string {
  return cn(
    'flex items-center gap-2.5 rounded-btn border border-border bg-white px-3.5 transition-colors focus-within:border-accent',
    size === 'lg' ? 'h-14' : 'h-11',
  )
}

export function formatGuestsSummary(
  adults: number,
  childrenCount: number,
  rooms: number,
): string {
  const guestTotal = adults + childrenCount
  const guestLabel = `${guestTotal} guest${guestTotal !== 1 ? 's' : ''}`
  const roomLabel = `${rooms} room${rooms !== 1 ? 's' : ''}`
  return `${guestLabel} · ${roomLabel}`
}

export function defaultStaySearch(): StaySearch {
  const today = isoDate(new Date())
  return {
    destination: '',
    destinationId: '',
    checkIn: addDays(today, 14),
    checkOut: addDays(today, 16),
    adults: 2,
    childrenCount: 0,
    rooms: 1,
  }
}
