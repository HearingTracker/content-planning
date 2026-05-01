-- Phase 1B · Cannibalization step + low-hanging-fruit anchor queries
-- ────────────────────────────────────────────────────────────────────────────
-- Two additions on top of the coverage classifier:
--
-- 1. Cannibalization-aware kinds — the classifier needs to be able to tell
--    editors "multiple HearingTracker pages compete for these queries; this
--    one should win" or "a sibling page is the better target; cede here."
--    Two new entries in cp_seo_opportunity_kinds enable that:
--       • consolidate — claim the topic on this page; sibling pages should
--         de-target.
--       • cede        — defer to a sibling page; don't optimize this one.
--
-- 2. Anchor queries — a deterministic top-3-to-5 ranking of cluster members
--    by volume / max(kd, 1) × striking_distance_factor. Computed in code in
--    the sync worker (NOT by the LLM — we want this to be reproducible). The
--    classifier sees them as "anchor queries the recommendation should name"
--    and the UI surfaces them as a "✨ start with" highlight on the chip
--    cloud. Stored as a jsonb array of { query, score } so order survives.
--
-- 3. Cannibalization snapshot — { query: ['/page-a', '/page-b', ...] } for
--    cluster members that ALSO rank in striking distance on other revenue
--    pages. Empty object means no overlap detected this sync. Lets the
--    classifier reason about cross-page competition without re-querying
--    the findings table.

INSERT INTO public.cp_seo_opportunity_kinds
  (key, display_label, short_label, action_verb, description, ui_tone, ui_icon, priority_order)
VALUES
  ('consolidate', 'Claim this topic',     'Claim',
    'win the topic on this page',
    'Multiple pages compete for these queries — this page should win.',
    'amber', 'Trophy', 15),
  ('cede',        'Cede to another page', 'Cede',
    'cede to a sibling page',
    'A sibling page is the stronger target — don''t optimize this one.',
    'slate', 'CornerUpRight', 25);

ALTER TABLE public.cp_seo_clusters
  ADD COLUMN anchor_queries   jsonb,
  ADD COLUMN cannibal_overlap jsonb;
