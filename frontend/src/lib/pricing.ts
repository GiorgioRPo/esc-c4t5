import { pointsForAmount } from '@/lib/utils'

export const TAX_RATE = 0.12

export interface StayTotals {
  subtotal: number
  taxesAndFees: number
  total: number
  points: number
}

export function computeStayTotals(
  pricePerNight: number,
  nights: number,
  rooms: number,
): StayTotals {
  const subtotal = pricePerNight * nights * rooms
  const taxesAndFees = Math.round(subtotal * TAX_RATE)
  const total = subtotal + taxesAndFees
  const points = pointsForAmount(total)
  return { subtotal, taxesAndFees, total, points }
}
