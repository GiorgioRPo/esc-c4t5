import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShareDialog } from '@/components/hotel-detail/ShareDialog'

const URL = 'http://localhost:3000/'

describe('ShareDialog', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('renders nothing when closed', () => {
    render(<ShareDialog open={false} onClose={vi.fn()} title="Grand Hotel" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders platform links pointing at the current page URL', () => {
    render(<ShareDialog open onClose={vi.fn()} title="Grand Hotel" />)

    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      `https://wa.me/?text=${encodeURIComponent(`Grand Hotel ${URL}`)}`,
    )
    expect(screen.getByRole('link', { name: /facebook/i })).toHaveAttribute(
      'href',
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL)}`,
    )
    expect(screen.getByRole('link', { name: /^x$/i })).toHaveAttribute(
      'href',
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(URL)}&text=${encodeURIComponent('Grand Hotel')}`,
    )
    expect(screen.getByRole('link', { name: /telegram/i })).toHaveAttribute(
      'href',
      `https://t.me/share/url?url=${encodeURIComponent(URL)}&text=${encodeURIComponent('Grand Hotel')}`,
    )
    const emailLink = screen.getByRole('link', { name: /email/i })
    expect(emailLink).toHaveAttribute(
      'href',
      `mailto:?subject=${encodeURIComponent('Grand Hotel')}&body=${encodeURIComponent(URL)}`,
    )
    expect(emailLink).not.toHaveAttribute('target')
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'target',
      '_blank',
    )
  })

  it('copies the URL and shows a confirmation', async () => {
    render(<ShareDialog open onClose={vi.fn()} title="Grand Hotel" />)

    fireEvent.click(screen.getByRole('button', { name: /^copy$/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(URL)
    expect(await screen.findByText(/copied!/i)).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<ShareDialog open onClose={onClose} title="Grand Hotel" />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on backdrop click but not on panel click', () => {
    const onClose = vi.fn()
    render(<ShareDialog open onClose={onClose} title="Grand Hotel" />)

    fireEvent.click(screen.getByText('Share this hotel'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })
})
