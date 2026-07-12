import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StarRating({
  rating,
  size = 16,
  className,
}: {
  rating: number
  size?: number
  className?: string
}) {
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      aria-label={`${rating} star rating`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < rating ? 'fill-gold text-gold' : 'fill-border text-border'
          }
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}
