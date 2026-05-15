-- Phase 1B cost control: coverage reuse provenance.
--
-- Coverage classifications are only safe to reuse when they came from a
-- completed sync job and the current coverage input hash still matches. These
-- columns let the worker reject classifications from failed/partial runs and
-- expire old decisions with an application-level TTL.

ALTER TABLE public.cp_seo_clusters
  ADD COLUMN coverage_cache_key text,
  ADD COLUMN coverage_classified_in_job_id bigint
    REFERENCES public.cp_seo_sync_jobs(id) ON DELETE SET NULL;

CREATE INDEX idx_seo_clusters_coverage_reuse
  ON public.cp_seo_clusters (coverage_cache_key, coverage_classified_at DESC)
  WHERE archived_at IS NULL
    AND coverage_cache_key IS NOT NULL
    AND coverage_classified_in_job_id IS NOT NULL;
