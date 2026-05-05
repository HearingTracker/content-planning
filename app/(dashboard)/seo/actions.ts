"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import type {
  SeoManualQueueInput,
  SeoManualQueueItem,
  SeoOppStatus,
  SeoPage,
  SeoOpportunity,
  SeoSyncJob,
  SeoSynthesisFinding,
  SeoSynthesisKindKey,
} from "./types";

async function requireEditor(): Promise<string> {
  const role = await getCurrentUserRole();
  if (role !== "admin" && role !== "editor") {
    throw new Error("editor or admin role required");
  }
  return role;
}

export async function getSeoPages(): Promise<SeoPage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cp_seo_pages_with_stats")
    .select("*")
    .order("earnings_90d", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SeoPage[];
}

const TASK_TYPES = new Set<SeoManualQueueInput["task_type"]>([
  "article_update",
  "update_event",
  "manual_article",
  "reopen_monitor",
]);

const PRIORITIES = new Set<SeoManualQueueInput["priority"]>([
  "low",
  "medium",
  "high",
  "urgent",
]);

const PRIORITY_RANK: Record<SeoManualQueueInput["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_RANK: Record<SeoOppStatus, number> = {
  open: 0,
  in_progress: 1,
  done: 2,
  dismissed: 3,
};

function cleanOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeSeoPath(value: string | null | undefined): string | null {
  const trimmed = cleanOptionalText(value);
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.hostname.endsWith("hearingtracker.com")) {
      return url.pathname.replace(/\/+$/, "") || "/";
    }
    throw new Error("Page must be a HearingTracker URL or path");
  } catch {
    if (trimmed.startsWith("/")) return trimmed.replace(/\/+$/, "") || "/";
    return `/${trimmed}`.replace(/\/+$/, "") || "/";
  }
}

function normalizeManualQueueInput(input: SeoManualQueueInput): SeoManualQueueInput {
  if (!TASK_TYPES.has(input.task_type)) {
    throw new Error("Invalid manual SEO task type");
  }
  if (!PRIORITIES.has(input.priority)) {
    throw new Error("Invalid manual SEO priority");
  }

  const page = normalizeSeoPath(input.page);
  const targetTitle = cleanOptionalText(input.target_title);
  const summary = cleanOptionalText(input.summary);
  const evidence = cleanOptionalText(input.evidence);
  const sourceUrl = cleanOptionalText(input.source_url);
  const eventDate = cleanOptionalText(input.event_date);

  if (!page && !targetTitle) {
    throw new Error("Manual SEO task needs a page path or target title");
  }
  if (!summary) {
    throw new Error("Manual SEO task needs a summary");
  }
  if (sourceUrl) {
    try {
      new URL(sourceUrl);
    } catch {
      throw new Error("Source URL must be a valid URL");
    }
  }
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new Error("Event date must use YYYY-MM-DD");
  }

  return {
    task_type: input.task_type,
    page,
    target_title: targetTitle,
    summary,
    evidence,
    source_url: sourceUrl,
    event_date: eventDate,
    priority: input.priority,
    linked_opportunity_id: input.linked_opportunity_id ?? null,
    linked_synthesis_finding_id: input.linked_synthesis_finding_id ?? null,
  };
}

