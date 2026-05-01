"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import type { SeoOppStatus, SeoPage, SeoOpportunity, SeoSyncJob } from "./types";

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
        ahrefs_intent_prior, member_count, total_impressions, total_volume,
        total_missed_clicks, weighted_ctr_pct, expected_ctr_pct, avg_position,
        min_kd, max_kd, match_decision, match_score,
        coverage_recommendation, coverage_confidence,
        anchor_queries, cannibal_overlap,
        cp_seo_query_findings ( query )
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
      match_decision: SeoOpportunity["match_decision"];
      match_score: number | null;
      coverage_recommendation: string | null;
      coverage_confidence: number | string | null;
      anchor_queries: { query: string; score: number }[] | null;
      cannibal_overlap: Record<string, string[]> | null;
      cp_seo_query_findings: { query: string }[] | null;
    };
  };

  return (data as unknown as Row[]).map((row) => {
    const anchors = Array.isArray(row.cluster.anchor_queries)
      ? row.cluster.anchor_queries.map((a) => a.query).filter((q): q is string => typeof q === "string")
      : [];
    const cannibalSet = new Set<string>();
    if (row.cluster.cannibal_overlap && typeof row.cluster.cannibal_overlap === "object") {
      for (const pages of Object.values(row.cluster.cannibal_overlap)) {
        for (const p of pages ?? []) cannibalSet.add(p);
      }
    }
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
      ahrefs_intent_prior: row.cluster.ahrefs_intent_prior,
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
      recommendation: row.cluster.coverage_recommendation,
      confidence: row.cluster.coverage_confidence != null ? Number(row.cluster.coverage_confidence) : null,
      anchor_queries: anchors,
      cannibal_pages: [...cannibalSet].sort(),
    };
  });
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
