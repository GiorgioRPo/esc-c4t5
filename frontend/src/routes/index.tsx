import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  Building2,
  Gem,
  RotateCcw,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { SearchBar } from '@/components/search/SearchBar'
import { HotelImage } from '@/components/ui/HotelImage'
import { defaultStaySearch } from '@/lib/utils'
import type { StaySearch } from '@/lib/types'

export const Route = createFileRoute('/')({ component: Home })

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: 'Secure payments',
    description:
      'Every booking is PCI-DSS compliant and encrypted end-to-end — the same standard your bank already trusts.',
  },
  {
    icon: Gem,
    title: 'Earn on every stay',
    description:
      'Members earn reward points on the full price of every booking, credited straight to their loyalty account.',
  },
  {
    icon: RotateCcw,
    title: 'Free cancellation',
    description:
      'Most rooms can be cancelled at no charge up until a few days before arrival.',
  },
]

const POPULAR_DESTINATIONS = [
  {
    city: 'London',
    country: 'United Kingdom',
    destinationId: 'jC3Y',
    image: 'https://images.unsplash.com/photo-1513635032122-d31b8fa5f1f0?auto=format&fit=crop&w=400&q=80',
  },
  {
    city: 'Singapore',
    country: 'Singapore',
    destinationId: 'RsBU',
    image: 'https://images.unsplash.com/photo-1525625293371-ead4bf9fa3be?auto=format&fit=crop&w=400&q=80',
  },
  {
    city: 'Paris',
    country: 'France',
    destinationId: 'vJh2',
    image: 'https://images.unsplash.com/photo-1502602114383-1856c2f9e0b0?auto=format&fit=crop&w=400&q=80',
  },
  {
    city: 'Dubai',
    country: 'UAE',
    destinationId: 'SfLK',
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=400&q=80',
  },
  {
    city: 'Tokyo',
    country: 'Japan',
    destinationId: 'fRZM',
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=400&q=80',
  },
  {
    city: 'Bali',
    country: 'Indonesia',
    destinationId: 'WP3Z',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=400&q=80',
  },
  {
    city: 'Bangkok',
    country: 'Thailand',
    destinationId: 'Zauv',
    image: 'https://images.unsplash.com/photo-1563492065830-a882ea50e4c5?auto=format&fit=crop&w=400&q=80',
  },
  {
    city: 'New York',
    country: 'United States',
    destinationId: 'jiHz',
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=400&q=80',
  },
]

function Home() {
  const [search, setSearch] = useState<StaySearch>(() => defaultStaySearch())
  const navigate = useNavigate()

  function handleChange(patch: Partial<StaySearch>) {
    setSearch((prev) => ({ ...prev, ...patch }))
  }

  function handleSubmit() {
    navigate({ to: '/hotels', search })
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <section className="relative bg-navy pb-16 pt-16 sm:pb-20 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <svg
            className="absolute -right-10 top-0 hidden h-full w-[640px] text-white opacity-[0.06] sm:block"
            viewBox="0 0 640 400"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
          >
            <polyline
              points="0,360 80,300 160,330 240,220 320,260 400,140 480,190 560,80 640,120"
              stroke="currentColor"
              strokeWidth="3"
            />
            <polyline
              points="0,400 100,340 200,370 300,260 400,300 500,180 640,220"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Travel rewards your members will actually use.
            </h1>
            <p className="mt-4 text-lg text-white/75">
              Search 650,000+ hotels worldwide and earn points on every stay —
              redeemable straight through your bank&apos;s rewards program.
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
          <SearchBar
            value={search}
            onChange={handleChange}
            onSubmit={handleSubmit}
            variant="hero"
          />
        </div>

        <div className="relative mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/60">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              650K+ hotels worldwide
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              50M+ loyalty members
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-gold text-gold" />
              60+ bank partners
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Bank-grade security
            </span>
          </div>
        </div>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-ink">
            Popular destinations
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {POPULAR_DESTINATIONS.map((dest) => (
              <Link
                key={dest.destinationId}
                to="/hotels"
                search={{
                  ...defaultStaySearch(),
                  destination: `${dest.city}, ${dest.country}`,
                  destinationId: dest.destinationId,
                }}
                className="group overflow-hidden rounded-card border border-border bg-white transition-shadow hover:shadow-md"
              >
                <HotelImage
                  src={dest.image}
                  alt={dest.city}
                  className="h-28 w-full"
                />
                <div className="p-3">
                  <p className="font-semibold text-ink">{dest.city}</p>
                  <p className="text-xs text-muted">{dest.country}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-3">
            {VALUE_PROPS.map((v) => (
              <div key={v.title}>
                <div className="flex h-11 w-11 items-center justify-center rounded-card bg-accent-light text-accent">
                  <v.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
