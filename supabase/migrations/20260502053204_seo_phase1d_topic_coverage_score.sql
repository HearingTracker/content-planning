-- Persist per-(page, query) semantic topic coverage so the drilldown UI can
-- color-code chips by tier (>=0.55 covered, 0.40-0.55 marginal, <0.40
-- missing) instead of relying on the LLM's start_with curation alone.
--
-- The score is the max cosine similarity between the query embedding and any
-- of the page's section embeddings (title, H1, headings, body chunks). It's
-- already computed in lib/seo/coverage.ts:buildCoverageInputs as the
-- `topicScore` for each member; this column gives that value a home so the
-- frontend can read it without reclassifying.

ALTER TABLE cp_seo_query_findings
  ADD COLUMN topic_coverage_score numeric(4, 3)
    CHECK (topic_coverage_score IS NULL OR (topic_coverage_score >= 0 AND topic_coverage_score <= 1));

COMMENT ON COLUMN cp_seo_query_findings.topic_coverage_score IS
  'Max cosine similarity (0-1, 3 decimals) between this query embedding and the page section embeddings. Written by sync-job during the coverage phase. Null when the page has no embeddable sections.';
