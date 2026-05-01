-- Phase 1A · Clusters table
-- ────────────────────────────────────────────────────────────────────────────
-- One row per (page, semantic group of queries). Long-term identity is
-- maintained by a *match procedure* in the sync worker, not by any UNIQUE
-- constraint on label or member set. Both are mutable; the procedure binds
-- a new candidate to an existing cluster id when centroid + member overlap
-- agree, otherwise creates a fresh row.
--
-- original_centroid is frozen at first creation; current_centroid is updated
-- each sync. Keeping both lets us reject auto-matches where the cluster has
-- drifted too far from its original meaning over time.

CREATE TABLE public.cp_seo_clusters (
  id                  bigserial PRIMARY KEY,
  page                text NOT NULL REFERENCES public.cp_seo_pages(page) ON DELETE CASCADE,

  -- Identity & matching
  label               text NOT NULL,                          -- mutable, LLM-generated
  canonical_query     text NOT NULL,                          -- medoid: member with highest cosine sim to centroid
  topic_signature     text NOT NULL,                          -- debug/dedupe within ONE sync only; not authoritative for cross-sync identity
  original_centroid   vector(1536) NOT NULL,                  -- frozen at first creation
  current_centroid    vector(1536) NOT NULL,                  -- updated each sync
  is_branded          boolean NOT NULL DEFAULT false,
  brand               text,
  retailer            text,                                   -- 'costco', 'hear.com' — separate axis from brand
  product_family      text,                                   -- 'lumity', 'evolv ai' — nullable

  -- Intent (Ahrefs prior in 1A; LLM reconciliation lands in 1B)
  ahrefs_intent_prior        text,
  ahrefs_intent_mix          jsonb,
  llm_intent                 text,
  intent_confidence          numeric(3,2),
  intent_disagreement_reason text,

  -- Aggregates over open member findings
  member_count        integer NOT NULL DEFAULT 0,
  total_impressions   integer NOT NULL DEFAULT 0,
  total_volume        integer NOT NULL DEFAULT 0,
  total_missed_clicks integer NOT NULL DEFAULT 0,
  weighted_ctr_pct    numeric(5,2),
  expected_ctr_pct    numeric(5,2),
  avg_position        numeric(4,1),
  min_kd              integer,
  max_kd              integer,
  score               integer NOT NULL DEFAULT 0,

  -- Versioning (so historical rows stay attributable when models/prompts change)
  embedding_model     text NOT NULL,
  embedding_dim       integer NOT NULL,                       -- enforces correctness when env changes
  label_model         text NOT NULL,
  label_prompt_v      text NOT NULL,
  label_input_digest  jsonb,                                  -- audit: what the labeling LLM saw

  -- Match audit (visible in the 1A.5 admin review screen)
  match_decision      text CHECK (match_decision IN ('auto', 'review', 'new')),
  match_score         numeric(4,3),
  match_components    jsonb,                                  -- {centroid: 0.81, jaccard: 0.6, label: 0.7}
  matched_from_id     bigint REFERENCES public.cp_seo_clusters(id) ON DELETE SET NULL,

  -- Sync bookkeeping
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_clusters_page             ON public.cp_seo_clusters(page) WHERE archived_at IS NULL;
CREATE INDEX idx_seo_clusters_score            ON public.cp_seo_clusters(score DESC) WHERE archived_at IS NULL;
CREATE INDEX idx_seo_clusters_match_review     ON public.cp_seo_clusters(last_seen_at DESC) WHERE match_decision = 'review' AND archived_at IS NULL;

-- ivfflat for cosine similarity on current_centroid. lists=100 is fine for the
-- low-thousands of clusters we expect; revisit if the table grows beyond ~50k.
CREATE INDEX idx_seo_clusters_centroid_current ON public.cp_seo_clusters
  USING ivfflat (current_centroid vector_cosine_ops) WITH (lists = 100);

CREATE TRIGGER cp_seo_clusters_updated_at
  BEFORE UPDATE ON public.cp_seo_clusters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.cp_seo_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read clusters"
  ON public.cp_seo_clusters FOR SELECT
  TO authenticated USING (true);

-- Editors+ can override match decisions (the 1A.5 review screen) by updating
-- match_decision / matched_from_id; everything else is service-role only.
CREATE POLICY "editor update cluster match decision"
  ON public.cp_seo_clusters FOR UPDATE
  TO authenticated
  USING (public.cp_user_is_editor_or_above())
  WITH CHECK (public.cp_user_is_editor_or_above());
