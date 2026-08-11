import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('recommender.ts', () => {
  const originalToken = process.env.RECOMMENDER_INTERNAL_TOKEN
  const originalUrl = process.env.RECOMMENDER_URL

  beforeEach(() => {
    vi.resetModules()
    process.env.RECOMMENDER_INTERNAL_TOKEN = 'secret-token'
    process.env.RECOMMENDER_URL = 'http://localhost:8000'
  })

  afterEach(() => {
    if (originalToken !== undefined) process.env.RECOMMENDER_INTERNAL_TOKEN = originalToken
    else delete process.env.RECOMMENDER_INTERNAL_TOKEN
    if (originalUrl !== undefined) process.env.RECOMMENDER_URL = originalUrl
    else delete process.env.RECOMMENDER_URL
  })

  it('throws when RECOMMENDER_INTERNAL_TOKEN is not set', async () => {
    delete process.env.RECOMMENDER_INTERNAL_TOKEN
    const { fetchCandidates } = await import('../src/lib/recommender.js')
    await expect(fetchCandidates({ origin_uid: 'u1', strategy: 'mixed' }))
      .rejects.toThrow('RECOMMENDER_INTERNAL_TOKEN is not configured')
  })

  it('throws when RECOMMENDER_INTERNAL_TOKEN is empty string', async () => {
    process.env.RECOMMENDER_INTERNAL_TOKEN = ''
    const { fetchCandidates } = await import('../src/lib/recommender.js')
    await expect(fetchCandidates({ origin_uid: 'u1', strategy: 'mixed' }))
      .rejects.toThrow('RECOMMENDER_INTERNAL_TOKEN is not configured')
  })

  it('returns parsed JSON on 200', async () => {
    const payload = { run_id: 'r1', model_version: 'v1', ranking_version: 'rv1', origin: { uid: 'u1', name: 'Singapore' }, candidates: [] }
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => payload })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchCandidates } = await import('../src/lib/recommender.js')
    const result = await fetchCandidates({ origin_uid: 'u1', strategy: 'mixed' })

    expect(result).toEqual(payload)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8000/v1/candidates')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer secret-token' }))
  })

  it('throws RecommenderError on non-OK status without leaking body', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ internal: 'nope' }) })
    vi.stubGlobal('fetch', fetchMock)

    const { rankCandidates } = await import('../src/lib/recommender.js')
    await expect(rankCandidates({ run_id: 'r1', strategy: 'mixed', currency: 'SGD', candidates: [] }))
      .rejects.toThrow('Recommender /v1/rank returned 500')
  })

  it('throws RecommenderError when the network is unreachable', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    const { recordEvent } = await import('../src/lib/recommender.js')
    await expect(recordEvent({ run_id: 'r1', event_type: 'click' }))
      .rejects.toThrow('Recommender /v1/events unreachable')
  })

  it('fetchCandidates passes all mapped fields in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ run_id: 'r1', model_version: 'mv1', ranking_version: 'rv1', origin: { uid: 'dest-1', name: 'Test' }, candidates: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchCandidates } = await import('../src/lib/recommender.js')
    await fetchCandidates({ origin_uid: 'dest-1', intent: 'weekend', strategy: 'nearby', limit: 12, max_distance_km: 50 })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ origin_uid: 'dest-1', intent: 'weekend', strategy: 'nearby', limit: 12, max_distance_km: 50 })
  })

  it('rankCandidates sends enriched candidates to /v1/rank', async () => {
    const payload = { run_id: 'r1', strategy: 'mixed', currency: 'SGD', limit: 5, origin_min_price: 120, candidates: [{ uid: 'c1', name: 'Hotel A', country: 'SG', country_code: null, region: null, semantic_score: 0.9, distance_km: 1, popularity_score: 0.5, hotel_count: 3, tags: [], priced_hotel_count: 2, min_price: 100 }] }
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ run_id: 'r1', ranking_version: 'rv1', recommendations: [], generated_at: '2026-01-01T00:00:00Z' }) })
    vi.stubGlobal('fetch', fetchMock)

    const { rankCandidates } = await import('../src/lib/recommender.js')
    await rankCandidates(payload)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual(payload)
  })

  it('recordEvent sends the event and metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ accepted: true, event_id: 'e1' }) })
    vi.stubGlobal('fetch', fetchMock)

    const { recordEvent } = await import('../src/lib/recommender.js')
    const result = await recordEvent({ run_id: 'r1', destination_uid: 'dest-1', event_type: 'impression', event_metadata: { position: 1 } })

    expect(result).toEqual({ accepted: true, event_id: 'e1' })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ run_id: 'r1', destination_uid: 'dest-1', event_type: 'impression', event_metadata: { position: 1 } })
  })

  it('throws RecommenderError with 504 when the request times out', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fetchMock = vi.fn().mockRejectedValueOnce(abortError)
    vi.stubGlobal('fetch', fetchMock)

    const { fetchCandidates } = await import('../src/lib/recommender.js')
    await expect(fetchCandidates({ origin_uid: 'u1', strategy: 'mixed' }))
      .rejects.toThrow('Recommender /v1/candidates timed out')
  })
})
