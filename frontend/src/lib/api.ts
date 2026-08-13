/**
 * Base URL for our own backend.
 *
 * Empty in development, so every call stays a RELATIVE path and is handled by
 * the Vite dev proxy (or nginx in Docker) -- same-origin, no CORS.
 *
 * Set VITE_API_BASE at build time when the frontend is hosted separately from
 * the API (e.g. a static host). Vite inlines this at BUILD time, so it must be
 * present when `npm run build` runs, not at container start.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}
