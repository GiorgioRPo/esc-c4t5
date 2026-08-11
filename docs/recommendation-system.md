# Destination Recommendation System

Alternative-destination recommendations for the Ascenda hotel-booking app.
When a traveller searches Singapore, the results page also offers Kuala Lumpur,
Bangkok and Bali — each with a grounded, factual reason.

Every number in this document was measured on the running system. Nothing is
simulated, extrapolated, or estimated.

---

## 1. Architecture

```
                    Browser (React / Vite / TanStack Query)
                                    |
                                    | HTTPS, same-origin /api/*
                                    v
                       Hono API gateway  (:3001)
                                    |
                +-------------------+--------------------+
                |                                        |
                | internal bearer token                  | partner credentials
                v                                        v
     FastAPI recommender (:8000)                  Ascenda Hotel APIs
                |                                  /hotels  /hotels/prices
                v
        Supabase PostgreSQL
          - pgvector : destination embeddings (384-dim)
          - PostGIS  : destination coordinates
          - recommendation_runs / _items / _events
```

### Dependency rules (enforced, not aspirational)

| Rule | How it is enforced |
|---|---|
| Browser never reaches FastAPI | No CORS middleware on FastAPI; not published to host in `docker-compose.yml` |
| FastAPI never owns Ascenda credentials | `ASCENDA_API_URL` is absent from the recommender's config entirely |
| FastAPI never calls Hono | No HTTP client in the service |
| Browser never receives the internal token | Token lives only in `lib/recommender.ts`; verified absent from responses |
| Browser never writes telemetry tables | RLS enabled with **zero policies**; FastAPI uses the Postgres role, which bypasses RLS |

---

## 2. Service responsibilities

**Hono** — public API, request validation, orchestration, Ascenda enrichment,
fallback handling. Owns partner credentials.

**FastAPI** — embedding inference, pgvector similarity, PostGIS distance,
feature computation, ranking, diversification, explanation generation,
telemetry persistence. Owns the database.

**Supabase Postgres** — destination catalogue with embeddings and geography,
plus the recommendation telemetry that will become learning-to-rank training
data.

---

## 3. Request flow

```
POST /api/recommendations
  { originUid, checkIn, checkOut, adults, rooms, currency, strategy }
        |
        |  1. zod validation (dates, party size, currency, strategy enum)
        v
  POST recommender/v1/candidates          [3s timeout]
        |  semantic top-10 (pgvector cosine)
        |  geographic top-10 (PostGIS ST_DWithin + GiST)
        |  union by uid, provenance preserved -> up to 12
        v
  Ascenda enrichment                       [concurrency 3, 4s each]
        |  Promise.allSettled -- partial failure tolerated
        |  priced_hotel_count, min_price per destination
        v
  POST recommender/v1/rank                 [2s timeout]
        |  weighted score -> diversify (max 2/country) -> categories -> reasons
        v
  { runId, source, pricingStatus, recommendations[] }
```

---

## 4. Candidate generation

Two independent retrieval channels, unioned and deduplicated by destination
UID with `retrieval_sources` preserved for later analysis.

**Semantic** — cosine distance over 384-dim MiniLM embeddings.

```sql
1 - (d.embedding <=> $query_vector) as semantic_score
order by d.embedding <=> $query_vector
```

**Geographic** — true spherical distance via PostGIS `geography`.

```sql
extensions.st_distance(d.location, o.location) / 1000.0 as distance_km
-- ST_DWithin (not a distance filter) so the GiST index is used
```

### Why there is no vector index

At 43 destinations a sequential scan is **faster and exact**. IVFFlat and HNSW
are approximate — they would trade recall for speed that is not needed. A
commented HNSW migration is included in the schema for when the catalogue grows
by orders of magnitude.

---

## 5. Scoring

All formulas live in one module (`app/ranking.py`). Ranking, telemetry,
evaluation, and any future model must import from there.

| Feature | Formula | Notes |
|---|---|---|
| `semantic` | `1 - cosine_distance` | Already 0–1 |
| `distance` | `exp(-km / 1500)` | Absolute, **not** list-relative — same pair always scores the same |
| `inventory` | `log1p(count) / log1p(reference)` | Reference varies by count type (below) |
| `price` | min-max over `log1p(price)`, reversed | Candidate-relative; same dates/party/currency |
| `popularity` | stored 0–1 | Currently inert — no behavioural data yet |

