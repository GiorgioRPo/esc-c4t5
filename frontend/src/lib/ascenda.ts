import type { Hotel, RoomType } from '@/lib/types'

const BASE = '/ascenda-api'

export interface AscendaDestination {
  term: string
  value: string
  type: string
  lat: number
  lng: number
}

export interface AscendaHotel {
  id: string
  name: string
  address: string
  address1?: string
  rating: number
  latitude: number
  longitude: number
  description?: string
  amenities?: Record<string, boolean>
  image_details?: { prefix: string; count: number; suffix: string }
  trustyou?: { score?: { overall?: number; kaligo_overall?: number } }
}

export interface AscendaHotelPrice {
  id: string
  searchRank: number
  lowest_price: number
  converted_price: number
  lowest_converted_price: number
  free_cancellation: boolean
  rooms_available: number
}

export interface AscendaPricesResponse {
  completed: boolean
  currency: string
  hotels: AscendaHotelPrice[]
}

export async function searchDestinations(name: string): Promise<AscendaDestination[]> {
  if (!name.trim()) return []
  const res = await fetch(`${BASE}/api/destinations?name=${encodeURIComponent(name)}`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchHotels(destinationId: string): Promise<AscendaHotel[]> {
  const res = await fetch(`${BASE}/api/hotels?destination_id=${destinationId}`)
  if (!res.ok) return []
  return res.json()
}

export function buildGuestsParam(adults: number, rooms: number): string {
  return Array(rooms).fill(adults).join('|')
}

export interface AscendaRoom {
  key: string
  roomNormalizedDescription: string
  free_cancellation: boolean
  description: string
  long_description?: string
  images?: Array<{ url: string } | string>
  amenities?: string[]
  price: number
}

export interface AscendaHotelDetailResponse {
  completed: boolean
  currency: string
  rooms: AscendaRoom[]
}

export async function fetchHotelRoomPrices(
  hotelId: string,
  params: {
    destinationId: string
    checkIn: string
    checkOut: string
    adults: number
    rooms: number
  },
): Promise<AscendaHotelDetailResponse> {
  const q = new URLSearchParams({
    destination_id: params.destinationId,
    checkin: params.checkIn,
    checkout: params.checkOut,
    lang: 'en_US',
    currency: 'USD',
    country_code: 'US',
    guests: buildGuestsParam(params.adults, params.rooms),
    partner_id: '1089',
    landing_page: 'wl-acme-earn',
    product_type: 'earn',
  })
  const res = await fetch(`${BASE}/api/hotels/${hotelId}/price?${q}`)
  if (!res.ok) return { completed: true, currency: 'USD', rooms: [] }
  return res.json()
}

export function mapRooms(apiRooms: AscendaRoom[]): RoomType[] {
  return apiRooms.map((r) => {
    let image = ''
    if (Array.isArray(r.images) && r.images.length > 0) {
      const first = r.images[0]
      image = typeof first === 'string' ? first : first.url
    }
    return {
      id: r.key,
      name: r.roomNormalizedDescription || r.description || 'Standard Room',
      bedType: 'Room',
      sizeSqm: 0,
      maxOccupancy: 2,
      pricePerNight: r.price,
      freeCancellation: r.free_cancellation,
      breakfastIncluded: (r.amenities ?? []).some((a) =>
        a.toLowerCase().includes('breakfast'),
      ),
      image,
      perks: [
        ...(r.free_cancellation ? ['Free cancellation'] : []),
        ...(r.amenities ?? []).slice(0, 2),
      ],
    }
  })
}

export async function fetchHotelPrices(params: {
  destinationId: string
  checkIn: string
  checkOut: string
  adults: number
  rooms: number
}): Promise<AscendaPricesResponse> {
  const q = new URLSearchParams({
    destination_id: params.destinationId,
    checkin: params.checkIn,
    checkout: params.checkOut,
    lang: 'en_US',
    currency: 'USD',
    country_code: 'US',
    guests: buildGuestsParam(params.adults, params.rooms),
    partner_id: '1089',
    landing_page: 'wl-acme-earn',
    product_type: 'earn',
  })
  const res = await fetch(`${BASE}/api/hotels/prices?${q}`)
  if (!res.ok) return { completed: true, currency: 'USD', hotels: [] }
  return res.json()
}

export function hotelImages(
  imageDetails: AscendaHotel['image_details'],
  max = 5,
): string[] {
  if (!imageDetails) return []
  const count = Math.min(imageDetails.count, max)
  return Array.from(
    { length: count },
    (_, i) => `${imageDetails.prefix}${i + 1}${imageDetails.suffix}`,
  )
}

const AMENITY_KEY_MAP: Record<string, string> = {
  airConditioning: 'ac',
  outdoorPool: 'pool',
  indoorPool: 'pool',
  gym: 'gym',
  fitnessCenter: 'gym',
  restaurant: 'restaurant',
  bar: 'bar',
  parkingGarage: 'parking',
  continentalBreakfast: 'breakfast',
  wifi: 'wifi',
  petFriendly: 'pet-friendly',
}

export function mapAmenities(amenities: Record<string, boolean> = {}): string[] {
  const result = new Set<string>()
  for (const [key, enabled] of Object.entries(amenities)) {
    if (enabled && AMENITY_KEY_MAP[key]) result.add(AMENITY_KEY_MAP[key])
  }
  return [...result]
}

export function mapToHotel(apiHotel: AscendaHotel, priceData: AscendaHotelPrice): Hotel {
  const images = hotelImages(apiHotel.image_details, 5)
  const guestRating = apiHotel.trustyou?.score?.overall
    ? apiHotel.trustyou.score.overall / 10
    : 0

  const room: RoomType = {
    id: 'best-rate',
    name: 'Best Available Rate',
    bedType: 'Room',
    sizeSqm: 0,
    maxOccupancy: 2,
    pricePerNight: priceData.lowest_converted_price,
    freeCancellation: priceData.free_cancellation,
    breakfastIncluded: false,
    image: images[0] ?? '',
    perks: priceData.free_cancellation ? ['Free cancellation'] : [],
  }

  return {
    id: apiHotel.id,
    name: apiHotel.name,
    city: apiHotel.address,
    country: '',
    address: apiHotel.address,
    starRating: apiHotel.rating ?? 0,
    guestRating,
    reviewCount: 0,
    description: apiHotel.description ?? '',
    facilities: mapAmenities(apiHotel.amenities),
    images,
    rooms: [room],
    reviews: [],
    ratingBreakdown: [],
    freeCancellationUntilDays: priceData.free_cancellation ? 1 : 0,
    lat: apiHotel.latitude,
    lng: apiHotel.longitude,
  }
}
