-- Question-shaped keyword cache. Backs lib/seo/question-keywords.ts which
-- expands a seed keyword into question-shaped variants (who/what/when/how/...)
-- via the DataForSEO Labs related-keywords endpoint. Used to populate the
-- FAQ-gap surface alongside the PAA block.
--
-- Question intent moves slower than SERPs, so the TTL is 30 days (vs 7 for
-- serp cache, 14 for keyword overview cache). We store the filtered set of
-- questions per seed; storing only the filtered subset keeps reads small.

CREATE TABLE public.cp_seo_question_keyword_cache (
  seed_keyword text         NOT NULL,
  country      text         NOT NULL,
  -- [{q: string, volume: number|null}]
  questions    jsonb        NOT NULL DEFAULT '[]'::jsonb,
  fetched_at   timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (seed_keyword, country)
);

CREATE INDEX idx_seo_question_keyword_cache_fetched_at
  ON public.cp_seo_question_keyword_cache (fetched_at);

ALTER TABLE public.cp_seo_question_keyword_cache ENABLE ROW LEVEL SECURITY;

-- Reads open to authenticated users; writes via service role (the SEO sync
-- worker) only. Mirrors cp_seo_keyword_cache and cp_seo_serp_cache.
CREATE POLICY "auth read question keyword cache"
  ON public.cp_seo_question_keyword_cache FOR SELECT
  TO authenticated USING (true);
