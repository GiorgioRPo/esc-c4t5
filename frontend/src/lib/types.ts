export interface RoomType {
  id: string
  name: string
  bedType: string
  sizeSqm: number
  maxOccupancy: number
  pricePerNight: number
  originalPricePerNight?: number
  freeCancellation: boolean
  breakfastIncluded: boolean
  image: string
  perks: string[]
}

export interface Review {
  id: string
  name: string
  date: string
  rating: number
  comment: string
}

export interface RatingBreakdownItem {
  label: string
  score: number
}

export interface Hotel {
  id: string
  name: string
  city: string
  country: string
  address: string
  starRating: number
  guestRating: number
  reviewCount: number
  description: string
  facilities: string[]
  images: string[]
  rooms: RoomType[]
  reviews: Review[]
  ratingBreakdown: RatingBreakdownItem[]
  freeCancellationUntilDays: number
  lat: number
  lng: number
}

export interface StaySearch {
  destination: string
  destinationId: string
  checkIn: string
  checkOut: string
  adults: number
  childrenCount: number
  rooms: number
}