### Inventory reference scales

Different count types live on wildly different scales, so one reference cannot
serve both:

| Source | Reference | Rationale |
|---|---|---|
| `available_hotels` | 50 | Dated availability for one search |
| `priced_hotel_count` | 50 | Hotels returning a dated price |
| `hotel_count` (static) | **12,000** | Above London's 10,932 so major cities stay distinguishable |

A unit test (`test_static_inventory_does_not_saturate_for_large_cities`) caught
that a reference of 2,000 made every city above 2,000 hotels score exactly 1.0 —
about fifteen destinations were indistinguishable. Measured after the fix:

```
   200 hotels -> 0.5646      4,854 hotels -> 0.9037
   700 hotels -> 0.6976     10,932 hotels -> 0.9901
 2,000 hotels -> 0.8093
```

### Weights

Heuristic, **not trained**. Ranking version: `heuristic-ranker-v1`.

| Strategy | semantic | distance | inventory | price | popularity |
|---|---|---|---|---|---|
| mixed | 0.50 | 0.15 | 0.20 | 0.10 | 0.05 |
| similar | 0.70 | 0.05 | 0.15 | 0.05 | 0.05 |
| nearby | 0.25 | 0.45 | 0.15 | 0.10 | 0.05 |
| value | 0.35 | 0.05 | 0.20 | 0.35 | 0.05 |

**Weight redistribution** — when a feature has no data across all candidates
(no prices returned, popularity all zero), its weight is removed and the
remainder renormalised. Without this, scores silently compress and become
incomparable between requests.

---

## 6. Static inventory is NOT dated availability

The single most important correctness rule in this system.

| Field | Source | Claimable? |
|---|---|---|
| `hotel_count` | `/hotels?destination_id=` | "N hotels **in our inventory**" |
| `priced_hotel_count` | hotels returning a price for the dates | "N hotels **priced for your dates**" |
| `available_hotels` | dated availability confirmation | "N hotels **available**" |

Ascenda's price endpoint proves a hotel *returned a price*, not that it is
*available*. Therefore `available_hotels` is **always `null`** in the current
implementation, and the explanation generator branches on which count actually
exists. This is covered by `test_static_inventory_never_claims_availability`.

---

## 7. Grounded explanations

No LLM is involved at request time. Reason codes with eligibility rules:

| Code | Eligibility |
|---|---|
| `SIMILAR_EXPERIENCE` | `semantic_score >= 0.60` |
| `LOWER_STARTING_PRICE` | Valid origin price AND candidate ≥10% cheaper |
| `STARTING_PRICE` | Candidate price known, no valid comparison |
| `NEARBY_DESTINATION` | `distance_km <= 800` |
| `PRICED_AVAILABILITY` | `priced_hotel_count` present |
| `STRONG_AVAILABILITY` | `available_hotels` present |
| `INVENTORY_SIZE` | Only static `hotel_count` known |

Maximum three reasons per destination. The 10% margin exists so a 1% price
difference is never advertised as "better value".

---

## 8. Measured performance

Environment: Windows 11, Python 3.12.10, single uvicorn worker, Supabase
session pooler (`ap-southeast-1`), pool size 1–5, 43 destinations.

### Cold start

| Metric | Value |
|---|---|
| Model load (`all-MiniLM-L6-v2`) | **4,739 ms** |
| First inference after load | 223 ms |
| Process RSS with model resident | **429.8 MB** |

### Per-stage latency (n = 20, excludes Ascenda)

| Stage | mean | p50 | p95 | max |
|---|---|---|---|---|
| `embed_query` | 16.63 ms | 16.09 | 19.40 | 23.86 |
| retrieval (pgvector + PostGIS) | 82.98 ms | 69.95 | 116.34 | 272.39 |
| rank + diversify | **0.21 ms** | 0.21 | 0.28 | 0.38 |
| **total** | **83.27 ms** | 70.27 | 116.60 | 272.84 |

