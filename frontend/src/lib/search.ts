import { HOTELS, getHotelById } from '@/data/hotels'
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
}

export function parseBookingSearch(
  search: Record<string, unknown>,
): BookingSearch {
  const stay = parseStaySearch(search)
  const hotelIdRaw = toStringOr(search.hotelId, HOTELS[0].id)
  const hotel = getHotelById(hotelIdRaw) ?? HOTELS[0]
  const roomIdRaw = toStringOr(search.roomId, hotel.rooms[0].id)
  const roomExists = hotel.rooms.some((r) => r.id === roomIdRaw)
  return {
    ...stay,
    hotelId: hotel.id,
    roomId: roomExists ? roomIdRaw : hotel.rooms[0].id,
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
  const hotel = getHotelById(booking.hotelId) ?? HOTELS[0]
  const room =
    hotel.rooms.find((r) => r.id === booking.roomId) ?? hotel.rooms[0]
  const nights = nightsBetween(booking.checkIn, booking.checkOut)
  const fallbackSubtotal = room.pricePerNight * nights * booking.rooms
  const fallbackTotal = fallbackSubtotal + Math.round(fallbackSubtotal * 0.12)

  const total = toNumber(search.total, fallbackTotal)
  return {
    ...booking,
    ref: toStringOr(search.ref, generateBookingRef()),
    last4: toStringOr(search.last4, '4242'),
    guestName: toStringOr(search.guestName, 'Alex Morgan'),
    email: toStringOr(search.email, 'alex.morgan@example.com'),
    total,
    points: toNumber(search.points, pointsForAmount(total)),
  }
}
