import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { SearchBar } from '@/components/search/SearchBar'

function stubFetch(json: unknown, ok = true) {
  const mockFetch = vi.fn().mockResolvedValue({ ok, json: async () => json })
  vi.stubGlobal('fetch', mockFetch)
  return mockFetch
}

const baseValue = {
  destination: '',
  destinationId: '',
  checkIn: '2026-08-10',
  checkOut: '2026-08-11',
  adults: 2,
  childrenCount: 0,
  rooms: 1,
}

describe('IT-05 SearchBar blocks submit without a selected destination', () => {
  it('shows the error and does not call onSubmit', async () => {
    stubFetch([])
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(
      <SearchBar value={baseValue} onChange={() => {}} onSubmit={onSubmit} />,
    )

    await user.type(screen.getByPlaceholderText('Where are you going?'), 'Toky')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(
      await screen.findByText('Please select a destination first'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('IT-08 SearchBar with validateDates', () => {
  it('blocks submission and renders validation errors for invalid date combinations', async () => {
    stubFetch([])
    const onSubmit = vi.fn()
    const checkOutBeforeCheckInState = {
      ...baseValue,
      destination: 'Tokyo, Japan',
      destinationId: 'tokyo-id',
      checkIn: '2026-09-01',
      checkOut: '2026-08-01',
    }

    const { rerender } = render(
      <SearchBar
        value={checkOutBeforeCheckInState}
        onChange={() => {}}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    expect(
      screen.getByText('Check-out date must be after check-in date'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    const pastCheckInState = {
      ...checkOutBeforeCheckInState,
      checkIn: '2020-01-01',
      checkOut: '2026-08-01',
    }

    rerender(
      <SearchBar
        value={pastCheckInState}
        onChange={() => {}}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    expect(
      screen.getByText('Check-in date cannot be in the past'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})