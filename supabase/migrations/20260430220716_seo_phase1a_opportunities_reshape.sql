-- Phase 1A · Reshape opportunities to cluster-level
-- ────────────────────────────────────────────────────────────────────────────
-- Additive in this migration: add cluster_id + kind_text (FK to the kinds
-- lookup) so the new cluster pipeline can write rows. The legacy query-level
-- columns and the old kind enum stay intact until a follow-up migration
-- (after the first cluster-driven sync proves out) drops them.
--
-- This intentionally allows a brief "both old and new shape" window — only
-- service-role inserts during sync use the new path; existing reads keep
-- working off the legacy columns until UI is migrated too.

ALTER TABLE public.cp_seo_opportunities
  ADD COLUMN cluster_id bigint REFERENCES public.cp_seo_clusters(id) ON DELETE CASCADE,
  ADD COLUMN kind_text  text REFERENCES public.cp_seo_opportunity_kinds(key);

CREATE INDEX idx_seo_opps_cluster ON public.cp_seo_opportunities(cluster_id) WHERE archived_at IS NULL;
CREATE INDEX idx_seo_opps_kind_text ON public.cp_seo_opportunities(kind_text) WHERE archived_at IS NULL;
