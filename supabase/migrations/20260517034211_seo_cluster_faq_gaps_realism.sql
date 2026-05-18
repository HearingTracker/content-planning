-- Gap-aware classifier outputs (Phase 2, prompt v19). The coverage
-- classifier now judges:
--   1. Per-FAQ-candidate coverage — for each PAA / question-shaped keyword
--      provided in the prompt, whether the page already answers it.
--   2. Competitor realism — winnable | snippet_only | unrealistic, with a
--      short reasoning sentence referencing a specific SERP signal.
--
-- Both live on cp_seo_clusters (parallel to coverage_recommendation,
-- start_with_queries, etc.) so:
--   - the sync upserts a single row per cluster
--   - the reuse cache path can rehydrate the full CoverageResult on the
--     next sync without re-calling the LLM
--   - the drilldown UI reads them via the existing JOIN from
--     cp_seo_opportunities, no new column on opportunities required
--
-- Shapes:
--   faq_gaps         jsonb[] -- [{question, covered, volume|null}]
--   competitor_realism jsonb -- {verdict, reasoning} or null when the
--                                fail-soft fallback fired (classification
--                                error path)

ALTER TABLE public.cp_seo_clusters
  ADD COLUMN faq_gaps           jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN competitor_realism jsonb;
