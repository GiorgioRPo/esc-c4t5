# Setup & Test Guide

How to run the whole Ascenda hotel-booking app locally, including the new
destination recommendation engine, and how to verify each part works.

If you only want the app running: do sections 1–5, then 7.
Section 6 (destination seeding) is a **one-time** step and may already be done —
check first, it's cheap.

---

## 0. What you'll be running

Three services, three terminals:

| Service | Port | Language | Required for |
|---|---|---|---|
| FastAPI recommender | 8000 | Python | Recommendations only |
| Hono API | 3001 | Node | Everything |
| Vite frontend | 3000 | Node | Everything |

The browser only ever talks to Vite (`:3000`), which proxies `/api/*` to Hono
(`:3001`). Hono is the only thing that talks to the recommender. **You never
open `:8000` in a browser.**

Ports are not optional — `vite.config.ts`, the CORS origin in `backend/src/index.ts`,
and `RECOMMENDER_URL` all assume these numbers.

---

## 1. Prerequisites

| Tool | Version used | Check |
|---|---|---|
| Node.js | v22.20.0 | `node --version` |
| npm | 11.6.2 | `npm --version` |
| Python | 3.12.10 | `python --version` |
| Docker (optional) | 29.5.3 | `docker --version` |

Python 3.12 specifically — `sentence-transformers` pulls PyTorch, and 3.13
wheels are patchy on Windows.

---

## 2. Get the credentials

You need these from a teammate. **They are not in the repo and never should be.**

1. `backend/.env` values — Supabase, Ascenda, Stripe
2. `backend/services/recommendation/.env` values — the recommender's database URL and internal token
3. `frontend/.env` values — Supabase public keys, Stripe publishable key

⚠️ **The recommender uses a separate Supabase project** from the main app
(a dev database, isolated so schema changes can't break the team's data). So
`RECOMMENDER_DATABASE_URL` points somewhere different from `SUPABASE_URL`. That
is intentional, not a mistake.

---

## 3. Install dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install

# Recommender (Python)
cd services/recommendation
python -m venv .venv
.venv/Scripts/activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
```

The Python install downloads PyTorch — **~2 GB, several minutes**. It's a
one-time cost. Good moment to make coffee.

---

## 4. Create the env files

Copy each template and fill in the values from step 2.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp backend/services/recommendation/.env.example backend/services/recommendation/.env
```

### `backend/.env`

```
ASCENDA_API_URL=https://hotelapi.loyalty.dev/api
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWKS_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RECOMMENDER_URL=http://localhost:8000
RECOMMENDER_INTERNAL_TOKEN=
```

### `backend/services/recommendation/.env`

```
RECOMMENDER_DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
RECOMMENDER_INTERNAL_TOKEN=
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384
EMBEDDING_VERSION=destination-document-v1
DATABASE_POOL_MIN_SIZE=1
DATABASE_POOL_MAX_SIZE=5
DATABASE_SEARCH_PATH=public,extensions
DATABASE_STATEMENT_CACHE_SIZE=100
DISTANCE_SCALE_KM=1500
LOG_LEVEL=INFO
```

### `frontend/.env`

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

### Three ways this goes wrong

1. **`RECOMMENDER_INTERNAL_TOKEN` must be byte-identical** in `backend/.env`
   and the recommender's `.env`. Different values → every recommendation
   returns `source: "unavailable"` with no obvious error.
2. **The `.env` file lives at the service root**, next to `requirements.txt` —
   *not* inside `app/`. It is read relative to where you launch uvicorn.
3. **Use the Supabase session pooler (port 5432)**, not the transaction pooler
   (6543). If you must use 6543, set `DATABASE_STATEMENT_CACHE_SIZE=0`.
   If the password contains `[ ] @ : /`, percent-encode it — or reset it to
   something alphanumeric and save yourself the trouble.

---

## 5. Database migration (recommender only — one time)

If someone has already applied it, skip. To check, run this in the recommender
Supabase project's SQL editor:

```sql
select tablename from pg_tables
where schemaname = 'public'
  and (tablename like 'recommendation%' or tablename = 'destinations');
```

Expect four rows: `destinations`, `recommendation_runs`,
`recommendation_items`, `recommendation_events`.

If empty, paste the whole of
`database/migrations/001_recommendation_system.sql` into the SQL editor and run
it. It's idempotent — safe to re-run.

Extensions must exist first (Database → Extensions → enable `vector` and
`postgis`). Verify where they landed:

```sql
select extname, extnamespace::regnamespace from pg_extension
where extname in ('vector','postgis');
```

They should be in `extensions`. If they're in `public`, remove the
`extensions.` prefixes in the migration before running it.

---

## 6. Seed destinations (one time)

Skip if `select count(*) from destinations where embedding is not null` already
returns 43.

```bash
# Derive coordinates from Ascenda (writes database/seed/destinations.json)
cd backend
npx tsx scripts/derive-destination-geo.ts

# Check what's ready
cd services/recommendation
python -m scripts.validate_destinations

# Generate embeddings and upsert
python -m scripts.seed_destinations
```

