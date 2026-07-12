import { useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { Loader2, MapPin, Plane } from 'lucide-react'
import { searchDestinations } from '@/lib/ascenda'
import type { AscendaDestination } from '@/lib/ascenda'
import { LOCAL_DESTINATIONS } from '@/data/destinations'
import { cn, searchFieldClass } from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'

interface Suggestion {
  term: string
  value: string
  type: string
}

const fuse = new Fuse(LOCAL_DESTINATIONS, {
  keys: ['term'],
  threshold: 0.4,
  distance: 200,
  minMatchCharLength: 2,
})

export function DestinationAutocomplete({
  value,
  onChange,
  size = 'lg',
  className,
}: {
  value: string
  onChange: (term: string, destinationId: string) => void
  size?: 'lg' | 'md'
  className?: string
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [apiSuggestions, setApiSuggestions] = useState<AscendaDestination[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => {
    setOpen(false)
    setQuery(value)
  })

  const localResults = useMemo<Suggestion[]>(() => {
    if (query.trim().length < 2) return []
    return fuse.search(query).slice(0, 6).map((r) => r.item)
  }, [query])

  const suggestions = useMemo<Suggestion[]>(() => {
    const seen = new Set(localResults.map((s) => s.value))
    const extras = apiSuggestions
      .filter((s) => !seen.has(s.value))
      .slice(0, Math.max(0, 8 - localResults.length))
    return [...localResults, ...extras]
  }, [localResults, apiSuggestions])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setQuery(raw)
    setOpen(true)
    setApiSuggestions([])
    clearTimeout(debounceRef.current)

    if (!raw.trim()) return

    setFetching(true)
    debounceRef.current = setTimeout(async () => {
      const results = await searchDestinations(raw)
      setApiSuggestions(results)
      setFetching(false)
    }, 350)
  }

  function select(s: Suggestion) {
    onChange(s.term, s.value)
    setQuery(s.term)
    setOpen(false)
    setApiSuggestions([])
  }

  const showDropdown = open && query.trim().length >= 2 && (fetching || suggestions.length > 0)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className={cn(searchFieldClass(size), !value && open && query && 'border-red-300')}>
        <MapPin className="h-4 w-4 shrink-0 text-muted" />
        <div className="flex min-w-0 flex-1 flex-col">
          {size === 'lg' && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Destination
            </span>
          )}
          <input
            value={query}
            onChange={handleInput}
            onFocus={() => {
              setOpen(true)
              if (!apiSuggestions.length && query.trim().length >= 2) {
                setFetching(true)
                searchDestinations(query).then((r) => {
                  setApiSuggestions(r)
                  setFetching(false)
                })
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
                setQuery(value)
              }
            }}
            placeholder="Where are you going?"
            className="w-full min-w-0 bg-transparent text-sm font-semibold text-ink placeholder:font-normal placeholder:text-muted focus:outline-none"
          />
        </div>
        {fetching && localResults.length === 0 && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 top-full z-30 mt-2 max-h-80 w-full min-w-[300px] overflow-auto rounded-card border border-border bg-white p-2 shadow-lg">
          {suggestions.map((s) => (
            <button
              type="button"
              key={s.value}
              onClick={() => select(s)}
              className="flex w-full items-center gap-2.5 rounded-btn px-3 py-2.5 text-left text-sm text-ink hover:bg-surface"
            >
              {s.type === 'airport' ? (
                <Plane className="h-4 w-4 shrink-0 text-muted" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0 text-muted" />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">{s.term}</span>
            </button>
          ))}
          {fetching && suggestions.length === 0 && (
            <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </p>
          )}
        </div>
      )}
    </div>
  )
}