function sortManualQueue(items: SeoManualQueueItem[]): SeoManualQueueItem[] {
  return [...items].sort((a, b) => {
    const statusDelta = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (statusDelta !== 0) return statusDelta;
    const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return b.created_at.localeCompare(a.created_at);
  });
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function parseStandaloneArticleAudit(
  value: unknown,
): SeoOpportunity["standalone_article"] {
  const obj = asObject(value);
  if (!obj || typeof obj.recommended !== "boolean") return null;
  const evidence = asObject(obj.evidence) ?? {};
  return {
    recommended: obj.recommended,
    score: typeof obj.score === "number" ? obj.score : Number(obj.score ?? 0),
    reason: typeof obj.reason === "string" ? obj.reason : "",
    candidate_queries: asStringArray(obj.candidate_queries),
    criteria: asObject(obj.criteria) as Record<string, boolean> | null ?? {},
    evidence: evidence as NonNullable<SeoOpportunity["standalone_article"]>["evidence"],
  };
}

function parseRecommendationAudit(
  value: unknown,
): SeoOpportunity["recommendation_audit"] {
  const obj = asObject(value);
  if (!obj || typeof obj.recommendation_trigger !== "string") return null;
  return obj as SeoOpportunity["recommendation_audit"];
}

function parseEditorChecklist(
  value: unknown,
): SeoOpportunity["editor_gap_checklist"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(asObject(item)))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "unknown",
      label: typeof item.label === "string" ? item.label : "Review item",
      status:
        item.status === "required" ||
        item.status === "recommended" ||
        item.status === "not_applicable"
          ? item.status
          : "recommended",
      reason: typeof item.reason === "string" ? item.reason : "",
    }));
}

function parseInternalLinkRecommendations(
  value: unknown,
): SeoOpportunity["internal_link_recommendations"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(asObject(item)))
    .map((item) => {
      const direction: SeoOpportunity["internal_link_recommendations"][number]["direction"] =
        item.direction === "from_current_page" ||
        item.direction === "to_current_page" ||
        item.direction === "both"
          ? item.direction
          : "from_current_page";
      return {
        source_page: typeof item.source_page === "string" ? item.source_page : "",
        target_page: typeof item.target_page === "string" ? item.target_page : "",
        suggested_anchor_text: typeof item.suggested_anchor_text === "string" ? item.suggested_anchor_text : "",
        reason: typeof item.reason === "string" ? item.reason : "",
        confidence: typeof item.confidence === "number" ? item.confidence : Number(item.confidence ?? 0),
        direction,
      };
    })
    .filter((item) => item.source_page && item.target_page && item.suggested_anchor_text);
}

function parseAioSerpAudit(value: unknown): SeoOpportunity["aio_serp"] {
  const obj = asObject(value);
  if (!obj || typeof obj.aio_present_on_serp !== "boolean") return null;
  return {
    aio_present_on_serp: obj.aio_present_on_serp,
    aio_present_on_serp_queries: asStringArray(obj.aio_present_on_serp_queries),
    aio_citation_seen: obj.aio_citation_seen === true,
    aio_citation_seen_queries: asStringArray(obj.aio_citation_seen_queries),
    ai_platform_citation_seen: null,
    citation_source: typeof obj.citation_source === "string" ? obj.citation_source : null,
    note: typeof obj.note === "string" ? obj.note : "",
  };
}

function parsePrioritizationAudit(
  value: unknown,
): SeoOpportunity["prioritization"] {
  const obj = asObject(value);
  if (!obj || typeof obj.computed_score !== "number") return null;
  return obj as SeoOpportunity["prioritization"];
}

export async function getManualSeoQueueItems(): Promise<SeoManualQueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cp_seo_manual_queue_items")
    .select("*")
    .is("archived_at", null)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return sortManualQueue((data ?? []) as SeoManualQueueItem[]);
}

export async function createManualSeoQueueItem(input: SeoManualQueueInput): Promise<void> {
  await requireEditor();
  const supabase = await createClient();
  const normalized = normalizeManualQueueInput(input);
  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("cp_seo_manual_queue_items")
    .insert({
      ...normalized,
      created_by: userResp.user?.id ?? null,
    });
  if (error) throw new Error(error.message);
  revalidatePath("/seo");
}

export async function updateManualSeoQueueItemStatus(
  id: number,
  status: SeoOppStatus,
): Promise<void> {
  await requireEditor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cp_seo_manual_queue_items")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/seo");
}

