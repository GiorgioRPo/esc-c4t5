import { cn, guestRatingLabel } from '@/lib/utils'

export function RatingPill({
  score,
  reviewCount,
  size = 'md',
  className,
}: {
  score: number
  reviewCount?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-md bg-navy font-bold text-white',
          size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
        )}
      >
        {score.toFixed(1)}
      </span>
      <div className="leading-tight">
        <p
          className={cn(
            'font-semibold text-ink',
            size === 'sm' ? 'text-xs' : 'text-sm',
          )}
        >
          {guestRatingLabel(score)}
        </p>
        {reviewCount !== undefined && (
          <p className="text-xs text-muted">
            {reviewCount.toLocaleString()} reviews
          </p>
        )}
      </div>
    </div>
  )
}
