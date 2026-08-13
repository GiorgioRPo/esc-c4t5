# Deploying a public demo

A recruiter-facing deployment on Render's free tier.

The serving container runs `EMBEDDING_MODE=precomputed`, so it carries no
PyTorch and no model — **363 MB instead of 8.9 GB, 47 MB RSS instead of 430 MB,
0.28 s startup instead of 4.7 s**. That is what makes a free tier viable.

---

## How precomputed mode works

Without a traveller `intent` string, the retrieval query text is fully
determined by the origin destination. So there are exactly N possible query
vectors — one per destination — and the seeder stores them:

```
seed_destinations.py  (runs LOCALLY, full requirements.txt, uses MiniLM)
   ├─ embeds each destination DOCUMENT   -> destinations.embedding
   └─ embeds each no-intent QUERY        -> destinations.query_embedding
                                              │
deployed container (requirements-slim.txt, no model)
   └─ reads query_embedding, sends it to pgvector
```

**The model still generates every vector.** It just runs on your machine during
seeding instead of inside the deployed container. Identical output — verified:
Singapore → Kuala Lumpur scores `0.694` in both modes.

Requests carrying `intent` are rejected with **400** in precomputed mode rather
than silently ignored, because that text cannot be known in advance. The
frontend never sends `intent`, so this never triggers in the demo.

---

## Before you deploy

### 1. Apply migration 002 and re-seed

```bash
# In the Supabase SQL editor, run:
#   database/migrations/002_query_embeddings.sql

cd backend/services/recommendation
.venv/Scripts/activate
python -m scripts.seed_destinations --force
```

Verify:

```sql
select count(*) from destinations where query_embedding is not null;   -- 43
```

If this is 0, the deployed service returns **503** with a message telling you
to run the seeder. It fails loudly rather than serving nothing.

### 2. Generate a fresh internal token

Do **not** reuse your local one.

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 3. Use Stripe TEST keys only

`sk_test_…` / `pk_test_…`. Never put a live key on a public demo.

---

## Deploy

1. Push the branch to GitHub.
2. Render → **New → Blueprint** → point at the repo. It reads `render.yaml`.
3. Render prompts for every `sync: false` value. Fill them in.
4. First deploy: leave `CORS_ORIGIN` and `VITE_API_BASE` blank — you do not
   know the URLs yet.
5. Once all three are live, note the URLs, then:
   - `ascenda-api` → set `CORS_ORIGIN` to the **frontend** URL
   - `ascenda-frontend` → set `VITE_API_BASE` to the **api** URL, then
     **Manual Deploy → Clear build cache & deploy**

⚠️ **`VITE_API_BASE` is inlined at build time.** Changing it without
rebuilding does nothing — the old value stays baked into the JS bundle. This
is the single most common way this deployment breaks.

---

## Verify

```bash
curl https://ascenda-recommender-XXXX.onrender.com/health/ready
# {"status":"ready","database":true,"model":true,"embedding_mode":"precomputed"}

curl -o /dev/null -w "%{http_code}\n" -X POST \
  https://ascenda-recommender-XXXX.onrender.com/v1/candidates \
  -H "Content-Type: application/json" -d '{"origin_uid":"RsBU"}'
# 401  <- token enforced even though the URL is public

curl -X POST https://ascenda-api-XXXX.onrender.com/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"originUid":"RsBU","checkIn":"2026-10-01","checkOut":"2026-10-07","adults":2,"rooms":1}'
# "source":"ai-ranked"
```

Then open the frontend URL, search Singapore, and scroll past the hotel results.

---

## The two things that will still break a demo

### Ascenda rate limits

`hotelapi.loyalty.dev` is a shared project sandbox with no per-tenant quota. We
hit **429s during ordinary development**. A public link that gets clicked a few
times can exhaust it, and hotel search then shows *"Could not load hotels."*

Mitigations:

- **Raise the price cache TTL** for the demo. In `backend/src/models/prices.ts`,
  `5*60*1000` → `20*60*1000`. Disclose it if asked: production would use 5 min.
- **Warm it before showing anyone.** Run the Singapore search once and let
  prices finish; subsequent visitors hit cache.
- **The static hotel cache is 1 hour**, so hotel *lists* survive far longer than
  prices.

### Free services sleep after ~15 min idle

First request after a nap takes ~50 s. The recommender adds only 0.28 s on top
(no model to load), but Render's own cold start dominates.

Mitigations:

- Hit the URL yourself right before sharing it.
- A free uptime pinger (UptimeRobot, 5-min interval) on `/health/live` keeps it
  awake — check Render's current policy first.
- Put **"first load may take ~30 s (free hosting)"** next to the link. Managing
  the expectation costs nothing and prevents a recruiter assuming it is broken.

---

## Local development is unaffected

`EMBEDDING_MODE` defaults to `live`, so nothing changes locally:

```bash
docker compose up --build          # full image, live embedding, intent supported
```

Use the slim image locally only to reproduce the deployed behaviour:

```bash
cd backend/services/recommendation
docker build -f Dockerfile.slim -t recommender-slim .
docker run --rm --env-file .env -e EMBEDDING_MODE=precomputed -p 8001:8000 recommender-slim
```

---

## What each mode costs

| | `live` (local) | `precomputed` (deployed) |
|---|---|---|
| Image | 8.9 GB | **363 MB** |
| RSS | 430 MB | **47 MB** |
| Startup | 4.7 s | **0.28 s** |
| `intent` supported | ✅ | ❌ (400) |
| Ranking output | identical | identical |
