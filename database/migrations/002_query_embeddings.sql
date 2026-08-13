-- ============================================================================
-- Precomputed query embeddings
--
-- Apply after 001. Idempotent: safe to re-run.
--
-- WHY THIS EXISTS
-- Without a traveller `intent` string, the retrieval query text is fully
-- determined by the origin destination:
--
--     "Find travel destinations similar to {name}, {country}.
--      Origin characteristics: {description}
--      Origin experiences and attributes: {sorted tags}."
--
-- So there are exactly N possible query vectors, one per destination. Storing
-- them lets the SERVING container run without PyTorch or the model at all
-- (EMBEDDING_MODE=precomputed), which drops the image from ~2 GB to ~150 MB
-- and resident memory from ~430 MB to ~80 MB -- enough to fit a free tier.
--
-- The model still produces every vector; it just runs offline during seeding
-- rather than in the deployed container. Requests that supply `intent` still
-- need EMBEDDING_MODE=live, because that text cannot be known in advance.
-- ============================================================================

alter table public.destinations
  add column if not exists query_embedding extensions.vector(384);

comment on column public.destinations.query_embedding is
  'Precomputed embedding of the no-intent retrieval query for this origin. '
  'Populated by scripts.seed_destinations. Lets the serving container skip '
  'loading the embedding model (EMBEDDING_MODE=precomputed).';
