import { useState } from 'react'
import { Search } from 'lucide-react'
import { DestinationAutocomplete } from '@/components/search/DestinationAutocomplete'
import { DateRangePicker } from '@/components/search/DateRangePicker'
import { GuestsRoomsSelector } from '@/components/search/GuestsRoomsSelector'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { StaySearch } from '@/lib/types'

export function validateDates(checkIn: string, checkOut: string): string | null {
  const today = new Date().toISOString().slice(0, 10)

  if (checkIn < today) {
    return 'Check-in date cannot be in the past'
  }
  if (checkOut <= checkIn) {
    return 'Check-out date must be after check-in date'
  }
  return null
}

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

  const dateError = validateDates(value.checkIn, value.checkOut)
  const errorMessage = !value.destinationId
    ? 'Please select a destination first'
    : dateError

  function handleSubmit() {
    if (!value.destinationId || dateError) {
      setShowError(true)
      return
    }
    setShowError(false)
    onSubmit()
  }

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-stretch', variant === 'hero' && 'rounded-card bg-white p-3 shadow-xl')}>
      <div className="flex flex-col justify-center sm:flex-[1.4]">
        <DestinationAutocomplete
          value={value.destination}
          onChange={(destination, destinationId) => {
            setShowError(false)
            onChange({ destination, destinationId })
          }}
          size={size}
          className="w-full"
        />
        {showError && errorMessage && (
          <p className="mt-1 px-1 text-xs font-medium text-red-500">
            {errorMessage}
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
