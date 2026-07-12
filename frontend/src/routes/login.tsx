import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: Login,
})

function Login() {
  const { redirect } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    window.location.href = redirect ?? '/'
  }

  const inputClass =
    'mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <Link to="/" className="mb-8 flex items-center">
        <img src="/ascenda-logo.svg" alt="Ascenda" className="h-7 w-auto" />
      </Link>

      <div className="w-full max-w-md rounded-card border border-border bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-ink">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted">
          Sign in to continue earning on every stay.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Password</span>
              <button
                type="button"
                className="text-xs font-medium text-accent hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative mt-1.5">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-btn border border-border px-3.5 py-2.5 pr-10 text-sm focus:border-accent focus:outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          {error && (
            <p className="rounded-btn bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-semibold text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
