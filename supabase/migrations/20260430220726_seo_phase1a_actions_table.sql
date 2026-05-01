-- Phase 1A · Actions measurement table
-- ────────────────────────────────────────────────────────────────────────────
-- Tracks the lifecycle of each cluster-level action: when it was created,
-- assigned, marked done, published — plus pre/post 28-day metrics so we can
-- eventually answer "did this brief actually move clicks/revenue?".
--
-- brief_id FK is added in Phase 3 once the briefs table exists. Plumbing only
-- in 1A — pre/post snapshot backfill lights up after the first cluster gets
-- marked published.

CREATE TABLE public.cp_seo_actions (
  id            bigserial PRIMARY KEY,
  cluster_id    bigint NOT NULL REFERENCES public.cp_seo_clusters(id) ON DELETE CASCADE,
  page          text NOT NULL,
  action_type   text NOT NULL,                                -- mirrors brief recommended_action / cluster kind
  status        text NOT NULL,                                -- 'open' | 'in_progress' | 'done' | 'dismissed' | 'published'
  assigned_to   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  brief_id      bigint,                                       -- FK added in Phase 3 once cp_seo_briefs exists

  -- Lifecycle
  created_at            timestamptz NOT NULL DEFAULT now(),
  marked_in_progress_at timestamptz,
  marked_done_at        timestamptz,
  published_at          timestamptz,                          -- detected via page-content-hash diff (or webhook later)

  -- Content-change fingerprints — distinguish "marked done but nothing changed"
  -- from "page changed materially"
  pre_page_content_hash  text,
  post_page_content_hash text,
  changed_headings       jsonb,
  changed_sections       jsonb,

  -- Pre/post snapshots (backfilled by cron N days after published_at)
  pre_28d_clicks       integer,
  pre_28d_impressions  integer,
  pre_28d_position     numeric(4,1),
  pre_28d_ctr          numeric(5,2),
  pre_90d_revenue      numeric(10,2),
  pre_90d_conversions  integer,
  post_28d_clicks      integer,
  post_28d_impressions integer,
  post_28d_position    numeric(4,1),
  post_28d_ctr         numeric(5,2),
  post_90d_revenue     numeric(10,2),
  post_90d_conversions integer,

  measurement_caveat text,                                    -- "concurrent algorithm update on 2026-06-12"
  confidence_note    text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_actions_cluster   ON public.cp_seo_actions(cluster_id);
CREATE INDEX idx_seo_actions_page      ON public.cp_seo_actions(page);
CREATE INDEX idx_seo_actions_published ON public.cp_seo_actions(published_at) WHERE published_at IS NOT NULL AND post_28d_clicks IS NULL;

CREATE TRIGGER cp_seo_actions_updated_at
  BEFORE UPDATE ON public.cp_seo_actions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.cp_seo_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read actions"
  ON public.cp_seo_actions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "editor write actions"
  ON public.cp_seo_actions FOR INSERT
  TO authenticated WITH CHECK (public.cp_user_is_editor_or_above());

CREATE POLICY "editor update actions"
  ON public.cp_seo_actions FOR UPDATE
  TO authenticated
  USING (public.cp_user_is_editor_or_above())
  WITH CHECK (public.cp_user_is_editor_or_above());
