// runSyncJob — Phase 1A clustered sync orchestration.
//
// Pipeline: data fetch (existing run.ts in clustering mode) → embed →
// per-page cluster → label (concurrent LLM) → match against existing →
// upsert clusters/findings/opportunities/pages. Writes progress to
// cp_seo_sync_jobs throughout so the admin UI can poll.
//
// Idempotent in the happy path; failed mid-run leaves the DB partial and
// the next successful run reconciles via match procedure + archiving.

import { createClient as createSb, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { runOpportunityExport, type SeoOpportunityRow, type SeoPageRow } from "./run";
import { embedQueries, vectorToPgLiteral } from "./embed";
import {
  clusterPageQueries,
  matchClusters,
  meanCentroid,
  type ClusterableQuery,
  type CandidateForMatch,
  type ExistingClusterForMatch,
  type MatchResult,
} from "./cluster";
import { labelClustersConcurrently, type LabelInput, type LabelResult } from "./label";
import {
  classifyClustersConcurrently,
  rankAnchorQueries,
  type AnchorCandidate,
  type CoverageInput,
  type CoverageMemberSignal,
  type CoverageResult,
} from "./coverage";
import type { PageMeta } from "./classify";
import { SyncJobReporter, type CompletionStats } from "./sync-job-reporter";

function getServiceClient(): SupabaseClient {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// Approximate per-token costs for cost tracking. Keep small and editable.
const COST_PER_TOKEN = {
  embedding: 0.02 / 1_000_000,        // text-embedding-3-small
  llm_input:  1.0  / 1_000_000,        // claude-haiku-4-5 input
  llm_output: 5.0  / 1_000_000,        // claude-haiku-4-5 output
};

function estimateCost(tokens: { embed: number; llmIn: number; llmOut: number }): number {
  return (
    tokens.embed * COST_PER_TOKEN.embedding +
    tokens.llmIn * COST_PER_TOKEN.llm_input +
    tokens.llmOut * COST_PER_TOKEN.llm_output
  );
}

const CLUSTER_THRESHOLD = Number(process.env.SEO_CLUSTER_COSINE_THRESHOLD ?? 0.55);
const MATCH_AUTO = Number(process.env.SEO_MATCH_AUTO_THRESHOLD ?? 0.72);
const MATCH_REVIEW = Number(process.env.SEO_MATCH_REVIEW_THRESHOLD ?? 0.55);

/**
 * Mark abandoned sync_jobs rows as failed so a crashed worker doesn't block
 * new runs. Called from both createSyncJob() and getActiveSyncJob() to keep
 * the system self-healing without operator intervention.
 *
 * - Pending > 5min (worker never reported reporter.start)
 * - Running with no updated_at heartbeat > 10min (worker stopped reporting)
 */
export async function sweepAbandonedSyncJobs(): Promise<void> {
  const supabase = getServiceClient();
  await sweepAbandonedJobs(supabase);
}

/**
 * Create a new sync_jobs row in 'pending' state and return the id. Caller
 * then dispatches runSyncJob(jobId) (typically via Next.js `after()`).
 */
export async function createSyncJob(opts: {
  trigger: "cron" | "admin";
  triggeredBy?: string;
}): Promise<{ jobId: number }> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("cp_seo_sync_jobs")
    .insert({
      trigger: opts.trigger,
      triggered_by: opts.triggeredBy ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(`createSyncJob: ${error.message}`);
  return { jobId: data.id as number };
}

async function sweepAbandonedJobs(supabase: SupabaseClient): Promise<void> {
  const now = new Date();
  const pendingCutoff = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const runningCutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  // Pending jobs that never started.
  await supabase
    .from("cp_seo_sync_jobs")
    .update({
      status: "failed",
      failed_at: now.toISOString(),
      error_message: "Abandoned: worker never started (likely crashed before reporter.start)",
    })
    .eq("status", "pending")
    .lt("triggered_at", pendingCutoff);

  // Running jobs whose heartbeat went stale.
  await supabase
    .from("cp_seo_sync_jobs")
    .update({
      status: "failed",
      failed_at: now.toISOString(),
      error_message: "Abandoned: worker stopped reporting progress",
    })
    .eq("status", "running")
    .lt("updated_at", runningCutoff);
}

/**
 * Returns the most recent active job (pending or running), if any. Used by
 * the admin UI to detect "is a sync already in flight?" before letting a
 * user trigger another one.
 */
export async function getActiveSyncJob(): Promise<{
  id: number;
  status: string;
  current_phase: string | null;
  triggered_at: string;
} | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("cp_seo_sync_jobs")
    .select("id, status, current_phase, triggered_at")
    .in("status", ["pending", "running"])
    .order("triggered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActiveSyncJob: ${error.message}`);
  return (data as { id: number; status: string; current_phase: string | null; triggered_at: string } | null) ?? null;
}

// ─── Main orchestration ────────────────────────────────────────────────────

export async function runSyncJob(jobId: number): Promise<void> {
  const supabase = getServiceClient();
  const reporter = new SyncJobReporter(supabase, jobId);

  let embedTokens = 0;
  let llmIn = 0;
  let llmOut = 0;

  try {
    await reporter.start();

    // ── Phase: data fetch (existing pipeline in clustering mode) ──────────
    await reporter.setPhase("gsc");
    const { pages, opportunities, pageMetas } = await runOpportunityExport({
      includeAllForClustering: true,
    });
    await reporter.log(
      `Pulled ${opportunities.length} striking-distance keywords across ${pages.length} revenue pages`,
    );
    if (opportunities.length === 0) {
      await reporter.complete(emptyStats(pages.length));
      return;
    }

    // ── Phase: embed (unique queries only) ────────────────────────────────
    await reporter.setPhase("embed");
    const uniqueQueries = [...new Set(opportunities.map((o) => o.query))];
    await reporter.setProgress(0, uniqueQueries.length, "queries");
    const embedResult = await embedQueries(uniqueQueries);
    embedTokens += embedResult.inputTokens;
    const embedByQuery = new Map<string, number[]>();
    for (let i = 0; i < uniqueQueries.length; i++) {
      embedByQuery.set(uniqueQueries[i], embedResult.embeddings[i]);
    }
    await reporter.setProgress(uniqueQueries.length, uniqueQueries.length, "queries");

    // ── Phase: cluster (per page) ─────────────────────────────────────────
    await reporter.setPhase("cluster");
    const candidatesByPage = clusterAllPages(opportunities, embedByQuery);
    const candidateCount = sumValues(candidatesByPage, (cs) => cs.length);
    await reporter.log(
      `Built ${candidateCount} candidate clusters across ${candidatesByPage.size} pages`,
    );

    // ── Phase: label (concurrent LLM calls) ───────────────────────────────
    await reporter.setPhase("label", candidateCount);
    const flatCandidates = flattenWithPage(candidatesByPage);
    const labelInputs: LabelInput[] = flatCandidates.map((c) => ({
      memberQueries: c.cluster.members.map((m) => m.query),
      ahrefsIntentPrior: c.aggregates.ahrefs_intent_prior,
      brand: c.cluster.brand,
      retailer: c.cluster.retailer,
      productFamily: c.cluster.product_family,
    }));
    let done = 0;
    const labels = await labelClustersConcurrently(labelInputs, {
      concurrency: 10,
      onResult: (i, r) => {
        llmIn += r.tokens.input;
        llmOut += r.tokens.output;
        done += 1;
        // Fire-and-forget — progress write shouldn't block.
        void reporter.setProgress(done, candidateCount, "clusters");
      },
    });

    // ── Phase: match against existing ─────────────────────────────────────
    await reporter.setPhase("match");
    const existingByPage = await loadExistingClustersByPage(supabase, [...candidatesByPage.keys()]);
    const matchedByPage = matchAllPages(candidatesByPage, labels, existingByPage);
    const matchSummary = summarizeMatches(matchedByPage);
    await reporter.log(
      `Matches — auto: ${matchSummary.auto}, review: ${matchSummary.review}, new: ${matchSummary.new_}`,
    );

    // ── Phase: classify (per-cluster coverage LLM) ────────────────────────
    await reporter.setPhase("classify", candidateCount);
    // Build cross-page query → competing pages map ONCE for the whole sync.
    // Any query that appears in striking-distance findings on more than one
    // revenue page is a cannibalization signal the classifier should see.
    const queryToPages = buildQueryPagesMap(opportunities);
    const coverageInputs = buildCoverageInputs(flatCandidates, labels, pageMetas, queryToPages);
    const anchorsByCluster = coverageInputs.map((ci) => ci.anchors);
    const cannibalByCluster = coverageInputs.map((ci) => buildCannibalOverlap(ci.members));

    let classifiedDone = 0;
    let coverageEmitted: CoverageResult[] = [];
    if (coverageInputs.length > 0) {
      coverageEmitted = await classifyClustersConcurrently(coverageInputs, {
        concurrency: 10,
        onResult: (_i, r) => {
          llmIn += r.tokens.input;
          llmOut += r.tokens.output;
          classifiedDone += 1;
          void reporter.setProgress(classifiedDone, candidateCount, "clusters");
        },
      });
      const kindCounts = coverageEmitted.reduce<Record<string, number>>((m, r) => {
        m[r.kind] = (m[r.kind] ?? 0) + 1;
        return m;
      }, {});
      await reporter.log(
        `Coverage kinds — ${Object.entries(kindCounts).map(([k, n]) => `${k}: ${n}`).join(", ") || "(none)"}`,
      );
    }

    // ── Phase: upsert ─────────────────────────────────────────────────────
    await reporter.setPhase("upsert");
    const upsertResult = await upsertEverything(supabase, {
      pages,
      candidatesByPage,
      labels,
      flatCandidates,
      matchedByPage,
      existingByPage,
      coverage: coverageEmitted,
      anchorsByCluster,
      cannibalByCluster,
    });

    const tokens = { embed: embedTokens, llmIn, llmOut };
    const cost = estimateCost(tokens);
    await reporter.complete({
      pages_processed: pages.length,
      clusters_created: upsertResult.created,
      clusters_matched: upsertResult.matched,
      clusters_review_flagged: matchSummary.review,
      clusters_archived: upsertResult.archived,
      opportunities_total: upsertResult.opportunities,
      embedding_tokens: tokens.embed,
      llm_input_tokens: tokens.llmIn,
      llm_output_tokens: tokens.llmOut,
      estimated_cost_usd: Number(cost.toFixed(4)),
    });
  } catch (err) {
    await reporter.fail(err);
    throw err;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type EmbeddedQuery = ClusterableQuery & {
  // Reference back to source row so we can pull GSC + Ahrefs metrics later.
  source: SeoOpportunityRow;
};

type PageCandidate = {
  page: string;
  cluster: ReturnType<typeof clusterPageQueries<EmbeddedQuery>>[number];
  aggregates: ClusterAggregates;
  topicSignature: string;
};

type ClusterAggregates = {
  total_impressions: number;
  total_volume: number;
  total_missed_clicks: number;
  weighted_ctr_pct: number | null;
  expected_ctr_pct: number | null;
  avg_position: number | null;
  min_kd: number | null;
  max_kd: number | null;
  score: number;
  ahrefs_intent_prior: string | null;
  ahrefs_intent_mix: Record<string, number>;
};

function clusterAllPages(
  opportunities: SeoOpportunityRow[],
  embedByQuery: Map<string, number[]>,
): Map<string, PageCandidate[]> {
  const byPage = new Map<string, EmbeddedQuery[]>();
  for (const o of opportunities) {
    const embedding = embedByQuery.get(o.query);
    if (!embedding) continue; // safety: should never happen
    const list = byPage.get(o.page) ?? [];
    list.push({ query: o.query, embedding, source: o });
    byPage.set(o.page, list);
  }

  const out = new Map<string, PageCandidate[]>();
  for (const [page, queries] of byPage) {
    const clusters = clusterPageQueries(queries, { threshold: CLUSTER_THRESHOLD });
    const candidates: PageCandidate[] = clusters.map((cluster) => {
      const aggregates = aggregateCluster(cluster.members.map((m) => m.source));
      const topicSignature = makeTopicSignature(page, cluster.canonical_query, aggregates.ahrefs_intent_prior, cluster.is_branded, cluster.brand);
      return { page, cluster, aggregates, topicSignature };
    });
    out.set(page, candidates);
  }
  return out;
}

function aggregateCluster(rows: SeoOpportunityRow[]): ClusterAggregates {
  let totalImp = 0;
  let totalVol = 0;
  let totalClicks = 0;
  let totalExpectedClicks = 0;
  let totalMissedClicks = 0;
  let posSum = 0;
  let posCount = 0;
  let minKd: number | null = null;
  let maxKd: number | null = null;
  const intentMix: Record<string, number> = {};
  let scoreSum = 0;

  for (const r of rows) {
    totalImp += r.impressions ?? 0;
    totalVol += r.volume ?? 0;
    totalClicks += r.clicks ?? 0;
    const expectedCtrFraction = (r.expected_ctr_pct ?? 0) / 100;
    const expectedClicks = Math.round((r.impressions ?? 0) * expectedCtrFraction);
    totalExpectedClicks += expectedClicks;
    totalMissedClicks += Math.max(0, expectedClicks - (r.clicks ?? 0));
    if (r.position != null) { posSum += r.position; posCount++; }
    if (r.kd != null) {
      if (minKd == null || r.kd < minKd) minKd = r.kd;
      if (maxKd == null || r.kd > maxKd) maxKd = r.kd;
    }
    if (r.intents) {
      for (const tag of r.intents.split("|").filter(Boolean)) {
        intentMix[tag] = (intentMix[tag] ?? 0) + 1;
      }
    }
    scoreSum += r.score ?? 0;
  }

  const weighted_ctr_pct = totalImp > 0 ? Math.round((totalClicks / totalImp) * 10000) / 100 : null;
  const expected_ctr_pct = totalImp > 0 ? Math.round((totalExpectedClicks / totalImp) * 10000) / 100 : null;
  const avg_position = posCount > 0 ? Math.round((posSum / posCount) * 10) / 10 : null;
  const ahrefs_intent_prior = pickIntentMode(intentMix);

  return {
    total_impressions: totalImp,
    total_volume: totalVol,
    total_missed_clicks: totalMissedClicks,
    weighted_ctr_pct,
    expected_ctr_pct,
    avg_position,
    min_kd: minKd,
    max_kd: maxKd,
    score: Math.round(scoreSum),
    ahrefs_intent_prior,
    ahrefs_intent_mix: intentMix,
  };
}

function pickIntentMode(mix: Record<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of Object.entries(mix)) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
}

function makeTopicSignature(
  page: string,
  canonicalQuery: string,
  intentPrior: string | null,
  isBranded: boolean,
  brand: string | null,
): string {
  return createHash("sha256")
    .update(`${page}\n${canonicalQuery}\n${intentPrior ?? ""}\n${isBranded ? 1 : 0}\n${brand ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

function flattenWithPage(byPage: Map<string, PageCandidate[]>): PageCandidate[] {
  const out: PageCandidate[] = [];
  for (const list of byPage.values()) out.push(...list);
  return out;
}

function sumValues<K, V>(map: Map<K, V>, pick: (v: V) => number): number {
  let s = 0;
  for (const v of map.values()) s += pick(v);
  return s;
}

// ─── Match against existing ────────────────────────────────────────────────

async function loadExistingClustersByPage(
  supabase: SupabaseClient,
  pages: string[],
): Promise<Map<string, ExistingClusterForMatch[]>> {
  if (pages.length === 0) return new Map();

  // Pull existing open clusters and their member queries via findings join.
  const { data, error } = await supabase
    .from("cp_seo_clusters")
    .select(
      "id, page, label, current_centroid, original_centroid, is_branded, brand, retailer, product_family, cp_seo_query_findings(query)",
    )
    .in("page", pages)
    .is("archived_at", null);
  if (error) throw new Error(`loadExistingClusters: ${error.message}`);

  const byPage = new Map<string, ExistingClusterForMatch[]>();
  for (const row of (data ?? []) as Array<{
    id: number; page: string; label: string;
    current_centroid: string; original_centroid: string;
    is_branded: boolean; brand: string | null; retailer: string | null; product_family: string | null;
    cp_seo_query_findings: { query: string }[] | null;
  }>) {
    const ex: ExistingClusterForMatch = {
      id: row.id,
      label: row.label,
      current_centroid: parsePgVector(row.current_centroid),
      original_centroid: parsePgVector(row.original_centroid),
      is_branded: row.is_branded,
      brand: row.brand,
      retailer: row.retailer,
      product_family: row.product_family,
      member_queries: new Set((row.cp_seo_query_findings ?? []).map((f) => f.query)),
    };
    const list = byPage.get(row.page) ?? [];
    list.push(ex);
    byPage.set(row.page, list);
  }
  return byPage;
}

function parsePgVector(s: string): number[] {
  // Postgres `vector` type comes back as the literal '[1,2,3]'.
  if (typeof s !== "string" || s.length < 2) return [];
  return s.slice(1, -1).split(",").map(Number);
}

function matchAllPages(
  candidatesByPage: Map<string, PageCandidate[]>,
  labels: LabelResult[],
  existingByPage: Map<string, ExistingClusterForMatch[]>,
): Map<string, MatchResult[]> {
  const out = new Map<string, MatchResult[]>();
  let labelIdx = 0;

  for (const [page, candidates] of candidatesByPage) {
    const candidateInputs: CandidateForMatch[] = candidates.map((c) => ({
      centroid: c.cluster.centroid,
      members: new Set(c.cluster.members.map((m) => m.query)),
      label: labels[labelIdx].label, // labels are flattened in the same order as flatCandidates
      is_branded: c.cluster.is_branded,
      brand: c.cluster.brand,
      retailer: c.cluster.retailer,
      product_family: c.cluster.product_family,
    }));
    labelIdx += candidates.length;

    const existing = existingByPage.get(page) ?? [];
    const results = matchClusters(candidateInputs, existing, {
      autoThreshold: MATCH_AUTO,
      reviewThreshold: MATCH_REVIEW,
      driftThreshold: 0.45,
      weights: { centroid: 0.6, jaccard: 0.3, label: 0.1 },
    });
    out.set(page, results);
  }
  return out;
}

function summarizeMatches(matchedByPage: Map<string, MatchResult[]>): {
  auto: number; review: number; new_: number;
} {
  let auto = 0, review = 0, new_ = 0;
  for (const results of matchedByPage.values()) {
    for (const r of results) {
      if (r.decision === "auto") auto++;
      else if (r.decision === "review") review++;
      else new_++;
    }
  }
  return { auto, review, new_ };
}

// ─── Upsert ────────────────────────────────────────────────────────────────

async function upsertEverything(
  supabase: SupabaseClient,
  ctx: {
    pages: SeoPageRow[];
    candidatesByPage: Map<string, PageCandidate[]>;
    labels: LabelResult[];
    flatCandidates: PageCandidate[];
    matchedByPage: Map<string, MatchResult[]>;
    existingByPage: Map<string, ExistingClusterForMatch[]>;
    /** One per flatCandidates entry, in the same order. Empty when no clusters were classified. */
    coverage: CoverageResult[];
    /** One per flatCandidates entry — the deterministic anchor query ranking. */
    anchorsByCluster: { query: string; score: number }[][];
    /** One per flatCandidates entry — { query: ['/page-a',…] } cannibalization snapshot. */
    cannibalByCluster: Record<string, string[]>[];
  },
): Promise<{ created: number; matched: number; archived: number; opportunities: number }> {
  const now = new Date().toISOString();
  const embeddingModel = process.env.SEO_EMBEDDING_MODEL!;
  const embeddingDim = Number(process.env.SEO_EMBEDDING_DIMENSIONS!);

  let created = 0, matched = 0, archived = 0, opportunities = 0;

  // 0. One-time legacy cleanup — query-level rows in cp_seo_opportunities
  //    that pre-date the cluster reshape collide with UNIQUE(page, query) on
  //    insert. Their state is already preserved in the user_state_archive
  //    table; delete to clear the slot. After the first run, this is a no-op.
  await supabase.from("cp_seo_opportunities").delete().is("cluster_id", null);

  // 1. Update existing pages (or insert if missing).
  await upsertPages(supabase, ctx.pages, now);

  // 2. For each page, upsert clusters (UPDATE matched, INSERT new, ARCHIVE orphans),
  //    then findings, then opportunities.
  let labelIdx = 0;
  for (const [page, candidates] of ctx.candidatesByPage) {
    const matchResults = ctx.matchedByPage.get(page) ?? [];
    const existing = ctx.existingByPage.get(page) ?? [];
    const matchedExistingIds = new Set<number>();

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const m = matchResults[i];
      const label = ctx.labels[labelIdx];
      const cov = ctx.coverage[labelIdx] ?? null;
      const anchors = ctx.anchorsByCluster[labelIdx] ?? [];
      const cannibal = ctx.cannibalByCluster[labelIdx] ?? {};
      labelIdx++;

      const baseFields = {
        page,
        label: label.label,
        canonical_query: c.cluster.canonical_query,
        topic_signature: c.topicSignature,
        current_centroid: vectorToPgLiteral(c.cluster.centroid),
        is_branded: c.cluster.is_branded,
        brand: c.cluster.brand,
        retailer: c.cluster.retailer,
        product_family: c.cluster.product_family,
        ahrefs_intent_prior: c.aggregates.ahrefs_intent_prior,
        ahrefs_intent_mix: c.aggregates.ahrefs_intent_mix,
        member_count: c.cluster.members.length,
        total_impressions: c.aggregates.total_impressions,
        total_volume: c.aggregates.total_volume,
        total_missed_clicks: c.aggregates.total_missed_clicks,
        weighted_ctr_pct: c.aggregates.weighted_ctr_pct,
        expected_ctr_pct: c.aggregates.expected_ctr_pct,
        avg_position: c.aggregates.avg_position,
        min_kd: c.aggregates.min_kd,
        max_kd: c.aggregates.max_kd,
        score: c.aggregates.score,
        embedding_model: embeddingModel,
        embedding_dim: embeddingDim,
        label_model: label.modelId,
        label_prompt_v: label.promptVersion,
        label_input_digest: label.audit,
        match_decision: m.decision,
        match_score: m.score,
        match_components: m.components,
        // Phase 1B coverage classifier output
        coverage_kind: cov?.kind ?? null,
        coverage_recommendation: cov?.recommendation ?? null,
        coverage_confidence: cov?.confidence ?? null,
        coverage_model: cov?.modelId ?? null,
        coverage_prompt_v: cov?.promptVersion ?? null,
        coverage_input_digest: cov?.audit ?? null,
        coverage_classified_at: cov ? now : null,
        anchor_queries: anchors,
        cannibal_overlap: cannibal,
        last_seen_at: now,
        archived_at: null,
      };

      let clusterId: number;
      if (m.decision === "new" || m.matched_id == null) {
        // INSERT: original_centroid = current_centroid (frozen at creation)
        const { data, error } = await supabase
          .from("cp_seo_clusters")
          .insert({
            ...baseFields,
            original_centroid: vectorToPgLiteral(c.cluster.centroid),
            matched_from_id: null,
          })
          .select("id")
          .single();
        if (error) throw new Error(`insert cluster on ${page}: ${error.message}`);
        clusterId = data.id as number;
        created++;
      } else {
        // UPDATE: keep original_centroid + first_seen_at intact.
        const { error } = await supabase
          .from("cp_seo_clusters")
          .update({
            ...baseFields,
            matched_from_id: m.matched_id,
          })
          .eq("id", m.matched_id);
        if (error) throw new Error(`update cluster ${m.matched_id} on ${page}: ${error.message}`);
        clusterId = m.matched_id;
        matched++;
        matchedExistingIds.add(m.matched_id);
      }

      // Findings for this cluster.
      const findingRows = c.cluster.members.map((member) => ({
        cluster_id: clusterId,
        page,
        query: member.query,
        query_embedding: vectorToPgLiteral(member.embedding),
        similarity_to_centroid: member.similarity_to_centroid,
        position: member.source.position,
        impressions: member.source.impressions,
        clicks: member.source.clicks,
        ctr_pct: member.source.ctr_pct,
        expected_ctr_pct: member.source.expected_ctr_pct,
        kd: member.source.kd,
        volume: member.source.volume,
        ahrefs_intents: member.source.intents,
        serp_features: member.source.serp_features,
        phrase_in_body: member.source.phrase_in_body,
        in_heading: member.source.in_heading,
        novel_tokens: member.source.novel_tokens,
        last_seen_at: now,
        archived_at: null,
      }));

      const { error: fErr } = await supabase
        .from("cp_seo_query_findings")
        .upsert(findingRows, { onConflict: "page,query" });
      if (fErr) throw new Error(`upsert findings on ${page}: ${fErr.message}`);

      // Opportunity row (one per cluster). Use upsert via cluster_id; preserve
      // user state on update.
      const { data: existingOpp, error: lookupErr } = await supabase
        .from("cp_seo_opportunities")
        .select("id, status, assigned_to, notes")
        .eq("cluster_id", clusterId)
        .maybeSingle();
      if (lookupErr) throw new Error(`opp lookup on ${page}: ${lookupErr.message}`);

      const oppKind = cov?.kind ?? "needs_review";
      if (existingOpp) {
        const { error } = await supabase
          .from("cp_seo_opportunities")
          .update({
            page,
            kind_text: oppKind,
            score: c.aggregates.score,
            last_seen_at: now,
            archived_at: null,
          })
          .eq("id", existingOpp.id);
        if (error) throw new Error(`opp update on ${page}: ${error.message}`);
      } else {
        // INSERT requires legacy columns in the row (until we drop them in a
        // follow-up migration). Provide minimal defaults.
        const { error } = await supabase
          .from("cp_seo_opportunities")
          .insert({
            cluster_id: clusterId,
            page,
            kind_text: oppKind,
            // Legacy fields — supply minimal placeholder values so NOT NULL
            // columns are satisfied.
            query: c.cluster.canonical_query,
            kind: "secondary",
            score: c.aggregates.score,
            status: "open",
            phrase_in_body: 0,
            in_heading: false,
            last_seen_at: now,
          });
        if (error) throw new Error(`opp insert on ${page}: ${error.message}`);
      }
      opportunities++;
    }

    // Archive existing clusters on this page that weren't matched.
    for (const ex of existing) {
      if (matchedExistingIds.has(ex.id)) continue;
      const { error } = await supabase
        .from("cp_seo_clusters")
        .update({ archived_at: now })
        .eq("id", ex.id);
      if (error) throw new Error(`archive cluster ${ex.id}: ${error.message}`);
      // Also archive the linked opportunity row + its findings.
      await supabase.from("cp_seo_opportunities").update({ archived_at: now }).eq("cluster_id", ex.id);
      await supabase.from("cp_seo_query_findings").update({ archived_at: now }).eq("cluster_id", ex.id);
      archived++;
    }
  }

  // 3. Refresh the open_opportunities counter on cp_seo_pages so the dashboard
  //    sees fresh counts immediately. The existing helper still works.
  await supabase.rpc("cp_seo_refresh_open_counts");

  return { created, matched, archived, opportunities };
}

async function upsertPages(
  supabase: SupabaseClient,
  pages: SeoPageRow[],
  now: string,
): Promise<void> {
  if (pages.length === 0) return;
  const rows = pages.map((p) => ({
    page: p.page,
    page_title: p.page_title,
    meta_source: p.meta_source,
    earnings_90d: p.earnings_90d,
    conversions_90d: p.conversions_90d,
    last_synced_at: now,
  }));
  const { error } = await supabase
    .from("cp_seo_pages")
    .upsert(rows, { onConflict: "page" });
  if (error) throw new Error(`upsertPages: ${error.message}`);
}

function emptyStats(pageCount: number): CompletionStats {
  return {
    pages_processed: pageCount,
    clusters_created: 0,
    clusters_matched: 0,
    clusters_review_flagged: 0,
    clusters_archived: 0,
    opportunities_total: 0,
    embedding_tokens: 0,
    llm_input_tokens: 0,
    llm_output_tokens: 0,
    estimated_cost_usd: 0,
  };
}

// ─── Phase 1B helpers: cannibalization map + coverage inputs ───────────────

/**
 * Build query → list-of-revenue-pages map from the full opportunity set.
 * Any query that ranks in striking distance on more than one page is a
 * cannibalization signal; the map is used to annotate cluster member rows
 * with their competing pages before classification.
 */
function buildQueryPagesMap(opps: SeoOpportunityRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const o of opps) {
    let s = out.get(o.query);
    if (!s) { s = new Set<string>(); out.set(o.query, s); }
    s.add(o.page);
  }
  return out;
}

function buildCoverageInputs(
  flatCandidates: PageCandidate[],
  labels: LabelResult[],
  pageMetas: Map<string, PageMeta>,
  queryToPages: Map<string, Set<string>>,
): CoverageInput[] {
  const out: CoverageInput[] = [];
  for (let idx = 0; idx < flatCandidates.length; idx++) {
    const c = flatCandidates[idx];
    const meta = pageMetas.get(c.page);
    const members: CoverageMemberSignal[] = c.cluster.members.map((m) => {
      const competing = queryToPages.get(m.query);
      const others = competing
        ? [...competing].filter((p) => p !== c.page).sort()
        : [];
      return {
        query: m.query,
        phrase_in_body: m.source.phrase_in_body,
        in_heading: m.source.in_heading,
        competing_pages: others,
      };
    });

    const anchorCandidates: AnchorCandidate[] = c.cluster.members.map((m) => ({
      query: m.query,
      position: m.source.position,
      volume: m.source.volume,
      kd: m.source.kd,
    }));
    const anchors = rankAnchorQueries(anchorCandidates, 5);

    out.push({
      page: c.page,
      pageTitle: meta?.title ?? null,
      metaDescription: meta?.description ?? null,
      headings: meta?.headings ?? [],
      bodyText: meta?.bodyText ?? "",
      clusterLabel: labels[idx]?.label ?? c.cluster.canonical_query,
      canonicalQuery: c.cluster.canonical_query,
      isBranded: c.cluster.is_branded,
      brand: c.cluster.brand,
      retailer: c.cluster.retailer,
      productFamily: c.cluster.product_family,
      ahrefsIntentPrior: c.aggregates.ahrefs_intent_prior,
      members,
      anchors,
      avgPosition: c.aggregates.avg_position,
      weightedCtrPct: c.aggregates.weighted_ctr_pct,
      expectedCtrPct: c.aggregates.expected_ctr_pct,
    });
  }
  return out;
}

/** Collapse member-level competing_pages into a {query: [pages]} object for jsonb storage. */
function buildCannibalOverlap(members: CoverageMemberSignal[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of members) {
    if (m.competing_pages && m.competing_pages.length > 0) {
      out[m.query] = m.competing_pages;
    }
  }
  return out;
}

// Type re-export so `import { meanCentroid } from "@/lib/seo/cluster"` isn't
// the only path to centroid math callers might want.
export { meanCentroid };
