-- External gap signals per cluster — PAA, related searches, and
-- question-shaped keyword variants. Aggregated during the sync from
-- lib/seo/serp-data.ts (PAA + related_searches per anchor query) and
-- lib/seo/question-keywords.ts (DataForSEO Labs related-keywords filtered
-- to who/what/when/why/how/...). Frozen on the cluster row so downstream
-- consumers (coverage classifier, drilldown UI) don't have to recompute.
--
-- Shape:
--   {
--     paa: string[],                              -- deduped across anchors
--     related_searches: string[],                 -- deduped across anchors
--     question_keywords: Array<{q,vol|null}>      -- top by volume
--   }

ALTER TABLE public.cp_seo_clusters
  ADD COLUMN external_gap_signals jsonb NOT NULL DEFAULT '{}'::jsonb;
