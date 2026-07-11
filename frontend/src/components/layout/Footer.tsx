import { ShieldCheck, Lock } from 'lucide-react'

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'Earn & Redeem',
    links: [
      { label: 'Hotel bookings', href: 'https://www.ascenda.com/travel-bookings' },
      { label: 'Points transfers', href: 'https://www.ascenda.com/points-transfers' },
      { label: 'Pay with points', href: 'https://www.ascenda.com/pay-with-points' },
      { label: 'Gift cards', href: 'https://www.ascenda.com/gift-cards' },
      { label: 'Cashback', href: 'https://www.ascenda.com/cashback' },
      { label: 'Offers', href: 'https://www.ascenda.com/offers' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Our philosophy', href: 'https://www.ascenda.com/our-philosophy' },
      { label: 'Partners', href: 'https://www.ascenda.com/partners' },
      { label: 'Customers', href: 'https://www.ascenda.com/customers' },
      { label: 'Careers', href: 'https://www.ascenda.com/careers' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'News & insights', href: 'https://www.ascenda.com/news-and-insights' },
      { label: 'Events', href: 'https://www.ascenda.com/events' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help centre', href: '#' },
      { label: 'Cancellation policy', href: '#' },
      { label: 'Terms of service', href: '#' },
      { label: 'Privacy policy', href: '#' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-navy text-white/70">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-sm font-semibold text-white">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-sm text-white/65 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/ascenda-logo.svg"
              alt="Ascenda"
              className="h-5 w-auto brightness-0 invert"
            />
            <span className="text-xs text-white/50">
              The booking engine behind the world&apos;s loyalty programs.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Bank-grade encryption
            </span>
            <span>&copy; 2026 Ascenda. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
