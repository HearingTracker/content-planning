-- Phase 1D · Blind-spot synthesis kinds + supporting data
-- ────────────────────────────────────────────────────────────────────────────
-- v1 of the synthesis layer (Phase 1C) covered offensive strategic moves the
-- per-cluster classifier can't make. v2 (this migration) covers four blind
-- spots that neither layer surfaces today, every one of which the manual
-- senior review explicitly named:
--
--   • authority_capped_serp — top 5 SERP dominated by .gov/.edu/Mayo/NIH;
--     rank ceiling is link authority, not on-page anything.
--   • brand_cannibalization — multiple HT pages competing on a branded
--     query; the brand-specific page should win.
--   • freshness — stale year-stamps, content age > 365 days, or rank
--     decline over an 8-week window.
--   • internal_link_gap — page ranks pos 1-3 for a high-volume query but
--     no other HT page links to it (link-equity allocation problem).
--
-- Two of the four are pure heuristics over data we already store. The
-- other two need new data sources, captured by extending the sync pipeline:
--
--   • content_modified_at — read from the n4-article Storyblok block's
--     `updated` field (editor-managed, only bumped on meaningful updates).
--   • outbound_internal_links — extracted from raw HTML before stripHtml().
--   • rank history — point-in-time snapshot per (page, query) per sync,
--     used by the freshness detector's rank-decline signal.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. New synthesis kinds
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO public.cp_seo_synthesis_kinds
  (key, display_label, short_label, description, ui_tone, ui_icon, priority_order)
VALUES
  ('authority_capped_serp', 'Authority-capped SERP',  'Authority',
    'Top 10 dominated by .gov/.edu/Mayo/NIH — rank ceiling is link authority, not on-page.',
    'slate', 'ShieldCheck', 30),
  ('brand_cannibalization', 'Brand cannibalization',  'Brand',
    'Multiple HearingTracker pages compete on a branded query — designate the brand-specific page.',
    'rose',  'Tags',        12),
  ('freshness',             'Stale content',          'Stale',
    'Title carries an outdated year-stamp, content has not been touched in over a year, or rank has been declining.',
    'amber', 'Calendar',    35),
  ('internal_link_gap',     'No inbound HT links',    'Linkless',
    'Page ranks top-3 for a high-volume query but no other HearingTracker page links to it — pour link equity.',
    'blue',  'Link',        8);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Page modification date + outbound link graph
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cp_seo_pages
  ADD COLUMN content_modified_at      timestamptz,
  ADD COLUMN outbound_internal_links  jsonb;

COMMENT ON COLUMN public.cp_seo_pages.content_modified_at IS
  'Editor-managed last-modified date pulled from the n4-article Storyblok block''s `updated` field (fallback `published`). NULL for non-Storyblok pages or pages without an n4-article block. Used by the freshness detector.';
COMMENT ON COLUMN public.cp_seo_pages.outbound_internal_links IS
  'Array of normalized HT paths linked-to from this page''s body (e.g. [\"/hearing-aids/phonak\", \"/best-hearing-aids\"]). Inverted in-memory by the synthesizer to compute inbound counts for internal_link_gap detection.';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Rank-history time-series for freshness rank-decline signal
-- ──────────────────────────────────────────────────────────────────────────
-- Every sync writes a point-in-time snapshot per (page, query). The
-- freshness detector compares the most-recent snapshot against the snapshot
-- ~8 weeks prior to flag pages whose rank has been dropping. Without this
-- table, rank-decline detection is structurally impossible — cp_seo_query_findings
-- always reflects the LATEST sync only.
--
-- Retention: 90 days, enforced by a periodic DELETE in the sync worker.
-- Storage stays bounded — at HT scale this is well under 1M rows.

CREATE TABLE public.cp_seo_rank_history (
  page         text         NOT NULL REFERENCES public.cp_seo_pages(page) ON DELETE CASCADE,
  query        text         NOT NULL,
  position     numeric      NOT NULL,
  recorded_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (page, query, recorded_at)
);

CREATE INDEX idx_seo_rank_history_recorded_at
  ON public.cp_seo_rank_history (recorded_at DESC);

CREATE INDEX idx_seo_rank_history_page_query_recorded
  ON public.cp_seo_rank_history (page, query, recorded_at DESC);

ALTER TABLE public.cp_seo_rank_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read rank history"
  ON public.cp_seo_rank_history FOR SELECT
  TO authenticated USING (true);
