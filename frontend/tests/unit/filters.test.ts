/**
 * Test plan section 1.4 — unit tests for `applyFilters` in
 * `frontend/src/components/hotels/FilterSidebar.tsx` (UT-25..UT-30).
 *
 * The price predicate is skipped when `maxPrice` is at `PRICE_MAX` (the slider's
 * maximum), so a hotel priced above 500 is only excluded once the filter is actually
 * lowered. Every fixture hotel here is priced well under 500, and each exclusion case
 * (UT-26, UT-28, UT-29) carries a positive control in the same test so the exclusion is
 * attributable to the predicate under test, not an accident of the price filter.
 */
import { describe, expect, it } from 'vitest'

import { DEFAULT_FILTERS, applyFilters } from '@/components/hotels/FilterSidebar'
import { makeHotel, makeRoom } from '../helpers/hotels'

describe('UT-25 star filter membership', () => {
  it('is exact set membership, and an empty selection disables it', () => {
    const threeStar = makeHotel({ id: 'h3', starRating: 3 })
    const fourStar = makeHotel({ id: 'h4', starRating: 4 })

    expect(
      applyFilters([threeStar, fourStar], { ...DEFAULT_FILTERS, starRatings: [4] }),
    ).toEqual([fourStar])

    expect(
      applyFilters([threeStar, fourStar], { ...DEFAULT_FILTERS, starRatings: [] }),
    ).toEqual([threeStar, fourStar])
  })
})

describe('UT-26 fractional star ratings', () => {
  it('matches no checkbox, though the hotel is otherwise retained', () => {
    const hotel = makeHotel({ starRating: 4.5 })

    expect(
      applyFilters([hotel], { ...DEFAULT_FILTERS, starRatings: [4] }),
    ).toEqual([])
    expect(
      applyFilters([hotel], { ...DEFAULT_FILTERS, starRatings: [5] }),
    ).toEqual([])
    // Control: with the star filter off, the same hotel is retained — the exclusions
    // above are attributable to the star filter, not to price or another predicate.
    expect(
      applyFilters([hotel], { ...DEFAULT_FILTERS, starRatings: [] }),
    ).toEqual([hotel])
  })
})

describe('UT-27 guest rating threshold', () => {
  it('is a >= comparison and is off at 0', () => {
    const belowThreshold = makeHotel({ id: 'h-7.9', guestRating: 7.9 })
    const atThreshold = makeHotel({ id: 'h-8.0', guestRating: 8.0 })

    expect(
      applyFilters([belowThreshold, atThreshold], {
        ...DEFAULT_FILTERS,
        minGuestRating: 8,
      }),
    ).toEqual([atThreshold])

    expect(
      applyFilters([belowThreshold, atThreshold], {
        ...DEFAULT_FILTERS,
        minGuestRating: 0,
      }),
    ).toEqual([belowThreshold, atThreshold])
  })
})

describe('UT-28 facilities conjunction', () => {
  it('requires every selected facility, not just one', () => {
    const hotel = makeHotel({ facilities: ['wifi'] })

    expect(
      applyFilters([hotel], { ...DEFAULT_FILTERS, facilities: ['wifi', 'pool'] }),
    ).toEqual([])
    // Control: the same hotel matches a filter asking only for what it has.
    expect(
      applyFilters([hotel], { ...DEFAULT_FILTERS, facilities: ['wifi'] }),
    ).toEqual([hotel])
  })
})

describe('UT-29 hotel with no rooms', () => {
  it('is excluded because cheapestPrice() of an empty room list is Infinity', () => {
    const noRooms = makeHotel({ id: 'h-no-rooms', rooms: [] })
    const withRooms = makeHotel({ id: 'h-with-rooms', rooms: [makeRoom()] })

    expect(applyFilters([noRooms, withRooms], DEFAULT_FILTERS)).toEqual([withRooms])
  })
})

describe('UT-30 price ceiling above the slider maximum', () => {
  // The slider cannot be dragged past PRICE_MAX (500), so a `maxPrice` at that value
  // means "no ceiling" rather than "500 is the ceiling" — otherwise no hotel priced
  // above 500 could ever be shown, even under DEFAULT_FILTERS.
  const expensiveHotel = makeHotel({ rooms: [makeRoom({ pricePerNight: 650 })] })

  it('retains a hotel priced above the slider maximum under DEFAULT_FILTERS', () => {
    expect(applyFilters([expensiveHotel], DEFAULT_FILTERS)).toEqual([expensiveHotel])
  })

  it('still excludes it once the slider is actually lowered below its price', () => {
    expect(
      applyFilters([expensiveHotel], { ...DEFAULT_FILTERS, maxPrice: 400 }),
    ).toEqual([])
  })
})
