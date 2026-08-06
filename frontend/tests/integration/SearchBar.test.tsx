import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
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
