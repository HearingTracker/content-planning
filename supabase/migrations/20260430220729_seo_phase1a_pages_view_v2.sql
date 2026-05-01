-- Phase 1A · Rebuild cp_seo_pages_with_stats off clusters
-- ────────────────────────────────────────────────────────────────────────────
-- Same table shape consumed by the dashboard, but aggregated from
-- cp_seo_clusters now instead of cp_seo_opportunities. Once the first
-- cluster sync runs, the dashboard reads cluster-level potential without
-- N+1 queries — exactly what the existing UI was designed for.
--
-- Falls back gracefully when no clusters exist yet (every aggregate column
-- COALESCEs to 0). Old kind columns (open_primary/supporting/secondary) are
-- mapped to the new kind keys: coverage_strong, coverage_partial, intent_gap.
-- During the transitional period (kind='needs_review' on every cluster), all
-- breakdowns will read zero — the UI will show a single "Needs review"
-- count instead, which the new SyncJobControl + drawer copy will reinforce.

-- Existing view has a fixed column ordering; CREATE OR REPLACE refuses to
-- inject new columns mid-list. Drop and re-create.
DROP VIEW IF EXISTS public.cp_seo_pages_with_stats;

CREATE VIEW public.cp_seo_pages_with_stats
WITH (security_invoker = true)
AS
WITH cluster_agg AS (
  SELECT
    c.page                                                           AS page,
    -- Per-kind counts, mapped to the new keys. Old UI columns kept for
    -- backwards-compat during transition; new fields below extend them.
    COUNT(*) FILTER (WHERE k.kind_key = 'coverage_strong')::int      AS open_primary,
    COUNT(*) FILTER (WHERE k.kind_key = 'coverage_partial')::int     AS open_supporting,
    COUNT(*) FILTER (WHERE k.kind_key = 'intent_gap')::int           AS open_secondary,
    COUNT(*) FILTER (WHERE k.kind_key = 'needs_review')::int         AS open_needs_review,
    COUNT(*) FILTER (WHERE k.kind_key = 'snippet_ctr')::int          AS open_snippet_ctr,
    COUNT(*) FILTER (WHERE k.kind_key = 'wrong_page')::int           AS open_wrong_page,
    COUNT(*) FILTER (WHERE k.kind_key = 'freshness')::int            AS open_freshness,
    COUNT(*)::int                                                    AS open_clusters,

    COALESCE(SUM(c.total_impressions),   0)::int AS open_impressions,
    COALESCE(SUM(c.total_volume),        0)::int AS open_volume,
    COALESCE(SUM(c.total_missed_clicks), 0)::int AS open_missed_clicks,
    AVG(c.avg_position)::numeric(4,1)            AS avg_position,
    MAX(c.score)::int                            AS max_score
  FROM public.cp_seo_clusters c
  LEFT JOIN public.cp_seo_opportunities o
    ON o.cluster_id = c.id AND o.archived_at IS NULL
  CROSS JOIN LATERAL (SELECT COALESCE(o.kind_text, 'needs_review') AS kind_key) k
  WHERE c.archived_at IS NULL
  GROUP BY c.page
),
top_cluster AS (
  SELECT DISTINCT ON (c.page)
    c.page,
    c.label                          AS top_query,           -- legacy column name; now holds cluster label
    COALESCE(o.kind_text, 'needs_review') AS top_kind,
    c.member_count                   AS top_member_count,
    c.score                          AS top_score
  FROM public.cp_seo_clusters c
  LEFT JOIN public.cp_seo_opportunities o
    ON o.cluster_id = c.id AND o.archived_at IS NULL
  WHERE c.archived_at IS NULL
  ORDER BY c.page, c.score DESC, c.id ASC
)
SELECT
  p.page,
  p.page_title,
  p.meta_source,
  p.earnings_90d,
  p.conversions_90d,
  p.open_opportunities,
  p.last_synced_at,
  -- Legacy kind columns (used by current UI; mapped from new kind keys)
  COALESCE(a.open_primary,        0) AS open_primary,
  COALESCE(a.open_supporting,     0) AS open_supporting,
  COALESCE(a.open_secondary,      0) AS open_secondary,
  -- New kind columns (used by Phase 1A+ UI)
  COALESCE(a.open_needs_review,   0) AS open_needs_review,
  COALESCE(a.open_snippet_ctr,    0) AS open_snippet_ctr,
  COALESCE(a.open_wrong_page,     0) AS open_wrong_page,
  COALESCE(a.open_freshness,      0) AS open_freshness,
  COALESCE(a.open_clusters,       0) AS open_clusters,
  -- Potential metrics
  COALESCE(a.open_impressions,    0) AS open_impressions,
  COALESCE(a.open_missed_clicks,  0) AS open_missed_clicks,
  COALESCE(a.open_volume,         0) AS open_volume,
  a.avg_position,
  COALESCE(a.max_score,           0) AS max_score,
  -- Top opportunity preview (cluster-level)
  t.top_query,
  t.top_kind,
  t.top_member_count,
  t.top_score
FROM public.cp_seo_pages p
LEFT JOIN cluster_agg a ON a.page = p.page
LEFT JOIN top_cluster t ON t.page = p.page;

GRANT SELECT ON public.cp_seo_pages_with_stats TO authenticated;
