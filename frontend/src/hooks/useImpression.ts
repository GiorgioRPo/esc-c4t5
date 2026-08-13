import { useEffect, useRef } from 'react'

/**
 * Fires once when an element has been meaningfully visible.
 *
 * "Returned by the API" is not an impression -- a card below the fold was
 * never seen. This waits for at least `threshold` of the element to be visible
 * for `dwellMs` continuously, then fires exactly once per mount.
 */
export function useImpression<T extends HTMLElement>(
  onImpression: () => void,
  options: { threshold?: number; dwellMs?: number; enabled?: boolean } = {},
) {
  const { threshold = 0.5, dwellMs = 1000, enabled = true } = options
  const ref = useRef<T | null>(null)
  const firedRef = useRef(false)
  // Held in a ref so a changing callback identity cannot re-trigger the effect
  // and cause duplicate impressions on re-render.
  const callbackRef = useRef(onImpression)
  callbackRef.current = onImpression

  useEffect(() => {
    if (!enabled || firedRef.current) return
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return

    let timer: ReturnType<typeof setTimeout> | undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          if (timer === undefined && !firedRef.current) {
            timer = setTimeout(() => {
              if (!firedRef.current) {
                firedRef.current = true
                callbackRef.current()
              }
              observer.disconnect()
            }, dwellMs)
          }
        } else if (timer !== undefined) {
          // Scrolled away before the dwell time elapsed -- not an impression.
          clearTimeout(timer)
          timer = undefined
        }
      },
      { threshold },
    )

    observer.observe(element)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      observer.disconnect()
    }
  }, [threshold, dwellMs, enabled])

  return ref
}
