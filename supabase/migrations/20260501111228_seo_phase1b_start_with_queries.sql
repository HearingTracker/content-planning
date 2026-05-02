-- Phase 1B coverage classifier — LLM-curated "start with" anchors.
--
-- The deterministic anchor list (`anchor_queries`) is the candidate pool the
-- classifier sees. `start_with_queries` is the subset the classifier endorses
-- after weighing body coverage and cannibalization signals — these are the
-- ones the UI highlights with the ✨ "start with" badge.
--
-- Empty array is the correct value for kind=coverage_strong / wrong_page /
-- cede (no recommended starting point on this page).

ALTER TABLE public.cp_seo_clusters
  ADD COLUMN start_with_queries jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.cp_seo_clusters.start_with_queries IS
  'jsonb array of 0–3 anchor query strings the classifier endorses for first-action highlighting. Subset of anchor_queries.';
