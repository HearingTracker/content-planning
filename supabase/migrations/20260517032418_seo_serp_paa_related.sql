-- Capture People Also Ask + Related Searches blocks from the DataForSEO live
-- SERP response. Both were previously discarded in lib/seo/serp-data.ts even
-- though they arrive in the same payload as the organic results.
--
-- These two signals power the FAQ-gap surface and the external-competitor
-- gap analysis in the coverage classifier: PAA tells us what readers click
-- through to ask next, related searches give cheap topic adjacency.
--
-- Columns are intentionally nullable so existing rows are distinguishable
-- from post-migration rows that genuinely fetched an empty PAA/related block.
-- Cache reads in serp-data.ts treat NULL rows as misses, so the next sync
-- re-fetches and back-fills them naturally — no manual backfill needed.

ALTER TABLE public.cp_seo_serp_cache
  ADD COLUMN paa_questions   jsonb,
  ADD COLUMN related_searches jsonb;
