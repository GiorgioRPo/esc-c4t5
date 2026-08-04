// Shared setup for the Vitest suites.
//
// The timezone is pinned to UTC in vitest.config.ts so that date helpers behave
// identically on every machine and in CI. Individual cases that need another
// zone (UT-04) override it through `withTimeZone` in tests/helpers/timezone.ts
// and restore UTC afterwards.
import { afterEach, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