Notes:

- The derive script is **resumable**. Ascenda rate-limits (429); if some
  destinations get skipped, just run it again — successful ones are reused.
- Expect **43 of 45**. Athens and Jakarta return zero hotels from Ascenda, so
  they have no coordinates and nothing bookable. That's correct, not a bug.
- `seed_destinations` only re-embeds destinations whose text actually changed
  (SHA-256 profile hash). Re-running is cheap. Use `--force` to redo everything.

---

## 7. Run it

Three terminals. The Python one needs the venv activated.

```bash
# Terminal 1 — recommender
cd backend/services/recommendation
.venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

First start downloads the MiniLM model (~90 MB) and takes ~5 s to load it.
Wait for `startup complete in N.NNs`.

```bash
# Terminal 2 — Hono API
cd backend
npm run dev
```

```bash
# Terminal 3 — frontend
cd frontend
npm run dev
```

Open **http://localhost:3000**.

---

## 8. Verify each layer

Work bottom-up. If something breaks, this tells you which layer.

### 8.1 Recommender is healthy

```bash
curl http://localhost:8000/health/ready
```

```json
{"status":"ready","database":true,"model":true,
 "embedding_model":"sentence-transformers/all-MiniLM-L6-v2"}
```

`"database": false` → connection string or extensions problem. The uvicorn log
has the real exception.

### 8.2 Auth is enforced

```bash
curl -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/v1/candidates \
  -H "Content-Type: application/json" -d '{"origin_uid":"RsBU"}'
```

Must print `401`. If it prints `200`, the token check is broken.

### 8.3 Hono is up

```bash
curl http://localhost:3001/          # -> Hello Hono!
```

### 8.4 Existing features still work

```bash
curl "http://localhost:3001/api/hotels?destination_id=RsBU" | head -c 200
curl "http://localhost:3001/api/hotels/prices?destination_id=RsBU&checkin=2026-10-01&checkout=2026-10-07&guests=2"
```

### 8.5 Recommendations end to end

```bash
curl -X POST http://localhost:3000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"originUid":"RsBU","checkIn":"2026-10-01","checkOut":"2026-10-07","adults":2,"rooms":1,"limit":5}'
```

Note this goes through **:3000** (Vite), proving the browser's real path.

Expect `"source":"ai-ranked"` and Kuala Lumpur ranked first for Singapore.

`"source"` tells you what happened:

| Value | Meaning |
|---|---|
| `ai-ranked` | Everything worked |
| `retrieval-only` | Ranking call failed; retrieval order served |
| `fallback` | Origin unknown or no candidates |
| `unavailable` | Recommender unreachable — check token match and that :8000 is up |

### 8.6 In the browser

1. Go to http://localhost:3000
2. Search a destination (Singapore), pick dates ~2 months out, submit
3. Hotel results appear first — **this must not wait on recommendations**
4. Scroll past the results: **"Because you searched Singapore"** with 3–5 cards
5. Each card shows a category badge, 1–3 factual reasons, a price or
   "Checking prices…", and a hotel count
6. Click **Search hotels** on one — it should navigate to that destination with
   **your original dates, adults and rooms preserved**

### 8.7 Telemetry is recording

After scrolling the cards into view and clicking one, in the recommender's
Supabase SQL editor:

```sql
select event_type, count(*) from recommendation_events group by 1;
select destination_uid, final_rank, final_score, explanation
from recommendation_items where final_rank is not null
order by created_at desc limit 5;
```

Impressions only fire when a card is **50% visible for 1 continuous second** —
scrolling past fast on purpose won't log one. That's intended.

### 8.8 Failure handling

Stop the recommender (Ctrl+C in terminal 1), then reload the hotel results page.

- Hotel results still load normally
- The recommendation section **disappears entirely** — no error banner
- `curl` the endpoint: `HTTP 200` with `"source":"unavailable"`, in ~200 ms

If hotel search breaks when the recommender is down, something is wired wrong.

---

## 9. Run the tests

```bash
# Recommender unit tests — 32 tests
cd backend/services/recommendation
python -m pytest tests/ -q

# Typechecks
cd backend  && npx tsc --noEmit      # expect 0 errors
cd frontend && npx tsc --noEmit      # expect errors ONLY in booking.tsx (pre-existing)

