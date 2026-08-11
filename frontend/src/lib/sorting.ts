import type { Hotel } from '@/lib/types'

export type SortKey =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc'
  | 'stars-desc'

export function cheapestPrice(hotel: Hotel): number {
  return hotel.rooms.length > 0
    ? Math.min(...hotel.rooms.map((r) => r.pricePerNight))
    : Infinity
}

export function sortHotels(hotels: Hotel[], sort: SortKey): Hotel[] {
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
