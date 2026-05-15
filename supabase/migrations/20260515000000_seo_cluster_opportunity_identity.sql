-- Phase 1A fix: opportunities are cluster-level now.
--
-- The original low-hanging-fruit table was one row per (page, query), but the
-- cluster pipeline writes one opportunity per cp_seo_clusters row. Keeping the
-- legacy UNIQUE(page, query) constraint makes fresh cluster rows fail whenever
-- a canonical query is reused by an archived or rematched cluster.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY cluster_id
      ORDER BY (archived_at IS NULL) DESC, last_seen_at DESC, id DESC
    ) AS rn
  FROM public.cp_seo_opportunities
  WHERE cluster_id IS NOT NULL
)
UPDATE public.cp_seo_opportunities o
   SET archived_at = COALESCE(o.archived_at, now()),
       cluster_id = NULL
  FROM ranked r
 WHERE o.id = r.id
   AND r.rn > 1;

ALTER TABLE public.cp_seo_opportunities
  DROP CONSTRAINT IF EXISTS cp_seo_opportunities_page_query_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS cp_seo_opportunities_cluster_id_uniq
  ON public.cp_seo_opportunities(cluster_id)
  WHERE cluster_id IS NOT NULL;
