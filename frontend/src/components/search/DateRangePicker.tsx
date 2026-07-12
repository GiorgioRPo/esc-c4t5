import { useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  cn,
  formatDateShort,
  isoDate,
  nightsBetween,
  searchFieldClass,
} from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'

interface DayCell {
  iso: string
  day: number
}

function buildMonthGrid(year: number, month: number): Array<DayCell | null> {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<DayCell | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: isoDate(new Date(year, month, day)), day })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function MonthPanel({
  year,
  month,
  todayIso,
  checkIn,
  checkOut,
  onPick,
}: {
  year: number
  month: number
  todayIso: string
  checkIn: string
  checkOut: string
  onPick: (iso: string) => void
}) {
  const cells = buildMonthGrid(year, month)
  const title = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="w-full">
      <p className="mb-3 text-center text-sm font-semibold text-ink">{title}</p>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="text-[11px] font-medium text-muted">
            {d}
          </span>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <span key={i} />
          const isPast = cell.iso < todayIso
          const isCheckIn = cell.iso === checkIn
          const isCheckOut = cell.iso === checkOut
          const isInRange = cell.iso > checkIn && cell.iso < checkOut
          const isEndpoint = isCheckIn || isCheckOut
          return (
            <button
              type="button"
              key={cell.iso}
              disabled={isPast}
              onClick={() => onPick(cell.iso)}
              className={cn(
                'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors',
                isPast && 'cursor-not-allowed text-muted/40',
                !isPast &&
                  !isEndpoint &&
                  !isInRange &&
                  'text-ink hover:bg-surface',
                isInRange && 'rounded-none bg-accent-light text-accent-dark',
                isEndpoint && 'bg-accent font-semibold text-white',
                cell.iso === todayIso &&
                  !isEndpoint &&
                  'font-semibold text-accent',
              )}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
  size = 'lg',
  className,
}: {
  checkIn: string
  checkOut: string
  onChange: (checkIn: string, checkOut: string) => void
  size?: 'lg' | 'md'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState<'checkIn' | 'checkOut'>('checkIn')
  const todayIso = isoDate(new Date())
  const initialView = new Date(`${checkIn}T00:00:00`)
  const [viewYear, setViewYear] = useState(initialView.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialView.getMonth())
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setOpen(false))

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const todayMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
  const canGoBack = new Date(viewYear, viewMonth, 1) > todayMonthStart

  function pick(iso: string) {
    if (selecting === 'checkOut' && iso > checkIn) {
      onChange(checkIn, iso)
      setSelecting('checkIn')
      setOpen(false)
      return
    }
    onChange(iso, addDays(iso, 1))
    setSelecting('checkOut')
  }

  const nights = nightsBetween(checkIn, checkOut)
  const secondMonth = new Date(viewYear, viewMonth + 1, 1)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setSelecting('checkIn')
        }}
        className={cn(searchFieldClass(size), 'w-full text-left')}
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted" />
        {size === 'lg' ? (
          <div className="flex flex-1 items-center gap-3">
            <div className="leading-tight">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">
                Check-in
              </span>
              <span className="text-sm font-semibold text-ink">
                {formatDateShort(checkIn)}
              </span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="leading-tight">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">
                Check-out
              </span>
              <span className="text-sm font-semibold text-ink">
                {formatDateShort(checkOut)}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-sm font-semibold text-ink">
            {formatDateShort(checkIn)} – {formatDateShort(checkOut)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[320px] rounded-card border border-border bg-white p-4 shadow-lg sm:w-[640px]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canGoBack}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-navy disabled:opacity-30 hover:bg-surface"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-xs font-medium text-muted">
              {nights} night{nights !== 1 ? 's' : ''} selected
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-navy hover:bg-surface"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <MonthPanel
              year={viewYear}
              month={viewMonth}
              todayIso={todayIso}
              checkIn={checkIn}
              checkOut={checkOut}
              onPick={pick}
            />
            <div className="hidden sm:block">
              <MonthPanel
                year={secondMonth.getFullYear()}
                month={secondMonth.getMonth()}
                todayIso={todayIso}
                checkIn={checkIn}
                checkOut={checkOut}
                onPick={pick}
              />
            </div>
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