export async function getSeoOpportunities(page: string): Promise<SeoOpportunity[]> {
  const supabase = await createClient();

  // Cluster-level opportunities; pull joined cluster fields + member queries
  // from findings via the cluster id. Returned shape matches SeoOpportunity.
  const { data, error } = await supabase
    .from("cp_seo_opportunities")
    .select(
      `
      id, page, cluster_id, kind_text, score, status, assigned_to, notes,
      first_seen_at, last_seen_at, archived_at,
      cluster:cp_seo_clusters!inner (
        label, canonical_query, is_branded, brand, retailer, product_family,
        dataforseo_intent_prior, member_count, total_impressions, total_volume,
        total_missed_clicks, weighted_ctr_pct, expected_ctr_pct, avg_position,
        min_kd, max_kd, match_decision, match_score,
        coverage_recommendation, coverage_confidence, coverage_input_digest,
        anchor_queries, start_with_queries, anchor_external_canonicals,
        cannibal_overlap,
        cp_seo_query_findings ( query, topic_coverage_score )
      )
    `,
    )
    .eq("page", page)
    .is("archived_at", null)
    .not("cluster_id", "is", null)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);

  type Row = {
    id: number;
    page: string;
    cluster_id: number;
    kind_text: SeoOpportunity["kind"];
    score: number;
    status: SeoOpportunity["status"];
    assigned_to: string | null;
    notes: string | null;
    first_seen_at: string;
    last_seen_at: string;
    archived_at: string | null;
    cluster: {
      label: string;
      canonical_query: string;
      is_branded: boolean;
      brand: string | null;
      retailer: string | null;
      product_family: string | null;
      dataforseo_intent_prior: string | null;
      member_count: number;
      total_impressions: number;
      total_volume: number;
      total_missed_clicks: number;
      weighted_ctr_pct: number | null;
      expected_ctr_pct: number | null;
      avg_position: number | null;
      min_kd: number | null;
      max_kd: number | null;
      match_decision: SeoOpportunity["match_decision"];
      match_score: number | null;
      coverage_recommendation: string | null;
      coverage_confidence: number | string | null;
      coverage_input_digest: ({
        editor_actionability?: string;
        guardrails?: unknown;
      } & Record<string, unknown>) | null;
      anchor_queries: { query: string; score: number }[] | null;
      start_with_queries: string[] | null;
      anchor_external_canonicals:
        | Array<{ query: string; url: string; position: number }>
        | null;
      // Legacy shape: { query: string[] } — paths only.
      // Current shape: { query: { url: string; wins?: [...] }[] } — SERP-verified
      // competitors with annotations. Reader below tolerates both for rows
      // classified before prompt v7.
      cannibal_overlap:
        | Record<string, Array<string | { url: string }>>
        | null;
      cp_seo_query_findings:
        | { query: string; topic_coverage_score: number | string | null }[]
        | null;
    };
  };

  return (data as unknown as Row[]).map((row) => {
    const anchors = Array.isArray(row.cluster.anchor_queries)
      ? row.cluster.anchor_queries.map((a) => a.query).filter((q): q is string => typeof q === "string")
      : [];
    // start_with_queries is the LLM-curated highlight subset, persisted
    // NOT NULL DEFAULT '[]'. An empty array is a positive "nothing to
    // attack" signal (correct for coverage_strong, wrong_page, cede, and
    // review-gated rows whose only AIO anchors carry external canonicals) —
    // do NOT fall back to highlighting every anchor in that case.
    const startWith = Array.isArray(row.cluster.start_with_queries)
      ? row.cluster.start_with_queries.filter((q): q is string => typeof q === "string")
      : [];
    const externalCanonicals: SeoOpportunity["external_canonicals"] = {};
    if (Array.isArray(row.cluster.anchor_external_canonicals)) {
      for (const e of row.cluster.anchor_external_canonicals) {
        if (e && typeof e.query === "string" && typeof e.url === "string") {
          externalCanonicals[e.query] = {
            url: e.url,
            position: typeof e.position === "number" ? e.position : null,
          };
        }
      }
    }
    const cannibalSet = new Set<string>();
    if (row.cluster.cannibal_overlap && typeof row.cluster.cannibal_overlap === "object") {
      for (const entries of Object.values(row.cluster.cannibal_overlap)) {
        for (const entry of entries ?? []) {
          if (typeof entry === "string") cannibalSet.add(entry);
          else if (entry && typeof entry === "object" && typeof entry.url === "string") {
            cannibalSet.add(entry.url);
          }
        }
      }
    }
    const digest = row.cluster.coverage_input_digest;
    const rawGuardrails = digest?.guardrails;
    const guardrails = Array.isArray(rawGuardrails)
      ? rawGuardrails.filter((g): g is string => typeof g === "string")
      : [];
    const rawActionability = digest?.editor_actionability;
    const actionability =
      rawActionability === "ready" ||
      rawActionability === "review" ||
      rawActionability === "monitor" ||
      rawActionability === "blocked"
        ? rawActionability
        : row.cluster.coverage_confidence != null && Number(row.cluster.coverage_confidence) < 0.6
          ? "review"
          : row.kind_text === "coverage_strong"
            ? "monitor"
            : row.kind_text === "cede" || row.kind_text === "wrong_page"
              ? "blocked"
              : "ready";
    return {
      id: row.id,
      page: row.page,
      cluster_id: row.cluster_id,
      kind: row.kind_text ?? "needs_review",
      score: row.score,
      status: row.status,
      assigned_to: row.assigned_to,
      notes: row.notes,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      archived_at: row.archived_at,
      cluster_label: row.cluster.label,
      canonical_query: row.cluster.canonical_query,
      is_branded: row.cluster.is_branded,
      brand: row.cluster.brand,
      retailer: row.cluster.retailer,
      product_family: row.cluster.product_family,
      dataforseo_intent_prior: row.cluster.dataforseo_intent_prior,
      member_count: row.cluster.member_count,
      total_impressions: row.cluster.total_impressions,
      total_volume: row.cluster.total_volume,
      total_missed_clicks: row.cluster.total_missed_clicks,
      weighted_ctr_pct: row.cluster.weighted_ctr_pct,
      expected_ctr_pct: row.cluster.expected_ctr_pct,
      avg_position: row.cluster.avg_position,
      min_kd: row.cluster.min_kd,
      max_kd: row.cluster.max_kd,
      match_decision: row.cluster.match_decision,
      match_score: row.cluster.match_score,
      member_queries: (row.cluster.cp_seo_query_findings ?? []).map((f) => f.query),
      topic_coverage_by_query: Object.fromEntries(
        (row.cluster.cp_seo_query_findings ?? [])
          .map((f) => [
            f.query,
            f.topic_coverage_score == null ? null : Number(f.topic_coverage_score),
          ] as const)
          .filter(([, v]) => v == null || (typeof v === "number" && Number.isFinite(v))),
      ),
      recommendation: row.cluster.coverage_recommendation,
      confidence: row.cluster.coverage_confidence != null ? Number(row.cluster.coverage_confidence) : null,
      actionability,
      guardrails,
      anchor_queries: anchors,
      start_with_queries: startWith,
      external_canonicals: externalCanonicals,
      cannibal_pages: [...cannibalSet].sort(),
      standalone_article: parseStandaloneArticleAudit(digest?.standalone_article),
      recommendation_audit: parseRecommendationAudit(digest?.recommendation_audit),
      editor_gap_checklist: parseEditorChecklist(digest?.editor_gap_checklist),
      internal_link_recommendations: parseInternalLinkRecommendations(
        digest?.internal_link_recommendations,
      ),
      aio_serp: parseAioSerpAudit(digest?.aio_serp),
      prioritization: parsePrioritizationAudit(digest?.prioritization),
    };
  });
}

