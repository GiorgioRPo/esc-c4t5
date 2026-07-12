import type { ReactNode } from 'react'
import { Gem } from 'lucide-react'
import { cn, formatPoints } from '@/lib/utils'

export type BadgeTone = 'success' | 'accent' | 'gold' | 'neutral'

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-success-light text-success',
  accent: 'bg-accent-light text-accent-dark',
  gold: 'bg-amber-50 text-amber-700',
  neutral: 'bg-surface text-muted',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PointsBadge({
  points,
  className,
}: {
  points: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-dark',
        className,
      )}
    >
      <Gem className="h-3.5 w-3.5" strokeWidth={2.25} />
      {formatPoints(points)} pts
    </span>
  )
}
