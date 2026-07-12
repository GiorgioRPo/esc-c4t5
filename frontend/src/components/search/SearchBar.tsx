import { useState } from 'react'
import { Search } from 'lucide-react'
import { DestinationAutocomplete } from '@/components/search/DestinationAutocomplete'
import { DateRangePicker } from '@/components/search/DateRangePicker'
import { GuestsRoomsSelector } from '@/components/search/GuestsRoomsSelector'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { StaySearch } from '@/lib/types'

export function SearchBar({
  value,
  onChange,
  onSubmit,
  variant = 'hero',
}: {
  value: StaySearch
  onChange: (patch: Partial<StaySearch>) => void
  onSubmit: () => void
  variant?: 'hero' | 'compact'
}) {
  const size = variant === 'hero' ? 'lg' : 'md'
  const [showError, setShowError] = useState(false)

  function handleSubmit() {
    if (!value.destinationId) {
      setShowError(true)
      return
    }
    setShowError(false)
    onSubmit()
  }

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-stretch', variant === 'hero' && 'rounded-card bg-white p-3 shadow-xl')}>
      <div className="relative sm:flex-[1.4]">
        <DestinationAutocomplete
          value={value.destination}
          onChange={(destination, destinationId) => {
            setShowError(false)
            onChange({ destination, destinationId })
          }}
          size={size}
          className="w-full"
        />
        {showError && (
          <p className="absolute -bottom-5 left-0 text-xs font-medium text-red-500">
            Please select a destination first
          </p>
        )}
      </div>
      <DateRangePicker
        checkIn={value.checkIn}
        checkOut={value.checkOut}
        onChange={(checkIn, checkOut) => onChange({ checkIn, checkOut })}
        size={size}
        className="sm:flex-1"
      />
      <GuestsRoomsSelector
        adults={value.adults}
        childrenCount={value.childrenCount}
        rooms={value.rooms}
        onChange={(patch) => onChange(patch)}
        size={size}
        className="sm:flex-[0.85]"
      />
      <Button
        type="button"
        size={variant === 'hero' ? 'lg' : 'md'}
        onClick={handleSubmit}
        className="gap-2 sm:px-7"
      >
        <Search className="h-4 w-4" />
        Search
      </Button>
    </div>
  )
}
