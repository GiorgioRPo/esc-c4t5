// Timezone control for date-sensitive cases.
//
// Node picks up `process.env.TZ` on the next Date operation, so reassigning it
// mid-run is enough to move the process into another zone. The suite pins UTC
// globally (see vitest.config.ts); anything that needs a different zone must go
// through here so the previous value is always restored.

export const DEFAULT_TZ = 'UTC'

export function setTimeZone(tz: string): void {
  process.env.TZ = tz
}

/**
 * Runs `fn` with the process in `tz`, restoring the previous zone afterwards
 * even if `fn` throws.
 */
export function withTimeZone<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ
  setTimeZone(tz)
  try {
    return fn()
  } finally {
    process.env.TZ = previous ?? DEFAULT_TZ
  }
}
