-- View that joins cp_seo_pages with aggregated open-opportunity stats so the
-- dashboard can render per-page potential without N+1 queries. security_invoker
-- ensures RLS on the underlying tables is enforced for the calling user.

CREATE OR REPLACE VIEW public.cp_seo_pages_with_stats
WITH (security_invoker = true)
AS
WITH agg AS (
  SELECT
    page,
    COUNT(*) FILTER (WHERE kind = 'primary')::int    AS open_primary,
    COUNT(*) FILTER (WHERE kind = 'supporting')::int AS open_supporting,
    COUNT(*) FILTER (WHERE kind = 'secondary')::int  AS open_secondary,
    COALESCE(SUM(impressions), 0)::int               AS open_impressions,
    COALESCE(SUM(volume), 0)::int                    AS open_volume,
    COALESCE(SUM(
      GREATEST(
        0,
        ROUND(
          (COALESCE(impressions, 0)::numeric * COALESCE(expected_ctr_pct, 0)::numeric) / 100.0
        )::int - COALESCE(clicks, 0)
      )
    ), 0)::int                                       AS open_missed_clicks,
    AVG(position)::numeric(4,1)                      AS avg_position,
    MAX(score)::int                                  AS max_score
  FROM public.cp_seo_opportunities
  WHERE status = 'open' AND archived_at IS NULL
  GROUP BY page
),
top_q AS (
  SELECT DISTINCT ON (page)
    page,
    query AS top_query,
    kind  AS top_kind,
    score AS top_score
  FROM public.cp_seo_opportunities
  WHERE status = 'open' AND archived_at IS NULL
  ORDER BY page, score DESC, id ASC
)
SELECT
  p.page,
  p.page_title,
  p.meta_source,
  p.earnings_90d,
  p.conversions_90d,
  p.open_opportunities,
  p.last_synced_at,
  COALESCE(a.open_primary, 0)       AS open_primary,
  COALESCE(a.open_supporting, 0)    AS open_supporting,
  COALESCE(a.open_secondary, 0)     AS open_secondary,
  COALESCE(a.open_impressions, 0)   AS open_impressions,
  COALESCE(a.open_missed_clicks, 0) AS open_missed_clicks,
  COALESCE(a.open_volume, 0)        AS open_volume,
  a.avg_position,
  COALESCE(a.max_score, 0)          AS max_score,
  t.top_query,
  t.top_kind
FROM public.cp_seo_pages p
LEFT JOIN agg   a ON a.page = p.page
LEFT JOIN top_q t ON t.page = p.page;

GRANT SELECT ON public.cp_seo_pages_with_stats TO authenticated;
