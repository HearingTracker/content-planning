export type SeoOppStatus = "open" | "in_progress" | "done" | "dismissed";
export type SeoOppKind = "primary" | "supporting" | "secondary";

export type SeoPage = {
  page: string;
  page_title: string | null;
  meta_source: "storyblok" | "rendered" | null;
  earnings_90d: number;
  conversions_90d: number;
  open_opportunities: number;
  last_synced_at: string;
  // Aggregated open-opportunity stats from cp_seo_pages_with_stats view.
  // Numeric fields come back as strings from Postgres (numeric type), so callers
  // should `Number(...)` them.
  open_primary: number;
  open_supporting: number;
  open_secondary: number;
  open_impressions: number;
  open_missed_clicks: number;
  open_volume: number;
  avg_position: number | null;
  max_score: number;
  top_query: string | null;
  top_kind: SeoOppKind | null;
};

export type SeoOpportunity = {
  id: number;
  page: string;
  query: string;
  kind: SeoOppKind;
  novel_tokens: string | null;
  position: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr_pct: number | null;
  expected_ctr_pct: number | null;
  kd: number | null;
  volume: number | null;
  traffic_potential: number | null;
  parent_topic: string | null;
  intents: string | null;
  serp_features: string | null;
  phrase_in_body: number;
  in_heading: boolean;
  score: number;
  status: SeoOppStatus;
  assigned_to: string | null;
  notes: string | null;
  first_seen_at: string;
  last_seen_at: string;
  archived_at: string | null;
  // Joined assignee profile, optional
  assignee?: { display_name: string | null; avatar_url: string | null; email: string | null } | null;
};

export type SeoFilters = {
  kind?: SeoOppKind | "all";
  status?: SeoOppStatus | "all";
  maxKd?: number;
  assignedTo?: string | "any";
};
