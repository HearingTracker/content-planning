-- Phase 1C · Site-wide synthesis layer
-- ────────────────────────────────────────────────────────────────────────────
-- The per-cluster classifier (coverage.ts, prompt v11) makes DEFENSIVE
-- decisions on a single (page, cluster) at a time: don't optimize this
-- anchor, don't claim recoverable CTR, don't ship a destructive action.
-- It cannot make OFFENSIVE strategic recommendations across the URL graph
-- because it never sees the whole site at once.
--
-- This migration adds the storage for a thin synthesis layer that runs AFTER
-- the per-cluster classifier completes, reads the frozen verdicts + SERP
-- cache + cp_seo_query_findings, and surfaces cross-page insights:
--
--   • fully_ceded_page    — most anchors are won by a different HT URL
--   • undesignated_topic  — multiple HT pages compete just outside top 10
--   • aio_no_citation     — AIO present, no HT URL cited
--   • orphan_target       — adjacent topic with high SV, no HT page in top 30
--
-- Detection is deterministic (TS aggregations over already-stored data); the
-- per-cluster classifier output is treated as immutable input. To enable
-- detection of fully_ceded_page in SQL, we also persist the per-anchor
-- external_canonical that the classifier currently keeps only in-memory.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Synthesis kind taxonomy (parallel to cp_seo_opportunity_kinds)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE public.cp_seo_synthesis_kinds (
  key            text PRIMARY KEY,
  display_label  text NOT NULL,
  short_label    text NOT NULL,
  description    text NOT NULL,
  ui_tone        text NOT NULL,         -- 'amber' | 'blue' | 'emerald' | 'rose' | 'slate'
  ui_icon        text NOT NULL,         -- lucide icon name
  priority_order integer NOT NULL,
  enabled        boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cp_seo_synthesis_kinds
  (key, display_label, short_label, description, ui_tone, ui_icon, priority_order)
VALUES
  ('fully_ceded_page',   'Page may be redundant',     'Redundant',
    'Most anchors on this page are already won by a different HearingTracker URL.',
    'rose',  'Trash2',   5),
  ('undesignated_topic', 'Pick a winner',             'Designate',
    'Multiple HearingTracker pages compete just outside top 10 — none owns the SERP yet.',
    'amber', 'Crown',   15),
  ('orphan_target',      'No HT page ranks',          'Orphan',
    'Topically adjacent query with high search volume where no HearingTracker URL ranks in top 30.',
    'amber', 'Compass', 20),
  ('aio_no_citation',    'AIO with no HT citation',   'AIO Gap',
    'AI Overview shows for this query but no HearingTracker URL is cited as a source.',
    'blue',  'Bot',     25);

ALTER TABLE public.cp_seo_synthesis_kinds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read synthesis kinds"
  ON public.cp_seo_synthesis_kinds FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "editor update synthesis kinds"
  ON public.cp_seo_synthesis_kinds FOR UPDATE
  TO authenticated
  USING (public.cp_user_is_editor_or_above())
  WITH CHECK (public.cp_user_is_editor_or_above());

CREATE POLICY "admin insert synthesis kinds"
  ON public.cp_seo_synthesis_kinds FOR INSERT
  TO authenticated
  WITH CHECK (public.cp_user_is_admin());

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Synthesis findings — full-rebuild each sync run
-- ──────────────────────────────────────────────────────────────────────────
-- Identity is (kind, identity_hash) where identity_hash is sha256 of stable
-- per-kind keys (page for fully_ceded_page; query for the other three).
-- Findings that disappear on a subsequent run get archived_at set; persisting
-- findings update last_seen_at; new findings get first_seen_at = now().
--
-- scope_page / scope_query nullability invariants are enforced in TS (see
-- lib/seo/synthesis.ts), not via CHECK constraints, mirroring how the per-
-- cluster classifier enforces kind invariants in code rather than the DB.

CREATE TABLE public.cp_seo_synthesis_findings (
  id                       bigserial PRIMARY KEY,
  kind                     text NOT NULL REFERENCES public.cp_seo_synthesis_kinds(key),

  -- Scope: fully_ceded_page → scope_page set; the other three → scope_query set.
  scope_page               text REFERENCES public.cp_seo_pages(page) ON DELETE CASCADE,
  scope_query              text,

  -- Optional pointer to the recommended page to act on (e.g. orphan_target's
  -- topically-adjacent owner; undesignated_topic's winning candidate).
  target_page              text REFERENCES public.cp_seo_pages(page) ON DELETE SET NULL,

  -- Deterministic ranking signal for dashboard sorting. Each kind defines its
  -- own meaning (recorded in evidence.score_rationale).
  score                    numeric(12,2) NOT NULL,

  -- Per-kind evidence jsonb — see lib/seo/synthesis.ts for shapes. Always
  -- carries the threshold values used so retrospective tuning audits work.
  evidence                 jsonb NOT NULL,

  -- Sync bookkeeping.
  detected_in_job_id       bigint REFERENCES public.cp_seo_sync_jobs(id) ON DELETE SET NULL,
  first_seen_at            timestamptz NOT NULL DEFAULT now(),
  last_seen_at             timestamptz NOT NULL DEFAULT now(),
  archived_at              timestamptz,

  -- Identity hash — cross-run continuity. Synthesizer rebuilds findings each
  -- run; matching by (kind, identity_hash) preserves first_seen_at and lets
  -- us track resolution time.
  identity_hash            text NOT NULL,

  UNIQUE (kind, identity_hash)
);

CREATE INDEX idx_synth_kind_score
  ON public.cp_seo_synthesis_findings (kind, score DESC)
  WHERE archived_at IS NULL;

CREATE INDEX idx_synth_scope_page
  ON public.cp_seo_synthesis_findings (scope_page)
  WHERE archived_at IS NULL AND scope_page IS NOT NULL;

CREATE INDEX idx_synth_target_page
  ON public.cp_seo_synthesis_findings (target_page)
  WHERE archived_at IS NULL AND target_page IS NOT NULL;

CREATE INDEX idx_synth_scope_query
  ON public.cp_seo_synthesis_findings (scope_query)
  WHERE archived_at IS NULL AND scope_query IS NOT NULL;

ALTER TABLE public.cp_seo_synthesis_findings ENABLE ROW LEVEL SECURITY;

-- Reads open to authenticated users (matches cp_seo_clusters pattern); writes
-- happen via service role only from the SEO sync worker.
CREATE POLICY "auth read synthesis findings"
  ON public.cp_seo_synthesis_findings FOR SELECT
  TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Persist per-anchor external_canonical on cp_seo_clusters
-- ──────────────────────────────────────────────────────────────────────────
-- The coverage classifier already computes, in-memory, which anchors have a
-- different HT URL ranking ≤10 in the live SERP. Today only the COUNT is
-- persisted (in coverage_input_digest.external_canonical_anchor_count). The
-- synthesizer needs the per-anchor canonicals to detect fully_ceded_page,
-- so we persist the full array as an additive column.
--
-- Shape: [{query, url, position, kd, volume}]. Only anchors WITH an external
-- canonical appear in the array; anchors without one are simply absent.

ALTER TABLE public.cp_seo_clusters
  ADD COLUMN anchor_external_canonicals jsonb;

COMMENT ON COLUMN public.cp_seo_clusters.anchor_external_canonicals IS
  'Per-anchor SERP canonical — populated when a different HT URL ranks <=10 for the anchor query. Shape: [{query, url, position, kd, volume}]. Synthesizer reads this for fully_ceded_page detection (lib/seo/synthesis.ts).';
