/**
 * Test plan section 1.3 — unit tests for `frontend/src/lib/ascenda.ts` (UT-16..UT-24).
 *
 * `fetch` is stubbed with `vi.stubGlobal`, which the shared setup's `afterEach` now undoes
 * via `vi.unstubAllGlobals()` (tests/setup.ts).
 */
import { describe, expect, it, vi } from 'vitest'

import {
  buildGuestsParam,
  fetchHotelPrices,
  fetchHotels,
  hotelImages,
  mapAmenities,
  mapRooms,
  mapToHotel,
  searchDestinations,
} from '@/lib/ascenda'
import type { AscendaHotel, AscendaHotelPrice, AscendaRoom } from '@/lib/ascenda'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('UT-16 buildGuestsParam for multiple and single rooms', () => {
  it('repeats adults once per room', () => {
    expect(buildGuestsParam(2, 3)).toBe('2|2|2')
  })

  it('carries a single room through unchanged', () => {
    expect(buildGuestsParam(4, 1)).toBe('4')
  })
})

describe('UT-17 fetchHotelPrices drops children from the query', () => {
  it('carries guests for adults and rooms only, with no children parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ completed: true, currency: 'USD', hotels: [] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    // Children are collected in the UI but the fetchHotelPrices params type has no slot
    // for them, so a caller that has 3 children selected still cannot pass them through.
    const paramsWithChildren = {
      destinationId: 'dest-1',
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      adults: 2,
      rooms: 1,
      childrenCount: 3,
    }
    await fetchHotelPrices(paramsWithChildren)

    const calledUrl = fetchMock.mock.calls[0][0] as string
    const q = new URL(calledUrl, 'http://localhost').searchParams
    expect(q.get('guests')).toBe('2')
    expect(q.has('children')).toBe(false)
    expect(q.has('childrenCount')).toBe(false)
  })
})

describe('UT-18 fetchHotelPrices query contract', () => {
  it('carries every partner parameter the API requires', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ completed: true, currency: 'USD', hotels: [] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchHotelPrices({
      destinationId: 'dest-42',
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      adults: 2,
      rooms: 1,
    })

    const calledUrl = fetchMock.mock.calls[0][0] as string
    const q = new URL(calledUrl, 'http://localhost').searchParams
    expect(q.get('destination_id')).toBe('dest-42')
    expect(q.get('checkin')).toBe('2026-08-01')
    expect(q.get('checkout')).toBe('2026-08-03')
    expect(q.get('lang')).toBe('en_US')
    expect(q.get('currency')).toBe('USD')
    expect(q.get('country_code')).toBe('US')
    expect(q.get('guests')).toBe('2')
    expect(q.get('partner_id')).toBe('1089')
    expect(q.get('landing_page')).toBe('wl-acme-earn')
    expect(q.get('product_type')).toBe('earn')
  })
})

describe('UT-19 hotelImages indexing, cap and absent details', () => {
  it('builds 1-indexed URLs under the cap', () => {
    expect(hotelImages({ prefix: 'p/', count: 3, suffix: '.jpg' })).toEqual([
      'p/1.jpg',
      'p/2.jpg',
      'p/3.jpg',
    ])
  })

  it('caps the list at max when count exceeds it', () => {
    expect(
      hotelImages({ prefix: 'x/', count: 20, suffix: '.png' }),
    ).toHaveLength(5)
  })

  it('returns nothing for a missing image_details block', () => {
    expect(hotelImages(undefined)).toEqual([])
  })
})

describe('UT-20 mapAmenities mapping rules', () => {
  it('collapses pool variants to one key', () => {
    expect(mapAmenities({ outdoorPool: true, indoorPool: true })).toEqual(['pool'])
  })

  it('drops unknown and false entries', () => {
    expect(mapAmenities({ spaceship: true, wifi: false, gym: true })).toEqual(['gym'])
  })
})