Retrieval is dominated by network round-trips to Supabase, not by computation.
Ranking is effectively free.

### Throughput (single uvicorn worker, pool max 5)

| Concurrency | req/s | p95 |
|---|---|---|
| 1 | 13.1 | 82 ms |
| 2 | 13.3 | 508 ms |
| 4 | **20.3** | 630 ms |
| 8 | 10.9 | 1,081 ms |

Throughput peaks at concurrency 4 and degrades at 8 — the connection pool
(`max_size=5`) is the bottleneck, not CPU. Raising pool size and worker count
is the first scaling lever.

### End-to-end through Hono

| Endpoint | Latency | Notes |
|---|---|---|
| `GET /api/hotels` (cold) | 900.6 ms | Main hotel search |
| `GET /api/hotels` (warm cache) | 97.9 ms | |
| `POST /api/recommendations` | 1,967–2,297 ms | Includes up to 9 Ascenda enrichment calls |

**Critical point:** the recommendation request runs as a *separate, parallel*
browser request. Hotel results render as soon as `/api/hotels` returns; the
recommendation section fills in later behind its own skeleton. **Measured
impact on hotel-search latency: zero.**

---

## 9. Measured quality

### Label-free metrics — all 43 origins, fully objective

No human labels required. Reproducible with
`python -m scripts.evaluate_rankers`.

| Ranker | Catalogue coverage | Countries per list | Intra-list similarity | Zero-inventory |
|---|---|---|---|---|
| geographic-only | 97.7% | 3.88 | 0.5392 | 0.00% |
| semantic-only | 93.0% | 4.47 | 0.5719 | 0.00% |
| **inventory-only** | **55.8%** | 4.09 | 0.5551 | 0.00% |
| **weighted-hybrid** | **88.4%** | 4.30 | 0.5675 | 0.00% |

**The headline finding:** `inventory-only` — a commercially plausible non-AI
default ("show the destinations with the most hotels") — surfaces only **55.8%**
of the catalogue. Roughly **44% of destinations would never be shown to any
user**. The hybrid ranker reaches 88.4%, a **+32.6 percentage-point** increase
in catalogue exposure, while keeping zero-inventory recommendations at 0%.

Coverage matters commercially: destinations that are never surfaced can never
be booked.

### Labelled metrics — NOT YET VALID

NDCG and Recall require human relevance judgements. The repository ships
`database/seed/evaluation_cases.example.json`, a **3-query sample fixture whose
labels are illustrative only**. Results computed from it exercise the harness
and must **not** be quoted as evidence of quality.

To produce quotable numbers:

1. Copy `evaluation_cases.example.json` → `evaluation_cases.json`
2. Label 30–50 origins, ≥8 candidates each, on the 0–3 scale in the file
3. Have a second person label a 10% overlap and report inter-rater agreement
4. Re-run `python -m scripts.evaluate_rankers`

The script automatically detects the real file and drops the "NOT
HUMAN-VALIDATED" warning from its output.

---

## 10. Architecture decision: separate service vs. embedded in Hono

Two approaches were considered:

1. **Everything in TypeScript/Hono**, with Python used offline only.
2. **Separate FastAPI service** with pgvector, PostGIS and Docker Compose.

**Approach 2 was chosen.** The honest case, based on measurements above:

### What separation does NOT buy

**It does not improve recommendation accuracy.** Same embeddings, same
formulas, same ranked output. Any claim that service separation improves
relevance would be false. The quality numbers in §9 would be identical either
way.

### What separation demonstrably does buy

**1. The event loop is protected.** `embed_query` costs a measured **16.63 ms
of CPU-bound work per request**. Node is single-threaded — in approach 1 that
computation runs *on the same event loop serving hotel searches*. At 10
concurrent recommendation requests that is ~166 ms of blocked event loop, and
every unrelated hotel search, booking submission and price poll queues behind
it. In approach 2 it runs in a separate process and cannot block anything.

**2. Memory is isolated.** The model holds **429.8 MB resident**. In approach 1
every Hono instance carries that, so horizontal scaling of the *API gateway*
multiplies model memory even though the extra capacity is needed for I/O-bound
routing, not inference. Approach 2 scales the two independently.

