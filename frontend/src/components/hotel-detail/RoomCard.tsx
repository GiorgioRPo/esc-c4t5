import { Link } from '@tanstack/react-router'
import { BedDouble, Check, Maximize2, Users as UsersIcon } from 'lucide-react'
import { HotelImage } from '@/components/ui/HotelImage'
import { PointsBadge } from '@/components/ui/Badge'
import { buttonVariants } from '@/components/ui/Button'
import { cn, formatCurrency, pointsForAmount } from '@/lib/utils'
import type { RoomType, StaySearch } from '@/lib/types'

export function RoomCard({
  room,
  hotelId,
  hotelName,
  hotelImage,
  hotelAddress,
  search,
}: {
  room: RoomType
  hotelId: string
  hotelName: string
  hotelImage: string
  hotelAddress: string
  search: StaySearch
}) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-4 sm:flex-row sm:items-center">
      <HotelImage
        src={room.image}
        alt={room.name}
        className="h-40 w-full shrink-0 rounded-card sm:h-28 sm:w-40"
      />
      <div className="flex-1">
        <h3 className="font-display text-base font-bold text-ink">
          {room.name}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
          {room.bedType && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              {room.bedType}
            </span>
          )}
          {room.sizeSqm > 0 && (
            <span className="flex items-center gap-1">
              <Maximize2 className="h-3.5 w-3.5" />
              {room.sizeSqm} m&sup2;
            </span>
          )}
          {room.maxOccupancy > 0 && (
            <span className="flex items-center gap-1">
              <UsersIcon className="h-3.5 w-3.5" />
              Sleeps {room.maxOccupancy}
            </span>
          )}
        </div>
        <ul className="mt-2.5 space-y-1">
          {room.perks.map((perk) => (
            <li
              key={perk}
              className="flex items-center gap-1.5 text-xs text-ink"
            >
              <Check className="h-3.5 w-3.5 text-success" />
              {perk}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end sm:text-right">
        {room.originalPricePerNight && (
          <p className="text-xs text-muted line-through">
            {formatCurrency(room.originalPricePerNight)}
          </p>
        )}
        <p className="text-xl font-bold text-ink">
          {formatCurrency(room.pricePerNight)}
          <span className="text-sm font-normal text-muted"> / night</span>
        </p>
        <PointsBadge points={pointsForAmount(room.pricePerNight)} />
        <Link
          to="/booking"
          search={{
            ...search,
            hotelId,
            roomId: room.id,
            hotelName,
            hotelImage,
            hotelAddress,
            roomName: room.name,
            pricePerNight: room.pricePerNight,
          }}
          className={cn(
            buttonVariants({ variant: 'primary', size: 'md' }),
            'w-full sm:w-auto',
          )}
        >
          Select room
        </Link>
      </div>
    </div>
  )
}
