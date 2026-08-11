import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DestinationAutocomplete } from '@/components/search/DestinationAutocomplete'

function stubFetch(json: unknown, ok = true) {
  const mockFetch = vi.fn().mockResolvedValue({ ok, json: async () => json })
  vi.stubGlobal('fetch', mockFetch)
  return mockFetch
}

const PLACEHOLDER = 'Where are you going?'
describe('IT-01 fuzzy match tolerates a typo', () => {
  it('lists Singapore for "Singapur"', async () => {
    stubFetch([])
    const user = userEvent.setup()
    render(<DestinationAutocomplete value="" onChange={() => {}} />)

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Singapur')

    expect(await screen.findByText('Singapore')).toBeInTheDocument()
  })
})

describe('IT-02 below character threshold', () => {
  it('renders no dropdown under 2 characters', async () => {
    const mockFetch = stubFetch([])
    const user = userEvent.setup()
    render(<DestinationAutocomplete value="" onChange={() => {}} />)

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'S')

    expect(screen.queryByText(/singapore/i)).not.toBeInTheDocument()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(0))
  })
})

describe('IT-04 suggestion merge, cap and dedupe', () => {
  it('caps total suggestions at 8 with no duplicate values', async () => {
    stubFetch([
      { term: 'Osaka, Japan', value: 'oWA8', type: 'city', lat: 0, lng: 0 },
      { term: 'Sydney, Australia', value: 'SYIl', type: 'city', lat: 0, lng: 0 },
      { term: 'Oslo, Norway', value: 'newA', type: 'city', lat: 0, lng: 0 },
      { term: 'Ottawa, Canada', value: 'newB', type: 'city', lat: 0, lng: 0 },
      { term: 'Odense, Denmark', value: 'newC', type: 'city', lat: 0, lng: 0 },
    ])
    const user = userEvent.setup()
    render(<DestinationAutocomplete value="" onChange={() => {}} />)

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'an')

    const buttons = await screen.findAllByRole('button')
    expect(buttons.length).toBeLessThanOrEqual(8)

    const values = buttons.map((b) => b.textContent)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('IT-07 no matches found', () => {
  it('shows a no-results message', async () => {
    stubFetch([])
    const user = userEvent.setup()
    render(<DestinationAutocomplete value="" onChange={() => {}} />)
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'zzzzzz')
    expect(await screen.findByText(/no results found/i)).toBeInTheDocument()
  })
})