**3. Cold start is off the critical path.** Model load costs **4,739 ms**. In
approach 1 that is 4.7 s added to API gateway startup — every deploy, every
restart, every autoscale event. In approach 2 the gateway starts immediately
and Docker's `depends_on: service_healthy` gates traffic on the recommender's
`/health/ready`.

**4. Failure is contained — measured, not asserted.** With the recommender
completely unreachable:

```
POST /api/recommendations -> HTTP 200, 173.4 ms, source="unavailable", n=0
GET  /api/hotels          -> HTTP 200,  97.9 ms, 732 hotels   [UNAFFECTED]
```

The recommender dying degrades one page section. Hotel search and booking are
untouched. In approach 1 an embedding-library crash, native-dependency failure
or OOM would take down the whole API process including checkout.

**5. The Python ML ecosystem is available directly.** sentence-transformers,
pgvector bindings, and the future LightGBM path are first-class in Python. The
Node equivalents (ONNX runtime, transformers.js) are less mature and would need
re-validating.

### Honest costs of approach 2

| Cost | Detail | Mitigation |
|---|---|---|
| Extra network hop | 2 internal calls per recommendation | Both are sub-3 s timeouts; measured retrieval is 83 ms |
| Second runtime to deploy | Python image ~1 GB with PyTorch | Model baked into image at build |
| Two codebases | Feature formulas in Python, orchestration in TS | Single source of truth in `app/ranking.py` |
| Operational surface | Two health checks, two log streams | Compose health gating |

### When approach 1 would have been right

If the catalogue were permanently small **and** embeddings were precomputed
offline **and** no future ML work were planned, doing cosine similarity in
TypeScript over a committed JSON file would be simpler and adequate. The
deciding factor is the **16.63 ms of per-request CPU-bound inference** and the
LightGBM roadmap — both of which belong off the API gateway's event loop.

---

## 11. Failure and fallback behaviour

`POST /api/recommendations` **never returns 5xx.** The section renders inline on
the hotel results page; an error there must not disrupt booking.

| Condition | `source` | Behaviour |
|---|---|---|
| Everything healthy | `ai-ranked` | Full ranking with reasons |
| Ranking call fails, candidates succeeded | `retrieval-only` | Retrieval order, no reasons |
| Unknown/inactive origin, zero candidates | `fallback` | Empty list |
| Recommender unreachable or timed out | `unavailable` | Empty list, 200 |

Frontend: `isError` → render nothing. Empty list → render nothing. Never an
error banner.

---

## 12. Event schema

| Event | Trigger | Can become a training label? |
|---|---|---|
| `impression` | Card ≥50% visible for ≥1 s | Yes — label 0 |
| `click` | "Search hotels" pressed | Yes — label 1 |
| `hotel_search` | Recommended search executed | Yes — label 2 |
| `hotel_view` | Hotel detail opened from that search | Yes — label 2 |
| `booking_started` | Checkout entered | Yes — label 3 |
| `booking_completed` | Payment confirmed | Yes — label 4 |

Impressions require **real visibility** (IntersectionObserver, 50% for 1
continuous second, once per card per mount). "The API returned it" is not an
impression — a card below the fold was never seen. This distinction matters for
future model training.

The event type is an enum in both zod and Postgres; arbitrary names are
rejected with 400.

---

## 13. Environment variables

**`backend/.env`** (Hono)

```
ASCENDA_API_URL=https://hotelapi.loyalty.dev/api
RECOMMENDER_URL=http://localhost:8000
RECOMMENDER_INTERNAL_TOKEN=<48+ random chars>
SUPABASE_URL= / SUPABASE_SECRET_KEY= / SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY= / STRIPE_WEBHOOK_SECRET=
```

**`backend/services/recommendation/.env`** (FastAPI)

```
RECOMMENDER_DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres
RECOMMENDER_INTERNAL_TOKEN=<same value as Hono>
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384
EMBEDDING_VERSION=destination-document-v1
DATABASE_SEARCH_PATH=public,extensions
DISTANCE_SCALE_KM=1500
```

