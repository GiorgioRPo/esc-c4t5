import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---- module-level stripe mock (set up once, never restored) ----
const mockConstructEvent = vi.fn()
const mockPaymentIntentsCreate = vi.fn()

vi.mock('stripe', () => ({
  __esModule: true,
  default: vi.fn(function(this: unknown) {
    return {
      paymentIntents: { create: mockPaymentIntentsCreate },
      webhooks: { constructEvent: mockConstructEvent },
    }
  }),
}))

// Module-level callback so vi.mock hoisting doesn't break the reference
let supabaseMaybeSingleFactory = async () => ({ data: null, error: null })
let supabaseInsertResult: { error: unknown } = { error: null }
let lastInsertArgs: unknown = null

vi.mock('@supabase/supabase-js', () => {
  const createClient = vi.fn((_url: string, _key: string) => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(supabaseMaybeSingleFactory) })),
      })),
      insert: vi.fn(async (args: unknown) => {
        lastInsertArgs = args
        return supabaseInsertResult
      }),
    })),
  }))
  return { createClient }
})

describe('webhooks.ts', () => {
  const validPaymentIntent = {
    id: 'pi_123',
    metadata: {
      destination_id: 'dest-1',
      hotel_id: 'hotel-1',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      adults: '2',
      children: '0',
      message_to_hotel: 'High floor',
      room_types: '["ocean-view"]',
      price_paid: '224',
      user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    },
  }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    // Reset to defaults so each test starts clean
    mockConstructEvent.mockReturnValue(undefined) // clear any queued once-calls
    supabaseMaybeSingleFactory = async () => ({ data: null, error: null })
    supabaseInsertResult = { error: null }
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake'
    process.env.SUPABASE_URL = 'http://supabase.local'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_role_key'
  })

  async function postWebhook(body: unknown, signature: string | undefined) {
    const mod = await import('../src/webhooks.js')
    const app = mod.default
    return app.fetch(
      new Request('http://localhost/', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: signature ? { 'stripe-signature': signature } : {},
      }),
    )
  }

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await postWebhook({ type: 'payment_intent.succeeded' }, undefined)
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toBe('Missing stripe-signature header')
  })

  it('returns 400 when the signature is invalid', async () => {
    // Use mockImplementationOnce here — this is the ONLY test that needs a thrown error
    mockConstructEvent.mockImplementationOnce(() => { throw new Error('Invalid signature') })
    const res = await postWebhook({ type: 'payment_intent.succeeded' }, 'bad_sig')
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('Webhook signature verification failed')
  })

  it('inserts a booking when payment_intent.succeeded fires', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded', data: { object: validPaymentIntent },
    })

    const res = await postWebhook({ type: 'payment_intent.succeeded' }, 'valid_sig')
    expect(res.status).toBe(200)
    const json = await res.json() as { received: boolean }
    expect(json.received).toBe(true)
    expect(lastInsertArgs).toMatchObject({
      destination_id: 'dest-1', hotel_id: 'hotel-1', start_date: '2026-08-01', end_date: '2026-08-03',
      adults: 2, children: 0, message_to_hotel: 'High floor',
      room_types: ['ocean-view'], price_paid: 224, user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', payment_id: 'pi_123',
    })
  })

  it('skips insert when a booking for the same payment already exists', async () => {
    const existingBooking = { id: 'b1', payment_id: 'pi_123' }
    supabaseMaybeSingleFactory = async () => ({ data: existingBooking, error: null })

    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded', data: { object: validPaymentIntent },
    })

    const res = await postWebhook({ type: 'payment_intent.succeeded' }, 'valid_sig')
    expect(res.status).toBe(200)
    const json = await res.json() as { received: boolean }
    expect(json.received).toBe(true)

    const { createClient } = await import('@supabase/supabase-js')
    const mockFrom = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value?.from()
    expect(mockFrom?.insert).not.toHaveBeenCalled()
  })

  it('returns 500 when inserting the booking fails', async () => {
    supabaseInsertResult = { error: new Error('db constraint violation') }

    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded', data: { object: validPaymentIntent },
    })

    const res = await postWebhook({ type: 'payment_intent.succeeded' }, 'valid_sig')
    expect(res.status).toBe(500)
    const json = await res.json() as { error: string }
    expect(json.error).toBe('db constraint violation')
  })

  it('ignores event types other than payment_intent.succeeded', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'charge.succeeded', data: { object: {} },
    })

    const res = await postWebhook({ type: 'charge.succeeded' }, 'valid_sig')
    expect(res.status).toBe(200)
    const json = await res.json() as { received: boolean }
    expect(json.received).toBe(true)
  })

  it('passes through a non-Error throw from constructEvent', async () => {
    // Use mockImplementationOnce — only this test needs a thrown non-Error
    mockConstructEvent.mockImplementationOnce(() => { throw 'plain string error' })
    const res = await postWebhook({ type: 'payment_intent.succeeded' }, 'bad_sig')
    expect(res.status).toBe(400)
    const json = await res.json() as { error: string }
    expect(json.error).toContain('Webhook signature verification failed')
  })
})
