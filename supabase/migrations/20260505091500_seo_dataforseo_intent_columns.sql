-- Rename stale legacy-provider intent column names now that keyword enrichment is
-- sourced from DataForSEO. The DO blocks keep this migration safe for fresh
-- databases where earlier migrations already create the DataForSEO names.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cp_seo_clusters'
      AND column_name = 'ahrefs_intent_prior'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cp_seo_clusters'
      AND column_name = 'dataforseo_intent_prior'
  ) THEN
    ALTER TABLE public.cp_seo_clusters
      RENAME COLUMN ahrefs_intent_prior TO dataforseo_intent_prior;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cp_seo_clusters'
      AND column_name = 'ahrefs_intent_mix'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cp_seo_clusters'
      AND column_name = 'dataforseo_intent_mix'
  ) THEN
    ALTER TABLE public.cp_seo_clusters
      RENAME COLUMN ahrefs_intent_mix TO dataforseo_intent_mix;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cp_seo_query_findings'
      AND column_name = 'ahrefs_intents'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cp_seo_query_findings'
      AND column_name = 'dataforseo_intents'
  ) THEN
    ALTER TABLE public.cp_seo_query_findings
      RENAME COLUMN ahrefs_intents TO dataforseo_intents;
  END IF;
END $$;

COMMENT ON COLUMN public.cp_seo_clusters.dataforseo_intent_prior IS
  'Dominant search intent label from DataForSEO keyword overview data.';
COMMENT ON COLUMN public.cp_seo_clusters.dataforseo_intent_mix IS
  'Cluster member intent-label counts from DataForSEO keyword overview data.';
COMMENT ON COLUMN public.cp_seo_query_findings.dataforseo_intents IS
  'Pipe-separated DataForSEO intent labels, e.g. commercial|branded.';
