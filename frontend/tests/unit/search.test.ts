/**
 * Test plan section 1.2 — unit tests for `frontend/src/lib/search.ts` (UT-10..UT-15).
 *
 * UT-11, UT-13 and UT-14 depend on `defaultStaySearch()`, which reads the real clock, so the
 * system time is pinned per test (`beforeEach`, not `beforeAll` — the shared setup's
 * `afterEach` restores real timers, so a `beforeAll` fake clock would only survive the first
 * `it` in each describe).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  parseBookingSearch,
  parseConfirmationSearch,
  parseStaySearch,
} from '@/lib/search'
import { defaultStaySearch } from '@/lib/utils'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-25T00:00:00Z'))
})

describe('UT-10 parseStaySearch number coercion', () => {
  it('coerces numeric strings from the URL into numbers', () => {
    const result = parseStaySearch({ adults: '3', rooms: '2' })
    expect(result.adults).toBe(3)
    expect(result.rooms).toBe(2)
  })

  it('falls back to the default when a numeric string is unparseable', () => {
    const result = parseStaySearch({ adults: 'abc' })
    expect(result.adults).toBe(2)
  })
})

describe('UT-11 parseStaySearch fallback on absent and empty fields', () => {
  it('yields the computed default checkIn for a missing key', () => {
    const result = parseStaySearch({})
    expect(result.checkIn).toBe(defaultStaySearch().checkIn)
  })

  it('yields the computed default checkIn for an empty string, not the empty value', () => {
    const result = parseStaySearch({ checkIn: '' })
    expect(result.checkIn).toBe(defaultStaySearch().checkIn)
  })
})

describe('UT-12 parseStaySearch accepts invalid values', () => {
  it('preserves out-of-range and reversed values verbatim', () => {
    // No minimum, range or ordering check exists, which is why UC03 validateDates has
    // nothing to test at this layer.
    const result = parseStaySearch({
      adults: -5,
      checkIn: '2026-09-01',
      checkOut: '2026-08-01',
    })
    expect(result.adults).toBe(-5)
    expect(result.checkIn).toBe('2026-09-01')
    expect(result.checkOut).toBe('2026-08-01')
  })
})

describe('UT-13 parseBookingSearch defaults', () => {
  it('defaults the room name sensibly and the price to a bookable-at-zero-dollars value', () => {
    const result = parseBookingSearch({})
    expect(result.roomName).toBe('Standard Room')
    expect(result.pricePerNight).toBe(0)
  })
})

describe('UT-14 parseConfirmationSearch derived totals', () => {
  it('derives total as subtotal plus 12 percent and points from that total', () => {
    const result = parseConfirmationSearch({
      pricePerNight: 100,
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      rooms: 1,
    })
    expect(result.total).toBe(224)
    expect(result.points).toBe(2240)
  })
})

describe('UT-15 parseConfirmationSearch reference handling', () => {
  it('keeps a supplied ref as-is', () => {
    const result = parseConfirmationSearch({ ref: 'ASC-ABC234' })
    expect(result.ref).toBe('ASC-ABC234')
  })

  it('mints a different ref on every parse when none is supplied', () => {
    const first = parseConfirmationSearch({})
    const second = parseConfirmationSearch({})
    expect(first.ref).not.toBe(second.ref)
  })
})