// ─── Phase 1C: site-wide synthesis findings ───────────────────────────────

/**
 * Synthesis findings relevant to the per-page drilldown. Three buckets, all
 * deduped into a single array ordered by score desc:
 *
 *   1. scope_page = page — this page is the subject (e.g. fully_ceded_page).
 *   2. target_page = page — synthesis recommends extending/owning this page.
 *   3. scope_query ∈ anchors of any open cluster on this page — a query the
 *      classifier is reasoning about here also has a site-wide finding,
 *      potentially with a *different* canonical target. The cluster card
 *      surfaces these as "Heads up" badges so the editor sees the cross-page
 *      mismatch directly next to the prose.
 *
 * Bucket 3 is what makes the on-page prose recommendations honest about
 * SERP-structural caps the per-cluster classifier never saw.
 */
export async function getSynthesisFindingsForPage(
  page: string,
): Promise<SeoSynthesisFinding[]> {
  const supabase = await createClient();

  // Pull anchor sets first so we can scope the query-keyed lookup. Open
  // opportunities only — archived clusters shouldn't pull in findings.
  const { data: clusterRows, error: clusterErr } = await supabase
    .from("cp_seo_opportunities")
    .select("cluster:cp_seo_clusters!inner ( anchor_queries )")
    .eq("page", page)
    .is("archived_at", null)
    .not("cluster_id", "is", null);
  if (clusterErr) throw new Error(clusterErr.message);

  const anchorSet = new Set<string>();
  for (const row of (clusterRows ?? []) as unknown as Array<{
    cluster: { anchor_queries: { query: string }[] | null };
  }>) {
    for (const a of row.cluster?.anchor_queries ?? []) {
      if (typeof a?.query === "string") anchorSet.add(a.query);
    }
  }

  // Two queries merged — simpler and more robust than building a
  // PostgREST `or(…, scope_query.in.(…))` with quoted query strings.
  const [pageRes, anchorRes] = await Promise.all([
    supabase
      .from("cp_seo_synthesis_findings")
      .select("*")
      .is("archived_at", null)
      .or(`scope_page.eq.${page},target_page.eq.${page}`),
    anchorSet.size > 0
      ? supabase
          .from("cp_seo_synthesis_findings")
          .select("*")
          .is("archived_at", null)
          .in("scope_query", [...anchorSet])
      : Promise.resolve({ data: [], error: null as unknown }),
  ]);
  if (pageRes.error) throw new Error(pageRes.error.message);
  if (anchorRes.error) throw new Error((anchorRes.error as Error).message);

  const byId = new Map<number, SeoSynthesisFinding>();
  for (const f of (pageRes.data ?? []) as SeoSynthesisFinding[]) byId.set(f.id, f);
  for (const f of (anchorRes.data ?? []) as SeoSynthesisFinding[]) byId.set(f.id, f);
  return [...byId.values()].sort((a, b) => Number(b.score) - Number(a.score));
}

