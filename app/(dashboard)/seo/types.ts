export type SeoOppStatus = "open" | "in_progress" | "done" | "dismissed";

// Legacy enum (still on the DB for cp_seo_opportunities.kind, retained until
// query-level columns are dropped in a Phase 1A follow-up). The active kind
// system is the text-based key referencing cp_seo_opportunity_kinds — see
// SeoOppKindKey below.
export type SeoOppKind = "primary" | "supporting" | "secondary";

// New kind keys, sourced from cp_seo_opportunity_kinds. Phase 1A inserts
// always use 'needs_review' until the coverage classifier in 1B fills in the
// rest based on actual page content vs reader intent.
export type SeoOppKindKey =
  | "needs_review"
  | "intent_gap"
  | "coverage_partial"
  | "coverage_strong"
  | "snippet_ctr"
  | "wrong_page"
  | "freshness"
  | "consolidate"
  | "cede"
  | "ai_overview_loss";

export type SeoPage = {
  page: string;
  page_title: string | null;
  meta_source: "storyblok" | "rendered" | null;
  earnings_90d: number;
  conversions_90d: number;
  open_opportunities: number;
  last_synced_at: string;

  // Aggregated open-opportunity stats from cp_seo_pages_with_stats view.
  // Numeric fields come back as strings from Postgres (numeric type), so
  // callers should `Number(...)` them.

  // Legacy kind columns (kept for transition)
  open_primary: number;
  open_supporting: number;
  open_secondary: number;
  // New kind columns (Phase 1A+)
  open_needs_review: number;
  open_snippet_ctr: number;
  open_wrong_page: number;
  open_freshness: number;
  open_clusters: number;

  open_impressions: number;
  open_missed_clicks: number;
  open_volume: number;
  avg_position: number | null;
  max_score: number;

  // Top opportunity preview (cluster-level)
  top_query: string | null;          // cluster label
  top_kind: SeoOppKindKey | null;
  top_member_count: number | null;
  top_score: number | null;
};

/** Cluster-level opportunity row, as returned by getSeoOpportunities(). */
export type SeoOpportunity = {
  id: number;
  page: string;
  cluster_id: number;
  kind: SeoOppKindKey;
  score: number;
  status: SeoOppStatus;
  assigned_to: string | null;
  notes: string | null;
  first_seen_at: string;
  last_seen_at: string;
  archived_at: string | null;

  // Joined cluster fields
  cluster_label: string;
  canonical_query: string;
  is_branded: boolean;
  brand: string | null;
  retailer: string | null;
  product_family: string | null;
  ahrefs_intent_prior: string | null;
  member_count: number;
  total_impressions: number;
  total_volume: number;
  total_missed_clicks: number;
  weighted_ctr_pct: number | null;
  expected_ctr_pct: number | null;
  avg_position: number | null;
  min_kd: number | null;
  max_kd: number | null;

  // Match audit (visible in 1A.5 review screen)
  match_decision: "auto" | "review" | "new" | null;
  match_score: number | null;

  // Member queries (joined from cp_seo_query_findings)
  member_queries: string[];
  /**
   * Per-query semantic topic-coverage score (0–1, 3 decimals). Computed at
   * sync time as the max cosine similarity between the query embedding and
   * the page's section embeddings. Null when the page has no embeddable
   * sections, or when the row predates the column. Used by chip UI to
   * color-code coverage tier (≥0.55 covered, 0.40–0.55 marginal, <0.40
   * missing).
   */
  topic_coverage_by_query: Record<string, number | null>;

  // Phase 1B coverage classifier output
  recommendation: string | null;
  confidence: number | null;
  /**
   * Author-task readiness from coverage_input_digest. "ready" means the
   * classifier passed deterministic guardrails; "review" means don't assign
   * directly; "monitor"/"blocked" are non-edit outcomes.
   */
  actionability: "ready" | "review" | "monitor" | "blocked";
  /** Short deterministic guardrail notes from the classifier audit. */
  guardrails: string[];
  /** Top 3–5 anchor queries (deterministic LH-fruit ranking), in priority order. */
  anchor_queries: string[];
  /** LLM-curated subset of anchors to highlight first (excludes already-covered + ceded). Empty array is the LLM's positive "nothing to attack" signal — do NOT fall back to anchor_queries. */
  start_with_queries: string[];
  /**
   * Per-anchor external canonical: another HearingTracker URL that ranks ≤10 in
   * the live SERP for that anchor. The canonical owner of the topic — body
   * additions / snippet rewrites for that anchor on this page would
   * cannibalize it. Keyed by anchor query.
   */
  external_canonicals: Record<string, { url: string; position: number | null }>;
  /** Pages that compete on at least one cluster member, deduped. */
  cannibal_pages: string[];

  // Joined assignee profile, optional
  assignee?: { display_name: string | null; avatar_url: string | null; email: string | null } | null;
};

export type SeoFilters = {
  kind?: SeoOppKind | "all";
  status?: SeoOppStatus | "all";
  maxKd?: number;
  assignedTo?: string | "any";
};

// Phase 1C/1D — site-wide synthesis layer. Mirrors cp_seo_synthesis_kinds.
export type SeoSynthesisKindKey =
  | "fully_ceded_page"
  | "undesignated_topic"
  | "aio_no_citation"
  | "orphan_target"
  // Phase 1D blind-spot kinds
  | "authority_capped_serp"
  | "brand_cannibalization"
  | "freshness"
  | "internal_link_gap";

export type SeoSynthesisFinding = {
  id: number;
  kind: SeoSynthesisKindKey;
  scope_page: string | null;
  scope_query: string | null;
  target_page: string | null;
  score: number;
  evidence: Record<string, unknown>;
  detected_in_job_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  archived_at: string | null;
  identity_hash: string;
};

export type SeoSyncJobStatus = "pending" | "running" | "completed" | "failed";
export type SeoSyncJobPhase =
  | "gsc"
  | "embed"
  | "cluster"
  | "label"
  | "match"
  | "classify"
  | "upsert"
  | "rank_snapshot"
  | "synthesize"
  | "done";

export type SeoSyncJob = {
  id: number;
  trigger: "cron" | "admin";
  triggered_by: string | null;
  status: SeoSyncJobStatus;
  current_phase: SeoSyncJobPhase | null;
  phase_progress: { completed: number; total: number; label?: string } | null;
  phase_history: Array<{
    phase: SeoSyncJobPhase;
    started_at: string;
    completed_at: string;
    items: number;
  }>;
  log_tail: string[];
  pages_processed: number | null;
  clusters_created: number | null;
  clusters_matched: number | null;
  clusters_review_flagged: number | null;
  clusters_archived: number | null;
  opportunities_total: number | null;
  embedding_tokens: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  estimated_cost_usd: number;
  triggered_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
};
