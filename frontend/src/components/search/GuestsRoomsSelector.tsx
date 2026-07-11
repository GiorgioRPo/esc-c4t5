import { useRef, useState } from 'react'
import { Minus, Plus, Users } from 'lucide-react'
import { cn, formatGuestsSummary, searchFieldClass } from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'

function StepperRow({
  label,
  sub,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  sub: string
  value: number
  min: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-navy disabled:opacity-30 hover:bg-surface"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-5 text-center text-sm font-semibold text-ink">
          {value}
        </span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-navy disabled:opacity-30 hover:bg-surface"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function GuestsRoomsSelector({
  adults,
  childrenCount,
  rooms,
  onChange,
  size = 'lg',
  className,
}: {
  adults: number
  childrenCount: number
  rooms: number
  onChange: (patch: {
    adults: number
    childrenCount: number
    rooms: number
  }) => void
  size?: 'lg' | 'md'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, () => setOpen(false))

  const summary = formatGuestsSummary(adults, childrenCount, rooms)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(searchFieldClass(size), 'w-full text-left')}
      >
        <Users className="h-4 w-4 shrink-0 text-muted" />
        <div className="flex flex-col">
          {size === 'lg' && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Guests
            </span>
          )}
          <span className="text-sm font-semibold text-ink">{summary}</span>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[300px] rounded-card border border-border bg-white p-4 shadow-lg">
          <div className="divide-y divide-border">
            <StepperRow
              label="Adults"
              sub="Ages 13+"
              value={adults}
              min={1}
              max={8}
              onChange={(next) =>
                onChange({ adults: next, childrenCount, rooms })
              }
            />
            <StepperRow
              label="Children"
              sub="Ages 0–12"
              value={childrenCount}
              min={0}
              max={6}
              onChange={(next) =>
                onChange({ adults, childrenCount: next, rooms })
              }
            />
            <StepperRow
              label="Rooms"
              sub="1 room minimum"
              value={rooms}
              min={1}
              max={4}
              onChange={(next) =>
                onChange({ adults, childrenCount, rooms: next })
              }
            />
          </div>
          <div className="mt-3 flex justify-end border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-btn bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
