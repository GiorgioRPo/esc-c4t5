import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DateRangePicker } from '@/components/search/DateRangePicker'

describe('IT-06 DateRangePicker check-in/check-out and past-date disabling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T00:00:00Z'))
  })

  it('advances check-out by one day when a check-in date is picked', () => {
    const onChange = vi.fn()
    render(
      <DateRangePicker checkIn="2026-08-01" checkOut="2026-08-02" onChange={onChange} />,
    )

    fireEvent.click(screen.getByText('Check-in'))

    const day10Buttons = screen.getAllByRole('button', { name: '10' })
    fireEvent.click(day10Buttons[0])

    expect(onChange).toHaveBeenCalledWith('2026-08-10', '2026-08-11')
  })

  it('disables dates before today', () => {
    render(
      <DateRangePicker checkIn="2026-07-25" checkOut="2026-07-26" onChange={() => {}} />,
    )

    fireEvent.click(screen.getByText('Check-in'))

    const day24Buttons = screen.getAllByRole('button', { name: '24' })
    expect(day24Buttons[0]).toBeDisabled()
  })
})