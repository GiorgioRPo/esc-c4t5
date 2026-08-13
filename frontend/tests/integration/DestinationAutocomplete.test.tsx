import '@testing-library/jest-dom/vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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

describe('IT-03 rapid typing settles on the final query without a request', () => {
  // Destination suggestions are looked up locally (Fuse over LOCAL_DESTINATIONS) with no
  // debounce and no network request — the remote lookup this test used to cover was removed
  // from `@/lib/ascenda` in a7c072f. See docs/TEST_PLAN.md §1.7.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T00:00:00Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a match for the final query and issues no fetch', async () => {
    const mockFetch = stubFetch([])
    function TestWrapper() {
      const [val, setVal] = useState('')
      return <DestinationAutocomplete value={val} onChange={setVal} />
    }
    render(<TestWrapper />)
    const input = screen.getByPlaceholderText(PLACEHOLDER)
    mockFetch.mockClear()
    act(() => { fireEvent.change(input, { target: { value: 'T' } }) })
    act(() => { fireEvent.change(input, { target: { value: 'To' } }) })
    act(() => { fireEvent.change(input, { target: { value: 'Tok' } }) })
    act(() => { fireEvent.change(input, { target: { value: 'Toky' } }) })
    act(() => { fireEvent.change(input, { target: { value: 'Tokyo' } }) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })
    // Lookup is synchronous (local Fuse index), so the match is already rendered — using
    // `findByText` here would poll with real timers against a fake-timers clock and hang.
    expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('IT-04 local suggestion cap and dedupe', () => {
  // Suggestions come only from Fuse over LOCAL_DESTINATIONS since a7c072f removed the API
  // merge, so this no longer exercises a remote fixture — see docs/TEST_PLAN.md §1.7.
  it('caps total suggestions at 8 with no duplicate values', async () => {
    stubFetch([])
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
