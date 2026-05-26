-- Keep the /seo page list aligned with workflow state.
--
-- The previous cluster-backed view joined non-archived opportunities without
-- filtering status, so dismissed/done/in-progress opportunities could still
-- drive a page's open-cluster counts, top opportunity, and priority score.
-- This rebuilds the ranking aggregates from open opportunities only, while
-- exposing a separate page-level status rollup for sorting the URL list.

DROP VIEW IF EXISTS public.cp_seo_pages_with_stats;

CREATE VIEW public.cp_seo_pages_with_stats
WITH (security_invoker = true)
AS
WITH opportunity_status AS (
  SELECT
    o.page AS page,
    COUNT(*) FILTER (WHERE status = 'open')::int        AS task_open_count,
    COUNT(*) FILTER (WHERE status = 'in_progress')::int AS task_in_progress_count,
    COUNT(*) FILTER (WHERE status = 'done')::int        AS task_done_count,
    COUNT(*) FILTER (WHERE status = 'dismissed')::int   AS task_dismissed_count
  FROM public.cp_seo_opportunities o
  JOIN public.cp_seo_clusters c
    ON c.id = o.cluster_id
   AND c.archived_at IS NULL
  WHERE o.archived_at IS NULL
  GROUP BY o.page
),
open_cluster_agg AS (
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
  JOIN public.cp_seo_opportunities o
    ON o.cluster_id = c.id
   AND o.archived_at IS NULL
   AND o.status = 'open'
  CROSS JOIN LATERAL (SELECT COALESCE(o.kind_text, 'needs_review') AS kind_key) k
  WHERE c.archived_at IS NULL
  GROUP BY c.page
),
top_cluster AS (
  SELECT DISTINCT ON (c.page)
    c.page,
    c.label                              AS top_query,
    COALESCE(o.kind_text, 'needs_review') AS top_kind,
    c.member_count                       AS top_member_count,
    c.score                              AS top_score
  FROM public.cp_seo_clusters c
  JOIN public.cp_seo_opportunities o
    ON o.cluster_id = c.id
   AND o.archived_at IS NULL
   AND o.status = 'open'
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
  -- Potential metrics from open opportunities only.
  COALESCE(a.open_impressions,    0) AS open_impressions,
  COALESCE(a.open_missed_clicks,  0) AS open_missed_clicks,
  COALESCE(a.open_volume,         0) AS open_volume,
  a.avg_position,
  COALESCE(a.max_score,           0) AS max_score,
  -- Top open opportunity preview (cluster-level).
  t.top_query,
  t.top_kind,
  t.top_member_count,
  t.top_score,
  -- Workflow rollup across all non-archived SEO opportunities on the page.
  CASE
    WHEN COALESCE(s.task_open_count, 0) > 0 THEN 'open'
    WHEN COALESCE(s.task_in_progress_count, 0) > 0 THEN 'in_progress'
    WHEN COALESCE(s.task_done_count, 0) > 0 THEN 'done'
    WHEN COALESCE(s.task_dismissed_count, 0) > 0 THEN 'dismissed'
    ELSE NULL
  END AS task_status,
  COALESCE(s.task_open_count,        0) AS task_open_count,
  COALESCE(s.task_in_progress_count, 0) AS task_in_progress_count,
  COALESCE(s.task_done_count,        0) AS task_done_count,
  COALESCE(s.task_dismissed_count,   0) AS task_dismissed_count
FROM public.cp_seo_pages p
LEFT JOIN open_cluster_agg a ON a.page = p.page
LEFT JOIN top_cluster      t ON t.page = p.page
LEFT JOIN opportunity_status s ON s.page = p.page;

GRANT SELECT ON public.cp_seo_pages_with_stats TO authenticated;
