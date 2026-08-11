/**
 * Test plan section 1.1 — unit tests for `frontend/src/lib/utils.ts` (UT-01..UT-09).
 *
 * The suite runs with TZ pinned to UTC (vitest.config.ts). UT-04 is the one
 * case that moves the process into another zone, and it restores UTC on the way out.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  addDays,
  defaultStaySearch,
  formatGuestsSummary,
  generateBookingRef,
  guestRatingLabel,
  isoDate,
  maskCardNumber,
  nightsBetween,
  pointsForAmount,
} from '@/lib/utils'
import { setTimeZone } from '../helpers/timezone'

describe('UT-01 pointsForAmount across three amounts', () => {
  it('awards 10 points per dollar and rounds half up', () => {
    expect(pointsForAmount(450)).toBe(4500)
    expect(pointsForAmount(450.04)).toBe(4500)
    expect(pointsForAmount(450.05)).toBe(4501)
  })
})

describe('UT-02 nightsBetween for normal, identical and reversed dates', () => {
  it('counts nights correctly', () => {
    expect(nightsBetween('2026-08-01', '2026-08-04')).toBe(3)
  })

  it('clamps identical dates to 1 night', () => {
    // The Math.max(1, ...) clamp is deliberate: a zero-night stay is not
    // bookable, so the helper never reports one.
    expect(nightsBetween('2026-08-01', '2026-08-01')).toBe(1)
  })

  it('clamps reversed dates to 1 night rather than returning a negative', () => {
    expect(nightsBetween('2026-08-04', '2026-08-01')).toBe(1)
  })
})

describe('UT-03 addDays across a month boundary', () => {
  it('crosses from July into August', () => {
    expect(process.env.TZ).toBe('UTC')
    expect(addDays('2026-07-30', 3)).toBe('2026-08-02')
  })
})

describe('UT-04 addDays and isoDate in a UTC+8 zone', () => {
  beforeAll(() => {
    setTimeZone('Asia/Singapore')
  })

  afterAll(() => {
    setTimeZone('UTC')
  })

  it('is actually running east of UTC', () => {
    // Guards the two cases below: without the zone change they would be
    // asserting nothing.
    expect(new Date().getTimezoneOffset()).toBe(-480)
  })

  it('keeps the calendar day when adding and formatting', () => {
    // `isoDate` formats from local date fields and `addDays` parses local midnight, so
    // both agree on the same zone — a call east of UTC no longer loses a day.
    expect(addDays('2026-07-25', 1)).toBe('2026-07-26')
    expect(isoDate(new Date(2026, 7, 10))).toBe('2026-08-10')
  })
})

describe('UT-05 generateBookingRef over 200 unstubbed calls', () => {
  it('holds the reference format and avoids ambiguous characters', () => {
    // Math.random is left alone on purpose: the point is to exercise the real
    // alphabet across many draws.
    const refs = Array.from({ length: 200 }, () => generateBookingRef())

    for (const ref of refs) {
      expect(ref).toMatch(/^ASC-[A-HJ-NP-Y2-9]{6}$/)
    }

    // The alphabet excludes the ambiguous I, O, Z, 0 and 1.
    const observed = new Set(refs.join('').replace(/ASC-/g, ''))
    for (const ambiguous of ['I', 'O', 'Z', '0', '1']) {
      expect(observed.has(ambiguous)).toBe(false)
    }
  })
})

describe('UT-06 maskCardNumber on a full and a short number', () => {
  it('keeps only the last four digits of a full number', () => {
    expect(maskCardNumber('4111111111111111')).toBe('1111')
  })

  it('passes a short number through unmasked', () => {
    expect(maskCardNumber('12')).toBe('12')
  })
})

describe('UT-07 guestRatingLabel at every threshold', () => {
  it.each([
    [9, 'Exceptional'],
    [8.99, 'Excellent'],
    [8, 'Excellent'],
    [7, 'Very Good'],
    [6, 'Good'],
    [5.9, 'Fair'],
  ])('labels %s as %s', (score, label) => {
    // Bands are inclusive at 9, 8, 7 and 6.
    expect(guestRatingLabel(score)).toBe(label)
  })
})

describe('UT-08 defaultStaySearch under a fixed clock', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T00:00:00Z'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('defaults to today plus 14 and today plus 16, 2 adults, 1 room', () => {
    const search = defaultStaySearch()

    expect(search.checkIn).toBe('2026-08-08')
    expect(search.checkOut).toBe('2026-08-10')
    expect(search.adults).toBe(2)
    expect(search.rooms).toBe(1)
  })
})

describe('UT-09 formatGuestsSummary pluralisation', () => {
  it('uses singular forms for one guest and one room', () => {
    expect(formatGuestsSummary(1, 0, 1)).toBe('1 guest · 1 room')
  })

  it('pluralises guests and rooms independently, folding children into the guest total', () => {
    expect(formatGuestsSummary(2, 1, 2)).toBe('3 guests · 2 rooms')
  })
})
