-- Single server-side RPC that runs the full SEO sync atomically.
-- Replaces 4 PostgREST round-trips (pages upsert, opps upsert, archive, count
-- refresh) with one call — both faster and immune to per-table PostgREST
-- schema-cache cold-starts.

CREATE OR REPLACE FUNCTION public.cp_seo_sync_all(
  pages_data jsonb,
  opps_data  jsonb,
  sync_at    timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count integer := 0;
BEGIN
  -- 1) Upsert pages (no user state to preserve).
  INSERT INTO public.cp_seo_pages (
    page, page_title, meta_source, earnings_90d, conversions_90d, last_synced_at
  )
  SELECT
    r->>'page',
    NULLIF(r->>'page_title', ''),
    NULLIF(r->>'meta_source', ''),
    COALESCE(NULLIF(r->>'earnings_90d', '')::numeric, 0),
    COALESCE(NULLIF(r->>'conversions_90d', '')::integer, 0),
    sync_at
  FROM jsonb_array_elements(pages_data) AS r
  ON CONFLICT (page) DO UPDATE SET
    page_title       = EXCLUDED.page_title,
    meta_source      = EXCLUDED.meta_source,
    earnings_90d     = EXCLUDED.earnings_90d,
    conversions_90d  = EXCLUDED.conversions_90d,
    last_synced_at   = EXCLUDED.last_synced_at;

  -- 2) Upsert opportunities (preserves status/assigned_to/notes via existing helper).
  PERFORM public.cp_seo_upsert_opportunities(opps_data, sync_at);

  -- 3) Archive opportunities not seen this run.
  UPDATE public.cp_seo_opportunities
     SET archived_at = sync_at
   WHERE last_seen_at < sync_at AND archived_at IS NULL;
  GET DIAGNOSTICS archived_count = ROW_COUNT;

  -- 4) Refresh denormalized open counts on cp_seo_pages.
  PERFORM public.cp_seo_refresh_open_counts();

  RETURN jsonb_build_object(
    'pages',         jsonb_array_length(pages_data),
    'opportunities', jsonb_array_length(opps_data),
    'archived',      archived_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cp_seo_sync_all(jsonb, jsonb, timestamptz) FROM public, anon, authenticated;
-- service_role bypasses GRANTs; the cron route + Refresh-Now action call this via the service client.
