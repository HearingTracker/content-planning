-- Phase 1A · Query findings
-- ────────────────────────────────────────────────────────────────────────────
-- The atomic per-query GSC + Ahrefs evidence backing each cluster. One row
-- per (page, query). Replaces the per-query columns previously stored on
-- cp_seo_opportunities — those will be dropped in a follow-up migration once
-- the new pipeline has populated this table.

CREATE TABLE public.cp_seo_query_findings (
  id                bigserial PRIMARY KEY,
  cluster_id        bigint NOT NULL REFERENCES public.cp_seo_clusters(id) ON DELETE CASCADE,
  page              text NOT NULL,
  query             text NOT NULL,

  -- Embedding (used for clustering + medoid selection + later coverage retrieval)
  query_embedding        vector(1536),
  similarity_to_centroid numeric(4,3),                        -- helps identify medoid; useful for review screens

  -- GSC metrics (from the 28-day window)
  position          numeric(4,1),
  impressions       integer,
  clicks            integer,
  ctr_pct           numeric(5,2),
  expected_ctr_pct  numeric(5,2),

  -- Ahrefs enrichment
  kd                integer,
  volume            integer,
  ahrefs_intents    text,                                     -- pipe-separated: 'commercial|branded'
  serp_features     text,

  -- Token-rule heuristics (kept for transparency in 1A; superseded by LLM coverage in 1B)
  phrase_in_body    integer NOT NULL DEFAULT 0,
  in_heading        boolean NOT NULL DEFAULT false,
  novel_tokens      text,

  -- Sync bookkeeping
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  archived_at       timestamptz,

  UNIQUE (page, query)
);

CREATE INDEX idx_seo_findings_cluster ON public.cp_seo_query_findings(cluster_id) WHERE archived_at IS NULL;
CREATE INDEX idx_seo_findings_page    ON public.cp_seo_query_findings(page)       WHERE archived_at IS NULL;

ALTER TABLE public.cp_seo_query_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read findings"
  ON public.cp_seo_query_findings FOR SELECT
  TO authenticated USING (true);
