// Fixture factories for `Hotel` / `RoomType`, shared by the filters (section 1.4) and
// sorting (section 1.5) suites so each case only sets the field it exercises.
import type { Hotel, RoomType } from '@/lib/types'

export function makeRoom(overrides: Partial<RoomType> = {}): RoomType {
  return {
    id: 'room-1',
    name: 'Standard Room',
    bedType: 'Queen',
    sizeSqm: 25,
    maxOccupancy: 2,
    pricePerNight: 150,
    freeCancellation: true,
    breakfastIncluded: false,
    image: '',
    perks: [],
    ...overrides,
  }
}

export function makeHotel(overrides: Partial<Hotel> = {}): Hotel {
  return {
    id: 'hotel-1',
    name: 'Test Hotel',
    city: 'Singapore',
    country: 'Singapore',
    address: '1 Test Street',
    starRating: 4,
    guestRating: 8,
    reviewCount: 10,
    description: '',
    facilities: [],
    images: [],
    rooms: [makeRoom()],
    reviews: [],
    ratingBreakdown: [],
    freeCancellationUntilDays: 1,
    lat: 1.3,
    lng: 103.8,
    ...overrides,
  }
}