function makeAscendaHotel(overrides: Partial<AscendaHotel> = {}): AscendaHotel {
  return {
    id: 'hotel-1',
    name: 'Test Hotel',
    address: '1 Test Street',
    rating: 4,
    latitude: 1.3,
    longitude: 103.8,
    ...overrides,
  }
}

function makePriceData(overrides: Partial<AscendaHotelPrice> = {}): AscendaHotelPrice {
  return {
    id: 'hotel-1',
    searchRank: 1,
    lowest_price: 150,
    converted_price: 150,
    lowest_converted_price: 150,
    free_cancellation: true,
    rooms_available: 5,
    ...overrides,
  }
}

describe('UT-21 mapToHotel guest rating', () => {
  it('divides the TrustYou overall score by 10', () => {
    const hotel = makeAscendaHotel({ trustyou: { score: { overall: 87 } } })
    expect(mapToHotel(hotel, makePriceData()).guestRating).toBe(8.7)
  })

  it('gives 0 when the trustyou block is absent', () => {
    const hotel = makeAscendaHotel()
    expect(mapToHotel(hotel, makePriceData()).guestRating).toBe(0)
  })
})

function makeAscendaRoom(overrides: Partial<AscendaRoom> = {}): AscendaRoom {
  return {
    key: 'room-1',
    roomNormalizedDescription: '',
    free_cancellation: true,
    description: '',
    price: 150,
    ...overrides,
  }
}

describe('UT-22 mapRooms naming and breakfast detection', () => {
  it('falls through to description when the normalised name is absent', () => {
    const [room] = mapRooms([makeAscendaRoom({ description: 'Deluxe' })])
    expect(room.name).toBe('Deluxe')
  })

  it('falls through to the literal default when neither name is present', () => {
    const [room] = mapRooms([makeAscendaRoom()])
    expect(room.name).toBe('Standard Room')
  })

  it('matches breakfast case-insensitively among amenities', () => {
    const [room] = mapRooms([
      makeAscendaRoom({ amenities: ['Free BREAKFAST buffet'] }),
    ])
    expect(room.breakfastIncluded).toBe(true)
  })
})

describe('UT-23 fetchHotels and fetchHotelPrices on a non-OK response', () => {
  // KNOWN DEFECT — the plan expects a non-OK response to reject, so the caller can tell an
  // outage apart from a destination with no hotels. Neither function does: fetchHotels
  // returns `[]` and fetchHotelPrices returns a completed-empty payload. Marked `.fails`
  // per the UT-04 convention (section 1.1) so the defect is recorded without turning the
  // suite red. Written as two separate blocks: a single block would short-circuit on the
  // first failing assertion and never exercise the second function.

  it.fails('fetchHotels should reject rather than resolve empty on a 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    await expect(fetchHotels('dest-1')).rejects.toThrow()
  })

  it('records that fetchHotels resolves empty on a 500 today', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    await expect(fetchHotels('dest-1')).resolves.toEqual([])
  })

  it.fails(
    'fetchHotelPrices should reject rather than resolve completed-empty on a 503',
    async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)))
      await expect(
        fetchHotelPrices({
          destinationId: 'dest-1',
          checkIn: '2026-08-01',
          checkOut: '2026-08-03',
          adults: 2,
          rooms: 1,
        }),
      ).rejects.toThrow()
    },
  )

  it('records that fetchHotelPrices resolves completed-empty on a 503 today', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)))
    await expect(
      fetchHotelPrices({
        destinationId: 'dest-1',
        checkIn: '2026-08-01',
        checkOut: '2026-08-03',
        adults: 2,
        rooms: 1,
      }),
    ).resolves.toEqual({ completed: true, currency: 'USD', hotels: [] })
  })
})

describe('UT-24 searchDestinations guard clauses', () => {
  it('costs no request for blank input', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await searchDestinations('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('degrades quietly when the suggestion lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    expect(await searchDestinations('tokyo')).toEqual([])
  })
})
