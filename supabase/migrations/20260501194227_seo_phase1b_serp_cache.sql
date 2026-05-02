-- DataForSEO live SERP cache.
-- Backs lib/seo/serp-data.ts loadSerps() so repeated pipeline runs only pay
-- API units for newly seen queries. Live SERPs drift faster than KD (Google
-- shuffles top 10 weekly on competitive terms), so the TTL is 7 days vs the
-- keyword cache's 14.
--
-- Used by the coverage classifier to verify GSC "competing pages" actually
-- rank in the top 20 organic for the query before flagging cannibalization.
-- Without this gate, GSC reports any page that ever surfaced for a long-tail
-- variant — including position-47 noise — as a competitor.

CREATE TABLE public.cp_seo_serp_cache (
  keyword                text         NOT NULL,
  country                text         NOT NULL,
  -- Top 20 organic results: [{rank, url, domain}].
  top_organic            jsonb        NOT NULL DEFAULT '[]'::jsonb,
  -- Whether an AI Overview block appeared in the SERP. CTR-suppressing.
  ai_overview_present    boolean      NOT NULL DEFAULT false,
  -- AIO citation URLs (deduped). Used downstream to detect "page exists but
  -- AIO is winning the click" — distinct from rank-based cannibalization.
  ai_overview_sources    jsonb        NOT NULL DEFAULT '[]'::jsonb,
  fetched_at             timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (keyword, country)
);

CREATE INDEX idx_seo_serp_cache_fetched_at
  ON public.cp_seo_serp_cache (fetched_at);

ALTER TABLE public.cp_seo_serp_cache ENABLE ROW LEVEL SECURITY;

-- Reads are open to authenticated users; writes happen via service role only
-- (the SEO sync worker), matching the pattern used by cp_seo_keyword_cache.
CREATE POLICY "auth read serp cache"
  ON public.cp_seo_serp_cache FOR SELECT
  TO authenticated USING (true);
