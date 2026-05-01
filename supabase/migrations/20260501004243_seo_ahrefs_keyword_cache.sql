-- Ahrefs Keywords Explorer overview cache.
-- Backs lib/seo/ahrefs.ts loadAhrefs() so repeated pipeline runs only pay
-- API units for newly seen keywords. KD/volume drift slowly so a 14-day TTL
-- in the application layer is the typical refresh cadence.

CREATE TABLE public.cp_seo_keyword_cache (
  keyword            text         NOT NULL,
  country            text         NOT NULL,
  difficulty         integer,
  volume             integer,
  traffic_potential  integer,
  parent_topic       text,
  parent_volume      integer,
  intents            jsonb,
  serp_features      jsonb,
  fetched_at         timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (keyword, country)
);

CREATE INDEX idx_seo_keyword_cache_fetched_at
  ON public.cp_seo_keyword_cache (fetched_at);

ALTER TABLE public.cp_seo_keyword_cache ENABLE ROW LEVEL SECURITY;

-- Reads are open to authenticated users; writes happen via service role only
-- (the SEO sync worker), matching the pattern used by cp_seo_opportunities.
CREATE POLICY "auth read keyword cache"
  ON public.cp_seo_keyword_cache FOR SELECT
  TO authenticated USING (true);
