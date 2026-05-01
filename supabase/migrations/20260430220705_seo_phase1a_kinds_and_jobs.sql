-- Phase 1A · Kinds lookup + sync jobs + pgvector extension
-- ────────────────────────────────────────────────────────────────────────────
-- Three pieces of plumbing the cluster + matching pipeline depends on:
--   1. pgvector extension for centroid storage and cosine search
--   2. cp_seo_opportunity_kinds — replaces the postgres enum so we can iterate
--      product states (intent_gap, coverage_partial, snippet_ctr, …) without
--      enum migrations. Carries UI metadata so the frontend renders kinds
--      without hardcoded TypeScript constants.
--   3. cp_seo_sync_jobs — durable job tracking so the admin "Refresh now"
--      button can poll progress while the worker is running.

CREATE EXTENSION IF NOT EXISTS vector;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Kinds lookup
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE public.cp_seo_opportunity_kinds (
  key            text PRIMARY KEY,
  display_label  text NOT NULL,         -- "Add a new section"
  short_label    text NOT NULL,         -- "Section"
  action_verb    text NOT NULL,         -- "add a section"
  description    text NOT NULL,         -- one-liner shown to authors
  ui_tone        text NOT NULL,         -- 'amber' | 'blue' | 'emerald' | 'rose' | 'slate'
  ui_icon        text NOT NULL,         -- lucide icon name
  priority_order integer NOT NULL,      -- lower = surface first in queues
  enabled        boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cp_seo_opportunity_kinds
  (key, display_label, short_label, action_verb, description, ui_tone, ui_icon, priority_order)
VALUES
  ('needs_review',     'Needs review',          'Review',     'review',                  'Grouped queries. Guidance pending.',                          'slate',   'Loader',       100),
  ('intent_gap',       'Add a new section',     'Section',    'add a section',           'Reader intent isn''t answered on this page.',                 'amber',   'Plus',          10),
  ('coverage_partial', 'Extend this page',      'Extend',     'extend the page',         'Page touches the topic but doesn''t fully answer it.',        'blue',    'Type',          20),
  ('coverage_strong',  'Already covered',       'Covered',    'monitor only',            'Page already answers this — just monitor.',                   'emerald', 'CheckCircle2',  90),
  ('snippet_ctr',      'Improve search appeal', 'Snippet',    'improve title and meta',  'Ranking is fine but click-through is weak.',                  'blue',    'Sparkles',      30),
  ('wrong_page',       'Write elsewhere',       'Elsewhere',  'send to another page',    'This belongs on a different page — don''t add it here.',      'rose',    'ExternalLink',   5),
  ('freshness',        'Refresh this page',     'Refresh',    'refresh facts',           'Pricing or model details may be outdated.',                   'amber',   'RefreshCw',     40);

ALTER TABLE public.cp_seo_opportunity_kinds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read kinds"
  ON public.cp_seo_opportunity_kinds FOR SELECT
  TO authenticated USING (true);

-- Editors+ may toggle enabled or tweak labels later; admins can insert new kinds.
CREATE POLICY "editor update kinds"
  ON public.cp_seo_opportunity_kinds FOR UPDATE
  TO authenticated
  USING (public.cp_user_is_editor_or_above())
  WITH CHECK (public.cp_user_is_editor_or_above());

CREATE POLICY "admin insert kinds"
  ON public.cp_seo_opportunity_kinds FOR INSERT
  TO authenticated
  WITH CHECK (public.cp_user_is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Sync jobs
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE public.cp_seo_sync_jobs (
  id              bigserial PRIMARY KEY,
  trigger         text NOT NULL CHECK (trigger IN ('cron', 'admin')),
  triggered_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed'))
                  DEFAULT 'pending',

  -- Live progress, written by the worker as it advances
  current_phase   text,                  -- 'gsc' | 'earnings' | 'metadata' | 'embed' | 'cluster' | 'label' | 'match' | 'upsert' | 'done'
  phase_progress  jsonb,                 -- { completed: 230, total: 450, label?: 'queries' }
  phase_history   jsonb NOT NULL DEFAULT '[]'::jsonb,
  log_tail        text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- Outcome (filled at completion)
  pages_processed         integer,
  clusters_created        integer,
  clusters_matched        integer,
  clusters_review_flagged integer,
  clusters_archived       integer,
  opportunities_total     integer,

  -- Cost tracking pulled off provider response metadata
  embedding_tokens     integer NOT NULL DEFAULT 0,
  llm_input_tokens     integer NOT NULL DEFAULT 0,
  llm_output_tokens    integer NOT NULL DEFAULT 0,
  estimated_cost_usd   numeric(10,4) NOT NULL DEFAULT 0,

  -- Lifecycle
  triggered_at   timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  failed_at      timestamptz,
  error_message  text
);

-- Used by the UI: "is a job running right now?" — partial index keeps it tiny.
CREATE INDEX idx_seo_sync_jobs_active ON public.cp_seo_sync_jobs(triggered_at DESC)
  WHERE status IN ('pending', 'running');

-- For the admin history view.
CREATE INDEX idx_seo_sync_jobs_recent ON public.cp_seo_sync_jobs(triggered_at DESC);

CREATE TRIGGER cp_seo_sync_jobs_updated_at
  BEFORE UPDATE ON public.cp_seo_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.cp_seo_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read job status (so the polling UI works for everyone),
-- only admins can insert (trigger a sync), and only the worker (service role) can update.
CREATE POLICY "auth read sync jobs"
  ON public.cp_seo_sync_jobs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin trigger sync jobs"
  ON public.cp_seo_sync_jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.cp_user_is_admin());

-- Updates happen via service role from the worker; no policy for authenticated
-- writes, which is intentional.
