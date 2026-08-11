/**
 * Test plan section 1.5 — unit tests for results sorting and booking arithmetic
 * (UT-31..UT-37).
 *
 * Subjects: `frontend/src/lib/sorting.ts`, `frontend/src/lib/pricing.ts`, and the two input
 * formatters exported from the booking route (`formatCardNumberInput`,
 * `formatExpiryInput`). These were extracted/exported for testability per the plan's day-1
 * scheduled task; see docs/TEST_PLAN.md section 1.5.
 */
import { describe, expect, it } from 'vitest'

import { cheapestPrice, sortHotels } from '@/lib/sorting'
import { computeStayTotals } from '@/lib/pricing'
import {
  formatCardNumberInput,
  formatExpiryInput,
} from '@/routes/_authenticated/booking'
import { makeHotel, makeRoom } from '../helpers/hotels'

describe('UT-31 cheapestPrice for populated and empty room lists', () => {
  it('returns the minimum room price', () => {
    const hotel = makeHotel({
      rooms: [
        makeRoom({ pricePerNight: 300 }),
        makeRoom({ pricePerNight: 150 }),
        makeRoom({ pricePerNight: 220 }),
      ],
    })
    expect(cheapestPrice(hotel)).toBe(150)
  })

  it('is sentinel-valued for an empty room list', () => {
    const hotel = makeHotel({ rooms: [] })
    expect(cheapestPrice(hotel)).toBe(Infinity)
  })
})

describe('UT-32 sortHotels by ascending price', () => {
  it('orders by cheapest room, not by list position', () => {
    const cheap = makeHotel({ id: 'cheap', rooms: [makeRoom({ pricePerNight: 100 })] })
    const mid = makeHotel({ id: 'mid', rooms: [makeRoom({ pricePerNight: 200 })] })
    const pricey = makeHotel({ id: 'pricey', rooms: [makeRoom({ pricePerNight: 300 })] })

    const sorted = sortHotels([pricey, cheap, mid], 'price-asc')
    expect(sorted.map((h) => h.id)).toEqual(['cheap', 'mid', 'pricey'])
  })
})

describe("UT-33 recommended and rating-desc compared", () => {
  it('produce identical arrays, since there is no recommended branch', () => {
    const hotels = Array.from({ length: 5 }, (_, i) =>
      makeHotel({ id: `h${i}`, guestRating: 5 + i }),
    )

    // sortHotels returns a fresh `[...hotels]`, so the two results are equal in content
    // but not the same array reference — toEqual, not toBe.
    expect(sortHotels(hotels, 'recommended')).toEqual(
      sortHotels(hotels, 'rating-desc'),
    )
  })
})

describe('UT-34 formatCardNumberInput grouping', () => {
  it('groups digits in fours', () => {
    expect(formatCardNumberInput('4111111111111111')).toBe('4111 1111 1111 1111')
  })

  it('leaves no trailing space on a partial group', () => {
    expect(formatCardNumberInput('411111')).toBe('4111 11')
  })
})

describe('UT-35 formatExpiryInput slash insertion', () => {
  it('inserts the separator only after the second digit', () => {
    expect(formatExpiryInput('0')).toBe('0')
    expect(formatExpiryInput('08')).toBe('08')
    expect(formatExpiryInput('0827')).toBe('08/27')
  })
})

describe('UT-36 computeStayTotals money path', () => {
  it('computes subtotal by price by nights by rooms, and tax as 12 percent rounded', () => {
    const totals = computeStayTotals(200, 3, 2)
    expect(totals.subtotal).toBe(1200)
    expect(totals.taxesAndFees).toBe(144)
    expect(totals.total).toBe(1344)
  })
})

describe('UT-37 points from the tax-inclusive total', () => {
  it('accrues on what the guest actually pays, not on the subtotal', () => {
    const totals = computeStayTotals(200, 3, 2)
    expect(totals.total).toBe(1344)
    expect(totals.points).toBe(13440)
  })
})
