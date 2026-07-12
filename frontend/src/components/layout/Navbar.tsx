import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDown, Globe, LogOut } from 'lucide-react'
import { buttonVariants } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const DISABLED_TABS = ['Flights', 'Car rental', 'Attractions']

export function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const firstName = user?.user_metadata?.first_name as string | undefined
  const displayName = firstName ?? user?.email?.split('@')[0]

  return (
    <header className="sticky top-0 z-50 bg-navy">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center">
            <img
              src="/ascenda-logo.svg"
              alt="Ascenda"
              className="h-6 w-auto brightness-0 invert"
            />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              to="/"
              className="text-sm font-semibold text-white"
              activeOptions={{ exact: true, includeSearch: false }}
            >
              Stays
            </Link>
            {DISABLED_TABS.map((tab) => (
              <span
                key={tab}
                className="flex items-center gap-1.5 text-sm font-medium text-white/40"
                title="Coming soon"
              >
                {tab}
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                  Soon
                </span>
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-btn px-2.5 py-1.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 sm:flex"
          >
            <Globe className="h-4 w-4" />
            EN · USD
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
                {(firstName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
              </div>
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-white/85 sm:block">
                {displayName}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-btn px-2.5 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              search={{ redirect: undefined }}
              className={buttonVariants({ variant: 'outline-white', size: 'sm' })}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