# Docker config
docker compose config --quiet
```

### Performance benchmark

```bash
cd backend/services/recommendation
python -m scripts.benchmark
```

Writes `docs/benchmarks/latency.json`. Reference figures from the dev machine:
model load 4,739 ms · embed 16.6 ms · retrieval 83 ms · rank 0.21 ms.

### Ranker evaluation

```bash
python -m scripts.evaluate_rankers
```

Writes `docs/benchmarks/ranker_evaluation.json`. Label-free metrics are real
and reproducible. **NDCG/Recall currently come from a 3-query sample fixture
and are NOT human-validated** — the script prints a warning saying so. To make
them citable, copy `database/seed/evaluation_cases.example.json` to
`evaluation_cases.json` and label 30–50 origins using the guide inside.

---

## 10. Docker (the easy path)

The whole stack is containerised. **This is the recommended way to run the app
if you are not editing code** -- it skips the ~2 GB PyTorch install entirely.

```bash
docker compose up --build          # frontend on http://localhost:3000
```

Only the frontend is published. `api` and `recommender` are internal-only and
reached by service name over the `app` bridge network; nginx inside the
frontend container proxies `/api` to `api:3001`, so browser requests are
same-origin.

To curl the recommender directly (Swagger, debugging):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

That override publishes `:8000`.

Useful commands:

```bash
docker compose ps                    # check all three are Up
docker compose logs -f api           # watch recommendation orchestration
docker compose logs recommender      # model load, retrieval timings
docker compose down                  # stop everything
docker compose up -d --build frontend  # rebuild one service
```

There is deliberately **no Postgres container** -- Supabase is the source of
truth, and a second database would guarantee drift.

### The same .env files work for both modes

`backend/.env` sets `RECOMMENDER_URL=http://localhost:8000`, correct for
native. Compose **overrides** it with `http://recommender:8000` via
`environment:`, which takes precedence over `env_file`. Nothing to edit when
switching.

### NEVER run Docker and the native servers at the same time

Both bind `:3000` and `:3001`. Whichever claimed the port first silently wins,
while `docker compose ps` still reports every container as `Up` -- only the
port *publish* failed. Requests then hit the stale dev server, the containers
log nothing, and the recommendation section shows nothing with no error
anywhere. This costs hours if you do not know to look for it.

Before switching modes:

```bash
docker compose down                  # Docker -> native
# or Ctrl+C the three dev servers    # native -> Docker
```

**The 10-second check for which one is actually answering:**

```bash
curl -sI http://localhost:3000/ | grep -i server
#   Server: nginx/1.xx   -> Docker
#   (no Server header)   -> Vite dev server
```

And to prove a request truly reached the container:

```bash
docker compose logs api --tail 3     # expect: [recommendations] runId=...
```

If that logs nothing while you are getting responses, you are talking to a
ghost process, not Docker.

### If auth breaks in Docker but works natively

The frontend image was probably built while `.env` was still listed in
`frontend/.dockerignore`. Vite inlines `VITE_*` variables at **build time**, so
excluding `.env` bakes in the placeholder Supabase values. Confirm `.env` is
NOT in `frontend/.dockerignore`, then:

```bash
docker compose build --no-cache frontend && docker compose up -d
```

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ValidationError: RECOMMENDER_DATABASE_URL` | `.env` missing or in `app/` | Move to service root, next to `requirements.txt` |
| `unknown type: public.vector` | `vector` extension in a different schema | Should self-resolve; if not, check it's enabled |
| `password authentication failed` | Password has `[ ] @ : /` unencoded | Percent-encode, or reset to alphanumeric |
| `does not appear to be an IPv4 or IPv6 address` | Square brackets in password | Same as above |
| `KeyError` loading `.env` | Ran from wrong directory | Paths are relative to CWD; run from repo root |
| `source: "unavailable"` always | Token mismatch, or :8000 down | Compare both `RECOMMENDER_INTERNAL_TOKEN` values byte-for-byte |
| CORS error in browser console | Vite not on :3000 | CORS origin in `backend/src/index.ts` is hardcoded to `http://localhost:3000` |
| `Neither apiKey nor config.authenticator` | `STRIPE_SECRET_KEY` empty | Fill it in — Hono won't boot without it |
| `supabaseUrl is required` | `SUPABASE_URL` empty | Fill it in |
| Ascenda `429` during seeding | Rate limited | Re-run the derive script; it resumes |
| Recommendations always empty | Destinations not seeded | Run section 6 |
| Model downloads on every start | `HF_HOME` not persisted | Normal outside Docker; the image bakes the model in |

---

## 12. Where things live

```
backend/
  src/
    lib/recommender.ts        FastAPI client (owns the internal token)
    lib/enrichment.ts         Ascenda enrichment, bounded concurrency
    models/recommendations.ts POST /api/recommendations + /events
  scripts/
    derive-destination-geo.ts Coordinates from Ascenda hotel data
  services/recommendation/
    app/                      config, database, embedding, retrieval,
                              ranking, repositories, security, main
    scripts/                  validate, seed, benchmark, evaluate
    tests/test_ranking.py     32 unit tests
    Dockerfile
frontend/src/
  lib/recommendations.ts      Typed client + event helper
  hooks/useRecommendations.ts TanStack Query hook
  hooks/useImpression.ts      IntersectionObserver impressions
  components/recommendations/ Section + card
database/
  migrations/                 001_recommendation_system.sql
  seed/                       destinations.json, destination_profiles.json,
                              evaluation_cases.example.json
docs/
  recommendation-system.md    Architecture, formulas, measurements
  benchmarks/                 latency.json, ranker_evaluation.json
```

Full architectural detail, scoring formulas and measured performance:
**`docs/recommendation-system.md`**.