Use the Supabase **session pooler** (port 5432). The transaction pooler (6543)
requires `DATABASE_STATEMENT_CACHE_SIZE=0`. Passwords containing `[ ] @ : /`
must be percent-encoded — an alphanumeric password avoids the problem entirely.

`RECOMMENDER_DATABASE_URL` must **never** appear in a `VITE_`-prefixed variable;
Vite inlines those into the browser bundle.

---

## 14. Operations

### Migration

```bash
# Paste database/migrations/001_recommendation_system.sql into the
# Supabase SQL editor, or:
psql "$RECOMMENDER_DATABASE_URL" -f database/migrations/001_recommendation_system.sql
```

Idempotent. Verify extension schema first:

```sql
select extname, extnamespace::regnamespace from pg_extension
where extname in ('vector','postgis');
```

### Seeding destinations

```bash
cd backend && npx tsx scripts/derive-destination-geo.ts   # coordinates from Ascenda
cd backend/services/recommendation
python -m scripts.validate_destinations                    # readiness report
python -m scripts.seed_destinations                        # embeddings + upsert
python -m scripts.seed_destinations --force                # re-embed everything
```

Coordinates are the **median** of each destination's hotel latitudes/longitudes
from Ascenda — never hand-entered. Median, not mean, so one mis-geocoded hotel
cannot drag the centroid.

### Regenerating embeddings after a model change

1. Update `EMBEDDING_MODEL` and `EMBEDDING_DIMENSION`
2. Change `EMBEDDING_VERSION` (this invalidates every profile hash)
3. Alter the `vector(N)` column if the dimension changed
4. `python -m scripts.seed_destinations --force`

Re-running without a version change re-embeds nothing — the SHA-256 profile
hash detects that documents are unchanged.

### Running locally

```bash
# 1  cd backend/services/recommendation && uvicorn app.main:app --port 8000
# 2  cd backend && npm run dev            # :3001
# 3  cd frontend && npm run dev           # :3000
```

### Docker

```bash
docker compose up recommender                                    # service only
docker compose --profile full up                                 # + Hono
docker compose -f docker-compose.yml -f docker-compose.dev.yml up # expose :8000
```

No Postgres container: Supabase is the single source of truth. FastAPI is not
published to the host in the default profile.

### Testing

```bash
cd backend/services/recommendation && python -m pytest tests/ -q   # 32 passing
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit
docker compose config --quiet
python -m scripts.benchmark
python -m scripts.evaluate_rankers
```

---

## 15. Current limitations

1. **NDCG/Recall are not yet valid** — human labels required (§9).
2. **Popularity is inert** — no behavioural data exists; its weight is
   redistributed at request time.
3. **`available_hotels` is always null** — Ascenda's price response does not
   confirm dated availability.
4. **2 of 45 destinations unseeded** — Athens and Jakarta return zero hotels
   from Ascenda, so they have no coordinates and nothing bookable.
5. **Destination profiles are AI-drafted, human-reviewed** — reviewed once and
   marked `REVIEWED`; not independently verified by a second reviewer.
6. **Single uvicorn worker** — throughput peaks at ~20 req/s; pool size is the
   bottleneck.
7. **No rerank after price completion** — cards are ranked once. When
   `pricingStatus: pending`, price labels fill in but order does not change, to
   avoid cards visibly reshuffling.

---

## 16. Future learning-to-rank path

Telemetry is already shaped for it. `recommendation_runs` is the query group;
`recommendation_items` stores the **feature snapshot at ranking time**, which is
what a model must train on — reconstructing features later from mutable
inventory tables would produce wrong training data.

Label hierarchy (max event reached within the attribution window):

```
0 impression   1 click   2 hotel_search / hotel_view
3 booking_started        4 booking_completed
```

Before LightGBM is credible you need, at minimum: thousands of recommendation
runs, hundreds of clicks, tens of completed bookings, coverage across most
source destinations, and time-based train/validation splits that never let one
run span both sides.

Promotion path: train candidate → offline evaluation → compare against the
weighted baseline → inspect per-segment performance → shadow mode → explicit
approval → enable by configuration. **A candidate model must never
self-promote.** Only shown candidates may carry implicit-feedback labels; an
unshown candidate is not a negative.
