import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DateRangePicker } from '@/components/search/DateRangePicker'

describe('IT-06 DateRangePicker with utils.addDays', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances check-out by one day when picking check-in and disables past dates', () => {
    const onChange = vi.fn()

    render(
      <DateRangePicker
        checkIn="2026-07-25"
        checkOut="2026-07-27"
        onChange={onChange}
      />
    )
    const checkInButton = screen.getByRole('button', { name: /check-in/i })
    fireEvent.click(checkInButton)
    const date24Jul = screen.getAllByRole('button', { name: /^24$/ })[0]
    expect(date24Jul).toBeDisabled()
    const date10Aug = screen.getAllByRole('button', { name: /^10$/ })[1]
    fireEvent.click(date10Aug)
    expect(onChange).toHaveBeenCalledWith('2026-08-10', '2026-08-11')
  })
})