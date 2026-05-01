-- Phase 1B · Coverage classifier
-- ────────────────────────────────────────────────────────────────────────────
-- Phase 1A landed every cluster with kind='needs_review' as a placeholder.
-- Phase 1B asks an LLM to look at the cluster's queries alongside the page's
-- actual body + heading outline, and decide what an editor should do about
-- the cluster: extend coverage, add a new section, send to a different page,
-- improve the snippet, or just monitor.
--
-- The classified kind is written to cp_seo_opportunities.kind_text (the
-- existing FK to cp_seo_opportunity_kinds), and the LLM's recommendation +
-- confidence + audit trail are stored on cp_seo_clusters so re-running the
-- classifier on the same cluster is idempotent (overwrites in place).
--
-- The classifier uses five of the seven 1A kinds:
--   coverage_strong | coverage_partial | intent_gap | wrong_page | snippet_ctr
-- Two more (consolidate, cede) land in the follow-up migration that adds the
-- cannibalization step.

ALTER TABLE public.cp_seo_clusters
  ADD COLUMN coverage_kind            text REFERENCES public.cp_seo_opportunity_kinds(key),
  ADD COLUMN coverage_recommendation  text,
  ADD COLUMN coverage_confidence      numeric(3,2),
  ADD COLUMN coverage_model           text,
  ADD COLUMN coverage_prompt_v        text,
  ADD COLUMN coverage_input_digest    jsonb,
  ADD COLUMN coverage_classified_at   timestamptz;

-- Confidence is reported as 0.00–1.00; reject anything outside the band so
-- a malformed model response can't poison downstream sorts/filters.
ALTER TABLE public.cp_seo_clusters
  ADD CONSTRAINT cp_seo_clusters_coverage_confidence_range
    CHECK (coverage_confidence IS NULL OR (coverage_confidence >= 0 AND coverage_confidence <= 1));

-- Surface low-confidence classifications in the admin review screen the
-- 1A.5 workflow already uses; partial index keeps it cheap.
CREATE INDEX idx_seo_clusters_low_confidence
  ON public.cp_seo_clusters (coverage_classified_at DESC)
  WHERE archived_at IS NULL AND coverage_confidence IS NOT NULL AND coverage_confidence < 0.6;
