/**
 * Test plan section 1.4 — unit tests for `applyFilters` in
 * `frontend/src/components/hotels/FilterSidebar.tsx` (UT-25..UT-30).
 *
 * `applyFilters` runs the price predicate unconditionally, so an exclusion case whose
 * fixture hotel happens to be priced above `PRICE_MAX` would pass for the wrong reason.
 * Every fixture hotel here is priced well under 500, and each exclusion case (UT-26,
 * UT-28, UT-29) carries a positive control in the same test so the exclusion is
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
  it('is excluded because Math.min() of an empty list is Infinity', () => {
    const noRooms = makeHotel({ id: 'h-no-rooms', rooms: [] })
    const withRooms = makeHotel({ id: 'h-with-rooms', rooms: [makeRoom()] })

    expect(applyFilters([noRooms, withRooms], DEFAULT_FILTERS)).toEqual([withRooms])
  })
})

describe('UT-30 price ceiling above the slider maximum', () => {
  // KNOWN DEFECT — the plan states this explicitly: "It is excluded today, so the case
  // fails until the predicate is skipped at the slider maximum or the cap is raised."
  // The price predicate runs unconditionally against PRICE_MAX (500), so no hotel above
  // 500 a night can ever be shown, even under DEFAULT_FILTERS. Marked `.fails` per the
  // UT-04 convention, with a companion recording today's actual (excluding) behaviour.
  const expensiveHotel = makeHotel({ rooms: [makeRoom({ pricePerNight: 650 })] })

  it.fails('should retain a hotel priced above the slider maximum', () => {
    expect(applyFilters([expensiveHotel], DEFAULT_FILTERS)).toEqual([expensiveHotel])
  })

  it('records that such a hotel is excluded today', () => {
    expect(applyFilters([expensiveHotel], DEFAULT_FILTERS)).toEqual([])
  })
})