/**
 * Site-wide synthesis findings reader — backs the /seo/site portfolio view.
 * Filters by kind when provided; otherwise returns all open findings ordered
 * by score desc.
 */
export async function getSynthesisFindings(opts: {
  kind?: SeoSynthesisKindKey;
  limit?: number;
} = {}): Promise<SeoSynthesisFinding[]> {
  const supabase = await createClient();
  let q = supabase
    .from("cp_seo_synthesis_findings")
    .select("*")
    .is("archived_at", null)
    .order("score", { ascending: false });
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as SeoSynthesisFinding[];
}

export async function updateOpportunityStatus(id: number, status: SeoOppStatus): Promise<void> {
  await requireEditor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cp_seo_opportunities")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/seo");
}

export async function assignOpportunity(id: number, userId: string | null): Promise<void> {
  await requireEditor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cp_seo_opportunities")
    .update({ assigned_to: userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/seo");
}

export async function updateOpportunityNotes(id: number, notes: string | null): Promise<void> {
  await requireEditor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cp_seo_opportunities")
    .update({ notes })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/seo");
}

// Admin-only: triggers the Phase 1A clustered sync. Returns immediately with
// the job id; the worker runs after the response via Next.js after(), and the
// SyncJobControl UI polls cp_seo_sync_jobs until it terminates. Rejects if
// another job is already pending or running.
export async function triggerSyncJob(): Promise<{ jobId: number }> {
  const role = await getCurrentUserRole();
  if (role !== "admin") throw new Error("admin role required");

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp.user?.id ?? null;

  const { createSyncJob, runSyncJob, getActiveSyncJob, sweepAbandonedSyncJobs } = await import(
    "@/lib/seo/sync-job"
  );

  // Sweep stale jobs first — a crashed worker shouldn't block new runs.
  await sweepAbandonedSyncJobs();

  const active = await getActiveSyncJob();
  if (active) {
    throw new Error(`A sync job is already ${active.status} (id=${active.id})`);
  }

  const { jobId } = await createSyncJob({ trigger: "admin", triggeredBy: userId ?? undefined });

  // Run the worker after the HTTP response is sent. On Vercel the function
  // stays alive long enough to complete (Fluid Compute, 300s default).
  after(() =>
    runSyncJob(jobId).catch((err) => {
      console.error(`[seo-sync] runSyncJob(${jobId}) failed:`, err);
    }),
  );

  return { jobId };
}

export async function getActiveSyncJob(): Promise<SeoSyncJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cp_seo_sync_jobs")
    .select("*")
    .in("status", ["pending", "running"])
    .order("triggered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SeoSyncJob | null) ?? null;
}

export async function getSyncJob(id: number): Promise<SeoSyncJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cp_seo_sync_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SeoSyncJob | null) ?? null;
}

