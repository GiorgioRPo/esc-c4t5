import {
  defaultStaySearch,
  generateBookingRef,
  nightsBetween,
  pointsForAmount,
} from '@/lib/utils'
import type { StaySearch } from '@/lib/types'

function toStringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value))
  )
    return Number(value)
  return fallback
}

export function parseStaySearch(search: Record<string, unknown>): StaySearch {
  const fallback = defaultStaySearch()
  return {
    destination: toStringOr(search.destination, fallback.destination),
    destinationId: toStringOr(search.destinationId, fallback.destinationId),
    checkIn: toStringOr(search.checkIn, fallback.checkIn),
    checkOut: toStringOr(search.checkOut, fallback.checkOut),
    adults: toNumber(search.adults, fallback.adults),
    childrenCount: toNumber(search.childrenCount, fallback.childrenCount),
    rooms: toNumber(search.rooms, fallback.rooms),
  }
}

export interface BookingSearch extends StaySearch {
  hotelId: string
  roomId: string
  hotelName: string
  hotelImage: string
  hotelAddress: string
  roomName: string
  pricePerNight: number
}

export function parseBookingSearch(
  search: Record<string, unknown>,
): BookingSearch {
  const stay = parseStaySearch(search)
  return {
    ...stay,
    hotelId: toStringOr(search.hotelId, ''),
    roomId: toStringOr(search.roomId, ''),
    hotelName: toStringOr(search.hotelName, ''),
    hotelImage: toStringOr(search.hotelImage, ''),
    hotelAddress: toStringOr(search.hotelAddress, ''),
    roomName: toStringOr(search.roomName, 'Standard Room'),
    pricePerNight: toNumber(search.pricePerNight, 0),
  }
}

export interface ConfirmationSearch extends BookingSearch {
  ref: string
  last4: string
  guestName: string
  email: string
  total: number
  points: number
}

export function parseConfirmationSearch(
  search: Record<string, unknown>,
): ConfirmationSearch {
  const booking = parseBookingSearch(search)
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const fallbackSubtotal = booking.pricePerNight * nights * booking.rooms
  const fallbackTotal = fallbackSubtotal + Math.round(fallbackSubtotal * 0.12)
  const total = toNumber(search.total, fallbackTotal)
  return {
    ...booking,
    ref: toStringOr(search.ref, generateBookingRef()),
    last4: toStringOr(search.last4, ''),
    guestName: toStringOr(search.guestName, ''),
    email: toStringOr(search.email, ''),
    total,
    points: toNumber(search.points, pointsForAmount(total)),
  }
}
