import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { getNames } from 'country-list'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/signup')({
  component: Signup,
})

const COUNTRIES = getNames()
  .map((n) => n.replace(/\s*\(the\)/i, ''))
  .sort()

const MAX_BIRTHDAY = new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10)

function Signup() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [birthday, setBirthday] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
          country,
          birthday,
        },
      },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (data.session) {
      window.location.href = '/'
    } else {
      setSuccess(true)
    }
  }

  const inputClass =
    'mt-1.5 w-full rounded-btn border border-border px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none'

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-md rounded-card border border-border bg-white p-8 shadow-sm text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
            <CheckCircle2 className="h-8 w-8" strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 font-display text-xl font-bold text-ink">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-muted">
            We sent a confirmation link to{' '}
            <span className="font-medium text-ink">{email}</span>. Click it to
            activate your account.
          </p>
          <Link
            to="/login"
            search={{ redirect: undefined }}
            className="mt-6 inline-block text-sm font-semibold text-accent hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <Link to="/" className="mb-8 flex items-center">
        <img src="/ascenda-logo.svg" alt="Ascenda" className="h-7 w-auto" />
      </Link>

      <div className="w-full max-w-lg rounded-card border border-border bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-ink">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Join to start earning rewards on every stay.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">First name</span>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
                placeholder="Alex"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Last name</span>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
                placeholder="Morgan"
              />
            </label>
          </div>

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
            <span className="text-sm font-medium text-ink">Phone number</span>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="+1 555 000 0000"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">Country</span>
              <select
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="" disabled>
                  Select country
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Date of birth</span>
              <input
                required
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={MAX_BIRTHDAY}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-ink">Password</span>
            <div className="relative mt-1.5">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-btn border border-border px-3.5 py-2.5 pr-10 text-sm focus:border-accent focus:outline-none"
                placeholder="Min. 8 characters"
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

          <label className="block">
            <span className="text-sm font-medium text-ink">Confirm password</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Re-enter your password"
            />
          </label>

          {error && (
            <p className="rounded-btn bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="mt-2 w-full"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" search={{ redirect: undefined }} className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