export async function getRecentSyncJobs(limit = 10): Promise<SeoSyncJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cp_seo_sync_jobs")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SeoSyncJob[];
}

// ─── Admin: cluster matching review (Phase 1A.5) ───────────────────────────
//
// Rows are surfaced for inspection when the cluster matcher chose 'review'
// (combined score between SEO_MATCH_REVIEW_THRESHOLD and SEO_MATCH_AUTO_THRESHOLD)
// or when the drift guard kicked in. Admins can spot bad matches early and
// tune thresholds before the system gives questionable advice to authors.

export type ClusterMatchReviewRow = {
  id: number;
  page: string;
  label: string;
  canonical_query: string;
  is_branded: boolean;
  brand: string | null;
  match_decision: "auto" | "review" | "new" | null;
  match_score: number | null;
  match_components: { centroid: number; jaccard: number; label: number | null } | null;
  matched_from_id: number | null;
  matched_from_label: string | null;
  member_count: number;
  member_queries: string[];
  last_seen_at: string;
  first_seen_at: string;
};

export async function getClusterMatchesForReview(opts: {
  scope: "review" | "all_recent";
  limit?: number;
} = { scope: "review" }): Promise<ClusterMatchReviewRow[]> {
  const role = await getCurrentUserRole();
  if (role !== "admin") throw new Error("admin role required");

  const supabase = await createClient();
  const limit = opts.limit ?? 100;

  let query = supabase
    .from("cp_seo_clusters")
    .select(
      `
      id, page, label, canonical_query, is_branded, brand,
      match_decision, match_score, match_components, matched_from_id,
      member_count, last_seen_at, first_seen_at,
      cp_seo_query_findings ( query ),
      matched_from:matched_from_id ( label )
    `,
    )
    .is("archived_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (opts.scope === "review") {
    query = query.eq("match_decision", "review");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Raw = {
    id: number; page: string; label: string; canonical_query: string;
    is_branded: boolean; brand: string | null;
    match_decision: ClusterMatchReviewRow["match_decision"];
    match_score: number | null;
    match_components: ClusterMatchReviewRow["match_components"];
    matched_from_id: number | null;
    member_count: number;
    last_seen_at: string;
    first_seen_at: string;
    cp_seo_query_findings: { query: string }[] | null;
    matched_from: { label: string } | { label: string }[] | null;
  };

  return (data as unknown as Raw[]).map((r) => ({
    id: r.id,
    page: r.page,
    label: r.label,
    canonical_query: r.canonical_query,
    is_branded: r.is_branded,
    brand: r.brand,
    match_decision: r.match_decision,
    match_score: r.match_score,
    match_components: r.match_components,
    matched_from_id: r.matched_from_id,
    matched_from_label: Array.isArray(r.matched_from)
      ? r.matched_from[0]?.label ?? null
      : r.matched_from?.label ?? null,
    member_count: r.member_count,
    member_queries: (r.cp_seo_query_findings ?? []).map((f) => f.query),
    last_seen_at: r.last_seen_at,
    first_seen_at: r.first_seen_at,
  }));
}
