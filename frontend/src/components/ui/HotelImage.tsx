import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function HotelImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  )

  return (
    <div className={cn('relative overflow-hidden bg-surface', className)}>
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-border/50" />
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff className="h-6 w-6 text-muted" strokeWidth={1.5} />
        </div>
      )}
      {status !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}
