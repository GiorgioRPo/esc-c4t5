import { useState } from 'react'
import { HotelImage } from '@/components/ui/HotelImage'
import { cn } from '@/lib/utils'

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0)

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
      <HotelImage
        src={images[active]}
        alt={alt}
        className="h-72 w-full rounded-card sm:h-[420px]"
      />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:h-[420px]">
        {images.slice(0, 4).map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              'overflow-hidden rounded-card border-2',
              active === i ? 'border-accent' : 'border-transparent',
            )}
          >
            <HotelImage
              src={src}
              alt={`${alt} photo ${i + 1}`}
              className="h-16 w-full sm:h-full"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
