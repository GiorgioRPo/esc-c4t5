import {
  Wifi,
  Waves,
  Dumbbell,
  UtensilsCrossed,
  ParkingCircle,
  PawPrint,
  Wind,
  Coffee,
  Martini,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface FacilityMeta {
  key: string
  label: string
  icon: LucideIcon
}

export const FACILITIES: FacilityMeta[] = [
  { key: 'wifi', label: 'Free WiFi', icon: Wifi },
  { key: 'pool', label: 'Swimming pool', icon: Waves },
  { key: 'gym', label: 'Fitness center', icon: Dumbbell },
  { key: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { key: 'parking', label: 'Free parking', icon: ParkingCircle },
  { key: 'pet-friendly', label: 'Pet friendly', icon: PawPrint },
  { key: 'ac', label: 'Air conditioning', icon: Wind },
  { key: 'breakfast', label: 'Breakfast included', icon: Coffee },
  { key: 'bar', label: 'Bar / lounge', icon: Martini },
]

export const FACILITY_MAP: Record<string, FacilityMeta> = FACILITIES.reduce(
  (acc, f) => {
    acc[f.key] = f
    return acc
  },
  {} as Record<string, FacilityMeta>,
)
