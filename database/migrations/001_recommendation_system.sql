-- ============================================================================
-- Recommendation system schema
--
-- Apply via the Supabase SQL editor. Idempotent: safe to re-run.
--
-- VERIFIED against this project: `vector` and `postgis` both live in the
-- `extensions` schema, so extension types/functions are qualified accordingly.
-- ============================================================================

create extension if not exists vector  with schema extensions;
create extension if not exists postgis with schema extensions;

-- ============================================================================
-- destinations
-- `uid` is the REAL Ascenda destination identifier used by the frontend
-- search (LOCAL_DESTINATIONS.value).
-- ============================================================================
create table if not exists public.destinations (
  uid                text primary key,
  name               text not null,
  country_code       text,
  country_name       text not null,
  region             text,
  destination_type   text,
  description        text,
  tags               text[] not null default '{}',

  latitude           double precision,
  longitude          double precision,

  -- Generated PostGIS point. ST_MakePoint takes X (longitude) BEFORE Y
  -- (latitude) -- reversing these silently produces wrong distances.
  location extensions.geography(point, 4326)
    generated always as (
      case
        when longitude is not null and latitude is not null
        then extensions.st_setsrid(
               extensions.st_makepoint(longitude, latitude), 4326
             )::extensions.geography
        else null
      end
    ) stored,

  embedding          extensions.vector(384),
  embedding_model    text,
  embedding_version  text,

  popularity_score   real not null default 0
    constraint destinations_popularity_range
      check (popularity_score >= 0 and popularity_score <= 1),

  active             boolean not null default true,
  metadata           jsonb not null default '{}',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists destinations_location_gix
  on public.destinations using gist (location);

create index if not exists destinations_active_idx
  on public.destinations (active) where active = true;

-- NO VECTOR INDEX ON PURPOSE:
-- At ~46 rows a sequential scan is faster AND exact. IVFFlat/HNSW are
-- approximate -- they would trade recall for speed we do not need.
-- Revisit only if the catalogue grows by orders of magnitude:
--   create index destinations_embedding_hnsw on public.destinations
--     using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists destinations_set_updated_at on public.destinations;
create trigger destinations_set_updated_at
  before update on public.destinations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- recommendation_runs -- one row per request; future LightGBM query group
-- ============================================================================
create table if not exists public.recommendation_runs (
  id                uuid primary key default gen_random_uuid(),
  session_id        text,
  user_id           uuid,
  origin_uid        text not null
                      references public.destinations(uid) on delete cascade,
  intent            text,
  strategy          text not null
    constraint recommendation_runs_strategy_valid
      check (strategy in ('mixed', 'similar', 'nearby', 'value')),
  model_version     text not null,
  ranking_version   text not null,
  request_metadata  jsonb not null default '{}',
  latency_ms        integer,
  created_at        timestamptz not null default now()
);

create index if not exists recommendation_runs_origin_idx
  on public.recommendation_runs (origin_uid);
create index if not exists recommendation_runs_created_idx
  on public.recommendation_runs (created_at desc);

-- ============================================================================
-- recommendation_items -- feature snapshot at ranking time
--
-- COLUMN NAMING IS DELIBERATE:
--   hotel_count        = static Ascenda inventory (NOT dated availability)
--   available_hotels   = dated availability, only when the API confirms it
--   priced_hotel_count = hotels that returned a dated price
-- ============================================================================
create table if not exists public.recommendation_items (
  run_id             uuid not null
                       references public.recommendation_runs(id) on delete cascade,
  destination_uid    text not null
                       references public.destinations(uid) on delete cascade,

  initial_rank       integer not null,
  final_rank         integer,

  semantic_score     real,
  distance_km        double precision,
  distance_score     real,
  availability_score real,
  price_score        real,
  popularity_score   real,
  final_score        real,

  hotel_count        integer,
  available_hotels   integer,
  priced_hotel_count integer,
  minimum_price      numeric(12, 2),
  currency           text,

  explanation        jsonb not null default '{}',
  created_at         timestamptz not null default now(),

  primary key (run_id, destination_uid)
);

create index if not exists recommendation_items_destination_idx
  on public.recommendation_items (destination_uid);

-- ============================================================================
-- recommendation_events
-- ============================================================================
create table if not exists public.recommendation_events (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null
                     references public.recommendation_runs(id) on delete cascade,
  destination_uid  text
                     references public.destinations(uid) on delete set null,
  event_type       text not null
    constraint recommendation_events_type_valid
      check (event_type in (
        'impression', 'click', 'hotel_search',
        'hotel_view', 'booking_started', 'booking_completed'
      )),
  event_metadata   jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

create index if not exists recommendation_events_run_idx
  on public.recommendation_events (run_id);
create index if not exists recommendation_events_destination_idx
  on public.recommendation_events (destination_uid);
create index if not exists recommendation_events_created_idx
  on public.recommendation_events (created_at desc);
create index if not exists recommendation_events_type_idx
  on public.recommendation_events (event_type);

-- ============================================================================
-- Row Level Security -- deny by default.
--
-- RLS enabled with NO policies = anon/authenticated cannot touch these tables
-- at all. FastAPI connects with the Postgres role, which bypasses RLS.
-- Do NOT add an anon policy: the browser goes Hono -> FastAPI, never direct.
-- ============================================================================
alter table public.destinations           enable row level security;
alter table public.recommendation_runs    enable row level security;
alter table public.recommendation_items   enable row level security;
alter table public.recommendation_events  enable row level security;
