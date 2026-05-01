-- Phase 1A · Snapshot existing user state before cluster reshape
-- ────────────────────────────────────────────────────────────────────────────
-- Captures the query-level status / assignee / notes that exist on
-- cp_seo_opportunities right now. After the first cluster-driven sync runs,
-- a one-shot reattachment script will copy non-default user state onto the
-- new cluster-level opportunity rows. Anything unmatched stays here forever
-- as an audit trail.
--
-- We snapshot now (before sync) rather than after to guarantee we never lose
-- in-flight work, even if the cluster pipeline crashes mid-run.

CREATE TABLE public.cp_seo_user_state_archive_2026_05 (
  id              bigint PRIMARY KEY,                         -- mirrors source row id
  page            text NOT NULL,
  query           text NOT NULL,
  kind            public.cp_seo_opp_kind,                     -- legacy enum; OK to reference because the type still exists
  status          public.cp_seo_opp_status NOT NULL,
  assigned_to     uuid,
  notes           text,
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,
  snapshotted_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cp_seo_user_state_archive_2026_05
  (id, page, query, kind, status, assigned_to, notes, first_seen_at, last_seen_at)
SELECT
  id, page, query, kind, status, assigned_to, notes, first_seen_at, last_seen_at
FROM public.cp_seo_opportunities;

CREATE INDEX idx_seo_user_archive_state ON public.cp_seo_user_state_archive_2026_05(page, query)
  WHERE status <> 'open' OR notes IS NOT NULL OR assigned_to IS NOT NULL;

ALTER TABLE public.cp_seo_user_state_archive_2026_05 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read user state archive"
  ON public.cp_seo_user_state_archive_2026_05 FOR SELECT
  TO authenticated USING (public.cp_user_is_admin());
