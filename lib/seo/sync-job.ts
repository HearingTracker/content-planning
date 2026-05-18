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
  type ClusterMember,
  type CandidateForMatch,
  type ExistingClusterForMatch,
  type MatchResult,
} from "./cluster";
import { labelClustersConcurrently, type LabelInput, type LabelResult } from "./label";
import {
  COVERAGE_KINDS,
  classifyClustersConcurrently,
  getCoverageClassifierConfig,
  rankAnchorQueries,
  type AnchorCandidate,
  type CompetingPage,
  type CompetitorRealism,
  type CoverageAnchor,
  type CoverageKind,
  type CoverageInput,
  type InternalLinkRecommendation,
  type CoverageMemberSignal,
  type CoverageResult,
} from "./coverage";
import type { PageMeta } from "./classify";
import { expectedCtr, tokenize } from "./classify";
import { loadSerps, normalizeUrlForMatch, type SerpData } from "./serp-data";
import { loadQuestionKeywords, type QuestionKeyword } from "./question-keywords";
import { embedPageSections, topicCoverageScore } from "./section-embeddings";
import { SyncJobReporter, type CompletionStats } from "./sync-job-reporter";
import { runSiteSynthesis } from "./synthesis";

// Hostname for SERP-membership comparison. The sync runs against
// www.hearingtracker.com paths only (forum/shop subdomains are separate GSC
// properties), so we always rebuild full URLs with this host.
const SITE_HOSTNAME = "www.hearingtracker.com";

// Per-anchor external canonical row — the shape persisted to
// cp_seo_clusters.anchor_external_canonicals (jsonb array).
type AnchorExternalCanonicalRow = {
  query: string;
  url: string;
  position: number;
  kd: number | null;
  volume: number | null;
};

type ManualSeoPriority = "low" | "medium" | "high" | "urgent";

type ManualPriorityContext = {
  byPage: Map<string, ManualSeoPriority>;
};

type RankTrend = {
  decline_positions: number;
  volatility_positions: number;
  samples: number;
};

type ClusterPrioritizationAudit = {
  formula_version: "v1";
  computed_score: number;
  legacy_actionability_score: number;
  effort_estimate: "low" | "medium" | "high";
  manual_priority_override: ManualSeoPriority | null;
  inputs: {
    traffic_impression_opportunity: number;
    current_decline_or_volatility: number;
    business_value: number;
    confidence: number;
    freshness_event_urgency: number;
    actionability: number;
    effort_multiplier: number;
    manual_priority_multiplier: number;
  };
  evidence: {
    total_impressions: number;
    total_volume: number;
    missed_clicks: number;
    earnings_90d: number;
    conversions_90d: number;
    avg_rank_decline_positions: number;
    avg_rank_volatility_positions: number;
    confidence: number | null;
  };
  rationale: string[];
};

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
    await reporter.setPhase("gsc", { detail: "Pulling source data" });
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
    await reporter.setPhase("embed", { detail: "Preparing query embeddings" });
    const uniqueQueries = [...new Set(opportunities.map((o) => o.query))];
    await reporter.setProgress(0, uniqueQueries.length, "queries", "Embedding queries");
    const embedResult = await embedQueries(uniqueQueries);
    embedTokens += embedResult.inputTokens;
    const embedByQuery = new Map<string, number[]>();
    for (let i = 0; i < uniqueQueries.length; i++) {
      embedByQuery.set(uniqueQueries[i], embedResult.embeddings[i]);
    }
    await reporter.setProgress(uniqueQueries.length, uniqueQueries.length, "queries", "Embedding queries");

    // ── Phase: cluster (per page) ─────────────────────────────────────────
    await reporter.setPhase("cluster", { detail: "Clustering queries by page" });
    const candidatesByPage = clusterAllPages(opportunities, embedByQuery);
    const candidateCount = sumValues(candidatesByPage, (cs) => cs.length);
    await reporter.setProgress(
      candidateCount,
      candidateCount,
      "candidate clusters",
      "Clustering queries by page",
    );
    await reporter.log(
      `Built ${candidateCount} candidate clusters across ${candidatesByPage.size} pages`,
    );

    // ── Phase: label (concurrent LLM calls) ───────────────────────────────
    await reporter.setPhase("label", {
      total: candidateCount,
      label: "clusters",
      detail: "Labeling clusters",
    });
    const flatCandidates = flattenWithPage(candidatesByPage);
    const labelInputs: LabelInput[] = flatCandidates.map((c) => ({
      memberQueries: c.cluster.members.map((m) => m.query),
      dataForSeoIntentPrior: c.aggregates.dataforseo_intent_prior,
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
        void reporter.setProgress(done, candidateCount, "clusters", "Labeling clusters");
      },
    });

    // ── Phase: match against existing ─────────────────────────────────────
    await reporter.setPhase("match", { detail: "Loading existing clusters" });
    const existingByPage = await loadExistingClustersByPage(supabase, [...candidatesByPage.keys()]);
    await reporter.setProgress(0, candidateCount, "clusters", "Matching against existing clusters");
    const matchedByPage = matchAllPages(candidatesByPage, labels, existingByPage);
    await reporter.setProgress(
      candidateCount,
      candidateCount,
      "clusters",
      "Matching against existing clusters",
    );
    const matchSummary = summarizeMatches(matchedByPage);
    await reporter.log(
      `Matches — auto: ${matchSummary.auto}, review: ${matchSummary.review}, new: ${matchSummary.new_}`,
    );

    // ── Phase: classify (per-cluster coverage LLM) ────────────────────────
    await reporter.setPhase("classify", { detail: "Preparing coverage analysis" });
    // Build cross-page query → competing pages map ONCE for the whole sync.
    // Any query that appears in striking-distance findings on more than one
    // revenue page is a cannibalization CANDIDATE — we then verify each via
    // a live SERP check below before letting the classifier act on it.
    const queryToPages = buildQueryPagesMap(opportunities);

    // Fetch live top-20 SERPs for two overlapping query sets:
    //   1. Multi-page candidates — used by the SERP gate to filter GSC-noise
    //      cannibalization signals (any URL flagged as "competing" must
    //      actually appear in the live top-20 organic).
    //   2. Every cluster's deterministic anchor queries — needed so we can
    //      detect AI Overviews and EXTERNAL CANONICALS (sibling HT pages
    //      ranking #1–3 above the GSC striking-distance window of 4–15).
    // Both go through cp_seo_serp_cache, so the union dedupes for free.
    const multiPageQueries = [...queryToPages.entries()]
      .filter(([, pages]) => pages.size >= 2)
      .map(([q]) => q);
    const anchorQueriesAcrossClusters = collectAnchorQueries(flatCandidates);
    const serpsToFetch = [...new Set([...multiPageQueries, ...anchorQueriesAcrossClusters])];
    await reporter.log(
      `Fetching SERPs — ${serpsToFetch.length} unique queries (${multiPageQueries.length} multi-page + ${anchorQueriesAcrossClusters.length} anchor)…`,
    );
    if (serpsToFetch.length > 0) {
      await reporter.setProgress(0, serpsToFetch.length, "SERP queries", "Checking SERP cache");
    }
    let lastSerpProgressLogged = 0;
    let lastSerpProgressReported = 0;
    let cachedSerpCount = 0;
    const serpDataByQuery = serpsToFetch.length > 0
      ? await loadSerps(serpsToFetch, "us", {
          onCacheRead: async (cached, misses) => {
            cachedSerpCount = cached;
            await reporter.setProgress(
              cached,
              cached + misses,
              "SERP queries",
              misses > 0 ? "Fetching live SERPs" : "SERP cache warm",
            );
            await reporter.log(`SERP cache — ${cached} hits, ${misses} to fetch live`);
          },
          onFetchProgress: async (completed, total) => {
            // Throttle to roughly every 10% so we don't flood log_tail.
            const step = Math.max(10, Math.ceil(total / 10));
            if (completed - lastSerpProgressLogged >= step || completed === total) {
              lastSerpProgressLogged = completed;
              await reporter.log(`SERP fetch progress — ${completed}/${total}`);
            }
            if (completed - lastSerpProgressReported >= step || completed === total) {
              lastSerpProgressReported = completed;
              await reporter.setProgress(
                cachedSerpCount + completed,
                cachedSerpCount + total,
                "SERP queries",
                "Fetching live SERPs",
              );
            }
          },
        })
      : new Map<string, SerpData>();
    await reporter.log(
      `SERP fetch — ${multiPageQueries.length} multi-page + ${anchorQueriesAcrossClusters.length} anchor queries (${serpsToFetch.length} unique), ${serpDataByQuery.size} SERPs available`,
    );

    // Question-shaped keyword expansion. Seeds are each cluster's
    // canonical_query plus its top 2 anchors (capped so a 10k-cluster sync
    // doesn't fan out to 50k DataForSEO calls). 30-day cache via
    // cp_seo_question_keyword_cache absorbs the cost across runs. Feeds the
    // FAQ-gap surface alongside PAA from the live SERP.
    const questionSeeds = collectQuestionKeywordSeeds(flatCandidates);
    let questionCacheHits = 0;
    let lastQuestionProgressLogged = 0;
    let lastQuestionProgressReported = 0;
    if (questionSeeds.length > 0) {
      await reporter.setProgress(0, questionSeeds.length, "question seeds", "Checking question cache");
      await reporter.log(`Fetching question-shaped keywords — ${questionSeeds.length} unique seeds…`);
    }
    const questionsBySeed = questionSeeds.length > 0
      ? await loadQuestionKeywords(questionSeeds, "us", {
          onCacheRead: async (cached, misses) => {
            questionCacheHits = cached;
            await reporter.setProgress(
              cached,
              cached + misses,
              "question seeds",
              misses > 0 ? "Fetching related questions" : "Question cache warm",
            );
            await reporter.log(`Question cache — ${cached} hits, ${misses} to fetch live`);
          },
          onFetchProgress: async (completed, total) => {
            const step = Math.max(10, Math.ceil(total / 10));
            if (completed - lastQuestionProgressLogged >= step || completed === total) {
              lastQuestionProgressLogged = completed;
              await reporter.log(`Question fetch progress — ${completed}/${total}`);
            }
            if (completed - lastQuestionProgressReported >= step || completed === total) {
              lastQuestionProgressReported = completed;
              await reporter.setProgress(
                questionCacheHits + completed,
                questionCacheHits + total,
                "question seeds",
                "Fetching related questions",
              );
            }
          },
        })
      : new Map<string, QuestionKeyword[]>();
    await reporter.log(
      `Question keywords — ${questionsBySeed.size} seed sets loaded`,
    );

    // (page, query) → SeoOpportunityRow lookup for "what does this competitor
    // win" annotations. Built once over the full opportunity set so every
    // cluster sees consistent positions.
    const oppByPageQuery = buildOppByPageQuery(opportunities);

    // Embed each page's topical surface (title, H1, headings, body chunks) so
    // the classifier can distinguish "exact phrase missing" from "topic
    // missing". Without this, /best-hearing-aids gets told to "add a pricing
    // section" even though it has an H2 "How much do hearing aids cost?".
    await reporter.setProgress(0, pageMetas.size, "pages", "Embedding page sections");
    await reporter.log(`Embedding page sections — ${pageMetas.size} pages…`);
    const sectionEmb = await embedPageSections(pageMetas);
    embedTokens += sectionEmb.tokens;
    await reporter.setProgress(pageMetas.size, pageMetas.size, "pages", "Embedding page sections");
    await reporter.log(
      `Section embeddings — ${sectionEmb.embeddings.size} pages, ${sectionEmb.tokens.toLocaleString()} input tokens`,
    );

    await reporter.setProgress(0, candidateCount, "clusters", "Building coverage inputs");
    const coverageInputs = buildCoverageInputs(
      flatCandidates,
      labels,
      pageMetas,
      queryToPages,
      serpDataByQuery,
      oppByPageQuery,
      sectionEmb.embeddings,
      questionsBySeed,
    );
    await reporter.setProgress(coverageInputs.length, candidateCount, "clusters", "Building coverage inputs");
    const anchorsByCluster = coverageInputs.map((ci) =>
      ci.anchors.map((a) => ({ query: a.query, score: a.score })),
    );
    // Per-(cluster, query) topic coverage score — parallel to coverageInputs.
    // Persisted on cp_seo_query_findings during the upsert phase so the
    // drilldown UI can color-code chips without reclassifying.
    const topicScoresByCluster: Map<string, number>[] = coverageInputs.map(
      (ci) => {
        const m = new Map<string, number>();
        for (const member of ci.members) {
          if (typeof member.topic_coverage_score === "number") {
            m.set(member.query, member.topic_coverage_score);
          }
        }
        return m;
      },
    );
    // Per-cluster external gap signals snapshot. Persisted to
    // cp_seo_clusters.external_gap_signals so the drilldown UI can render
    // FAQ-gap + realism without re-computing, and the next sync can pick
    // up the previous snapshot when a cluster gets re-matched but the SERP
    // didn't refresh.
    const gapSignalsByCluster = coverageInputs.map((ci) => ({
      paa: ci.paaQuestions ?? [],
      related_searches: ci.relatedSearches ?? [],
      question_keywords: ci.questionKeywords ?? [],
      serp_top_organic: ci.serpTopOrganic ?? [],
    }));

    // Per-anchor external canonicals — only anchors whose live SERP shows a
    // different HT URL ranking ≤10 produce a row here. The synthesizer reads
    // this column to detect fully_ceded_page (lib/seo/synthesis.ts).
    const anchorExternalCanonicalsByCluster: AnchorExternalCanonicalRow[][] =
      coverageInputs.map((ci) =>
        ci.anchors
          .filter((a) => a.external_canonical)
          .map((a) => ({
            query: a.query,
            url: a.external_canonical!.url,
            position: a.external_canonical!.position,
            kd: a.external_canonical!.kd,
            volume: a.external_canonical!.volume,
          })),
      );
    const cannibalByCluster = coverageInputs.map((ci) => buildCannibalOverlap(ci.members));

    let classifiedDone = 0;
    let coverageEmitted: CoverageResult[] = new Array(coverageInputs.length);
    if (coverageInputs.length > 0) {
      await reporter.setProgress(0, coverageInputs.length, "clusters", "Checking coverage reuse");
      const reusePlan = await buildCoverageReusePlan(supabase, {
        coverageInputs,
        candidatesByPage,
        matchedByPage,
        existingByPage,
      });
      coverageEmitted = reusePlan.results;
      classifiedDone = reusePlan.hitCount;
      await reporter.log(
        `Coverage reuse — ${reusePlan.hitCount} cached, ${reusePlan.missInputs.length} to classify (TTL ${reusePlan.ttlDays}d)`,
      );
      await reporter.setProgress(
        classifiedDone,
        coverageInputs.length,
        "clusters",
        reusePlan.missInputs.length > 0 ? "Classifying uncached coverage" : "Reusing cached coverage",
      );
      const freshCoverage = await classifyClustersConcurrently(reusePlan.missInputs, {
        concurrency: 10,
        onResult: (_i, r) => {
          const originalIndex = reusePlan.missIndexes[_i];
          llmIn += r.tokens.input;
          llmOut += r.tokens.output;
          classifiedDone += 1;
          r.cacheKey = reusePlan.cacheKeys[originalIndex];
          coverageEmitted[originalIndex] = r;
          void reporter.setProgress(
            classifiedDone,
            coverageInputs.length,
            "clusters",
            "Classifying coverage per cluster",
          );
        },
      });
      for (let i = 0; i < freshCoverage.length; i++) {
        const originalIndex = reusePlan.missIndexes[i];
        const result = freshCoverage[i];
        result.cacheKey = reusePlan.cacheKeys[originalIndex];
        coverageEmitted[originalIndex] = result;
      }
      const kindCounts = coverageEmitted.reduce<Record<string, number>>((m, r) => {
        m[r.kind] = (m[r.kind] ?? 0) + 1;
        return m;
      }, {});
      await reporter.log(
        `Coverage kinds — ${Object.entries(kindCounts).map(([k, n]) => `${k}: ${n}`).join(", ") || "(none)"}`,
      );
    }

    // ── Phase: upsert ─────────────────────────────────────────────────────
    await reporter.setPhase("upsert", {
      total: candidatesByPage.size,
      label: "pages",
      detail: "Writing pages and clusters",
    });
    const upsertResult = await upsertEverything(supabase, {
      jobId,
      pages,
      pageMetas,
      candidatesByPage,
      labels,
      flatCandidates,
      matchedByPage,
      existingByPage,
      coverage: coverageEmitted,
      anchorsByCluster,
      anchorExternalCanonicalsByCluster,
      cannibalByCluster,
      topicScoresByCluster,
      gapSignalsByCluster,
      onPageProgress: (completed, total) =>
        reporter.setProgress(completed, total, "pages", "Writing pages and clusters"),
    });

    // ── Phase: rank_snapshot (Phase 1D) ───────────────────────────────────
    // Persist a point-in-time snapshot of every (page, query, position)
    // into cp_seo_rank_history. The synthesizer's freshness detector reads
    // this table to compute rank-decline over the trailing 8-week window —
    // cp_seo_query_findings always reflects only the latest sync, so without
    // this snapshot rank-decline detection is structurally impossible.
    // Also handles 90-day retention pruning.
    await reporter.setPhase("rank_snapshot", { detail: "Snapshotting rank history" });
    try {
      const snapshotCount = await snapshotRankHistory(supabase);
      await reporter.setProgress(
        snapshotCount,
        snapshotCount,
        "query rows",
        "Snapshotting rank history",
      );
      await reporter.log(`Rank history — snapshotted ${snapshotCount} (page, query) rows`);
    } catch (rankErr) {
      const msg = rankErr instanceof Error ? rankErr.message : String(rankErr);
      await reporter.log(`Rank snapshot failed (non-fatal): ${msg}`);
    }

    // ── Phase: synthesize (site-wide strategic insights) ──────────────────
    // Reads the just-frozen DB state — cp_seo_clusters with anchor_external_canonicals,
    // cp_seo_query_findings, and cp_seo_serp_cache — and emits cross-page
    // findings the per-cluster classifier cannot see (fully_ceded_page,
    // undesignated_topic, aio_no_citation, orphan_target). Detection-only,
    // no LLM. Embedding tokens for orphan_target adjacency are counted.
    await reporter.setPhase("synthesize", { detail: "Synthesizing site-wide insights" });
    let synthesisEmbedTokens = 0;
    try {
      const synthesisResult = await runSiteSynthesis(supabase, jobId);
      // The detector calls embedQueries internally for orphan candidates;
      // approximate token cost as candidate query character count / 4 since
      // the helper doesn't return tokens. Off-by-a-fraction here is fine
      // for cost estimation. (We don't expose tokens from runSiteSynthesis
      // to keep the API narrow; revisit if costs become material.)
      synthesisEmbedTokens = 0;
      const counts = synthesisResult.kindCounts;
      const summary = (Object.keys(counts) as (keyof typeof counts)[])
        .filter((k) => counts[k] > 0)
        .map((k) => `${k}: ${counts[k]}`)
        .join(", ") || "(none)";
      await reporter.log(
        `Synthesis findings — total ${synthesisResult.total} (${summary}); inserted ${synthesisResult.inserted}, updated ${synthesisResult.updated}, archived ${synthesisResult.archived}`,
      );
    } catch (synthErr) {
      // Synthesis failures should not abort the whole sync — the per-cluster
      // verdicts are already persisted and useful on their own.
      const msg = synthErr instanceof Error ? synthErr.message : String(synthErr);
      await reporter.log(`Synthesis failed (non-fatal): ${msg}`);
    }
    embedTokens += synthesisEmbedTokens;

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
  // Reference back to source row so we can pull GSC + DataForSEO metrics later.
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
  dataforseo_intent_prior: string | null;
  dataforseo_intent_mix: Record<string, number>;
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
      const topicSignature = makeTopicSignature(page, cluster.canonical_query, aggregates.dataforseo_intent_prior, cluster.is_branded, cluster.brand);
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
  const dataforseo_intent_prior = pickIntentMode(intentMix);

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
    dataforseo_intent_prior,
    dataforseo_intent_mix: intentMix,
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
      "id, page, label, current_centroid, original_centroid, is_branded, brand, retailer, product_family, coverage_kind, coverage_recommendation, coverage_confidence, coverage_model, coverage_prompt_v, coverage_input_digest, coverage_classified_at, start_with_queries, coverage_cache_key, coverage_classified_in_job_id, faq_gaps, competitor_realism, cp_seo_query_findings(query)",
    )
    .in("page", pages)
    .is("archived_at", null);
  if (error) throw new Error(`loadExistingClusters: ${error.message}`);

  const byPage = new Map<string, ExistingClusterForMatch[]>();
  for (const row of (data ?? []) as Array<{
    id: number; page: string; label: string;
    current_centroid: string; original_centroid: string;
    is_branded: boolean; brand: string | null; retailer: string | null; product_family: string | null;
    coverage_kind: string | null;
    coverage_recommendation: string | null;
    coverage_confidence: number | string | null;
    coverage_model: string | null;
    coverage_prompt_v: string | null;
    coverage_input_digest: Record<string, unknown> | null;
    coverage_classified_at: string | null;
    start_with_queries: string[] | null;
    coverage_cache_key: string | null;
    coverage_classified_in_job_id: number | null;
    faq_gaps: Array<{ question: string; covered: boolean; volume: number | null }> | null;
    competitor_realism: { verdict: string; reasoning: string } | null;
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
      coverage_kind: row.coverage_kind,
      coverage_recommendation: row.coverage_recommendation,
      coverage_confidence: row.coverage_confidence == null ? null : Number(row.coverage_confidence),
      coverage_model: row.coverage_model,
      coverage_prompt_v: row.coverage_prompt_v,
      coverage_input_digest: row.coverage_input_digest,
      coverage_classified_at: row.coverage_classified_at,
      start_with_queries: row.start_with_queries,
      coverage_cache_key: row.coverage_cache_key,
      coverage_classified_in_job_id: row.coverage_classified_in_job_id,
      faq_gaps: row.faq_gaps,
      competitor_realism: row.competitor_realism,
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

type CoverageReusePlan = {
  results: CoverageResult[];
  cacheKeys: string[];
  missInputs: CoverageInput[];
  missIndexes: number[];
  hitCount: number;
  ttlDays: number;
};

async function buildCoverageReusePlan(
  supabase: SupabaseClient,
  args: {
    coverageInputs: CoverageInput[];
    candidatesByPage: Map<string, PageCandidate[]>;
    matchedByPage: Map<string, MatchResult[]>;
    existingByPage: Map<string, ExistingClusterForMatch[]>;
  },
): Promise<CoverageReusePlan> {
  const classifierConfig = getCoverageClassifierConfig();
  const cacheKeys = args.coverageInputs.map((input) =>
    makeCoverageCacheKey(input, classifierConfig),
  );
  const results: CoverageResult[] = new Array(args.coverageInputs.length);
  const matchResults = flattenMatchResults(args.candidatesByPage, args.matchedByPage);
  const existingById = indexExistingClusters(args.existingByPage);
  const ttlDays = readCoverageReuseTtlDays();

  if (ttlDays <= 0) {
    return {
      results,
      cacheKeys,
      missInputs: args.coverageInputs,
      missIndexes: args.coverageInputs.map((_, i) => i),
      hitCount: 0,
      ttlDays,
    };
  }

  const cutoffMs = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
  const candidateJobIds = new Set<number>();
  for (let i = 0; i < args.coverageInputs.length; i++) {
    const existing = matchedReusableCluster(matchResults[i], existingById);
    if (existing?.coverage_classified_in_job_id) {
      candidateJobIds.add(existing.coverage_classified_in_job_id);
    }
  }
  const completedJobIds = await loadCompletedSyncJobIds(supabase, [...candidateJobIds]);

  const missInputs: CoverageInput[] = [];
  const missIndexes: number[] = [];
  let hitCount = 0;

  for (let i = 0; i < args.coverageInputs.length; i++) {
    const existing = matchedReusableCluster(matchResults[i], existingById);
    const cached = existing
      ? coverageResultFromReusableCluster({
          existing,
          cacheKey: cacheKeys[i],
          completedJobIds,
          cutoffMs,
          classifierConfig,
        })
      : null;
    if (cached) {
      results[i] = cached;
      hitCount++;
    } else {
      missInputs.push(args.coverageInputs[i]);
      missIndexes.push(i);
    }
  }

  return { results, cacheKeys, missInputs, missIndexes, hitCount, ttlDays };
}

function flattenMatchResults(
  candidatesByPage: Map<string, PageCandidate[]>,
  matchedByPage: Map<string, MatchResult[]>,
): MatchResult[] {
  const out: MatchResult[] = [];
  for (const [page, candidates] of candidatesByPage) {
    const matches = matchedByPage.get(page) ?? [];
    for (let i = 0; i < candidates.length; i++) {
      out.push(matches[i]);
    }
  }
  return out;
}

function indexExistingClusters(
  existingByPage: Map<string, ExistingClusterForMatch[]>,
): Map<number, ExistingClusterForMatch> {
  const out = new Map<number, ExistingClusterForMatch>();
  for (const clusters of existingByPage.values()) {
    for (const cluster of clusters) out.set(cluster.id, cluster);
  }
  return out;
}

function matchedReusableCluster(
  match: MatchResult | undefined,
  existingById: Map<number, ExistingClusterForMatch>,
): ExistingClusterForMatch | null {
  if (!match || match.decision !== "auto" || match.matched_id == null) return null;
  return existingById.get(match.matched_id) ?? null;
}

async function loadCompletedSyncJobIds(
  supabase: SupabaseClient,
  jobIds: number[],
): Promise<Set<number>> {
  if (jobIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("cp_seo_sync_jobs")
    .select("id, status, completed_at")
    .in("id", jobIds);
  if (error) throw new Error(`load coverage cache job provenance: ${error.message}`);
  return new Set(
    ((data ?? []) as Array<{ id: number; status: string; completed_at: string | null }>)
      .filter((job) => job.status === "completed" && job.completed_at)
      .map((job) => job.id),
  );
}

function coverageResultFromReusableCluster(args: {
  existing: ExistingClusterForMatch;
  cacheKey: string;
  completedJobIds: Set<number>;
  cutoffMs: number;
  classifierConfig: ReturnType<typeof getCoverageClassifierConfig>;
}): CoverageResult | null {
  const {
    existing,
    cacheKey,
    completedJobIds,
    cutoffMs,
    classifierConfig,
  } = args;
  const jobId = existing.coverage_classified_in_job_id;
  const classifiedAt = existing.coverage_classified_at;
  const classifiedAtMs = classifiedAt ? Date.parse(classifiedAt) : NaN;
  const confidence = existing.coverage_confidence;

  if (!jobId || !completedJobIds.has(jobId)) return null;
  if (!classifiedAt || !Number.isFinite(classifiedAtMs) || classifiedAtMs < cutoffMs) return null;
  if (existing.coverage_cache_key !== cacheKey) return null;
  if (existing.coverage_prompt_v !== classifierConfig.promptVersion) return null;
  if (!isCoverageKind(existing.coverage_kind)) return null;
  if (!existing.coverage_recommendation) return null;
  if (confidence == null || !Number.isFinite(confidence)) return null;

  const auditSource = (existing.coverage_input_digest ?? {}) as CoverageResult["audit"];
  const existingGuardrails = Array.isArray(auditSource.guardrails)
    ? auditSource.guardrails
    : [];
  const reuseGuardrail = `coverage reused from completed sync job ${jobId}`;
  const audit = {
    ...auditSource,
    guardrails: existingGuardrails.includes(reuseGuardrail)
      ? existingGuardrails
      : [...existingGuardrails, reuseGuardrail],
  } as CoverageResult["audit"];

  // Rehydrate faq_gaps + competitor_realism from the cluster row. They were
  // written by the previous sync's classifyClusterCoverage call; pass them
  // through so the downstream upsert preserves them (otherwise reuse would
  // overwrite the gap-aware outputs with empty defaults).
  const reusedFaqGaps = Array.isArray(existing.faq_gaps)
    ? existing.faq_gaps.filter(
        (g): g is { question: string; covered: boolean; volume: number | null } =>
          !!g
          && typeof g.question === "string"
          && typeof g.covered === "boolean",
      )
    : [];
  const reusedRealism: CompetitorRealism | null = (() => {
    const r = existing.competitor_realism;
    if (!r || typeof r !== "object") return null;
    const v = (r as { verdict?: string }).verdict;
    if (v === "winnable" || v === "snippet_only" || v === "unrealistic") {
      const reasoning = typeof (r as { reasoning?: string }).reasoning === "string"
        ? (r as { reasoning: string }).reasoning
        : "";
      return { verdict: v, reasoning };
    }
    return null;
  })();

  return {
    kind: existing.coverage_kind,
    recommendation: existing.coverage_recommendation,
    confidence,
    startWith: existing.start_with_queries ?? [],
    faqGaps: reusedFaqGaps,
    competitorRealism: reusedRealism,
    modelId: existing.coverage_model ?? classifierConfig.modelId,
    promptVersion: existing.coverage_prompt_v ?? classifierConfig.promptVersion,
    cacheKey,
    cacheSource: {
      clusterId: existing.id,
      jobId,
      classifiedAt,
    },
    audit,
    tokens: { input: 0, output: 0 },
  };
}

function isCoverageKind(value: unknown): value is CoverageKind {
  return typeof value === "string" && (COVERAGE_KINDS as readonly string[]).includes(value);
}

function readCoverageReuseTtlDays(): number {
  const raw = process.env.SEO_COVERAGE_REUSE_TTL_DAYS;
  if (raw == null || raw.trim() === "") return 7;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 7;
  return n;
}

function makeCoverageCacheKey(
  input: CoverageInput,
  classifierConfig: ReturnType<typeof getCoverageClassifierConfig>,
): string {
  return createHash("sha256")
    .update(stableStringify({
      version: "coverage-cache-v1",
      classifier: classifierConfig,
      input,
    }))
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (typeof value === "number" && !Number.isFinite(value)) return "null";
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

// ─── Upsert ────────────────────────────────────────────────────────────────

async function upsertEverything(
  supabase: SupabaseClient,
  ctx: {
    jobId: number;
    pages: SeoPageRow[];
    /**
     * Per-page Storyblok + rendered metadata. Carries the new Phase 1D
     * fields (`contentModifiedAt`, `outboundInternalLinks`) that the
     * page upsert persists into cp_seo_pages.
     */
    pageMetas: Map<string, PageMeta>;
    candidatesByPage: Map<string, PageCandidate[]>;
    labels: LabelResult[];
    flatCandidates: PageCandidate[];
    matchedByPage: Map<string, MatchResult[]>;
    existingByPage: Map<string, ExistingClusterForMatch[]>;
    /** One per flatCandidates entry, in the same order. Empty when no clusters were classified. */
    coverage: CoverageResult[];
    /** One per flatCandidates entry — the deterministic anchor query ranking. */
    anchorsByCluster: { query: string; score: number }[][];
    /**
     * One per flatCandidates entry — anchors whose live SERP shows a different
     * HT URL ranking ≤10. Persisted to cp_seo_clusters.anchor_external_canonicals
     * so the site-wide synthesizer can detect fully_ceded_page in SQL.
     */
    anchorExternalCanonicalsByCluster: AnchorExternalCanonicalRow[][];
    /**
     * One per flatCandidates entry — `{ query: CompetingPage[] }` cannibalization
     * snapshot. Each `CompetingPage` carries the URL and the queries that URL
     * currently wins within this cluster (its strongest on-site rankings).
     */
    cannibalByCluster: Record<string, CompetingPage[]>[];
    /**
     * One per flatCandidates entry — per-query topic coverage score (0–1)
     * computed during buildCoverageInputs. Persisted on
     * cp_seo_query_findings so the UI can color-code chips by coverage tier.
     */
    topicScoresByCluster: Map<string, number>[];
    /**
     * One per flatCandidates entry — aggregated PAA + related searches +
     * question-shaped keywords + SERP top-organic snapshot. Persisted to
     * cp_seo_clusters.external_gap_signals; downstream consumers (FAQ-gap
     * UI, realism strip, coverage classifier) read it directly from the
     * cluster row to avoid re-fetching SERP data.
     */
    gapSignalsByCluster: Array<{
      paa: string[];
      related_searches: string[];
      question_keywords: Array<{ q: string; volume: number | null }>;
      serp_top_organic: Array<{ rank: number; url: string; domain: string }>;
    }>;
    onPageProgress?: (completed: number, total: number) => Promise<void>;
  },
): Promise<{ created: number; matched: number; archived: number; opportunities: number }> {
  const now = new Date().toISOString();
  const embeddingModel = process.env.SEO_EMBEDDING_MODEL!;
  const embeddingDim = Number(process.env.SEO_EMBEDDING_DIMENSIONS!);
  const pageRowsByPage = new Map(ctx.pages.map((p) => [p.page, p]));

  let created = 0, matched = 0, archived = 0, opportunities = 0;

  // 0. One-time legacy cleanup — query-level rows in cp_seo_opportunities
  //    that pre-date the cluster reshape collide with UNIQUE(page, query) on
  //    insert. Their state is already preserved in the user_state_archive
  //    table; delete to clear the slot. After the first run, this is a no-op.
  await supabase.from("cp_seo_opportunities").delete().is("cluster_id", null);

  const [manualPriorityContext, rankTrendByPageQuery] = await Promise.all([
    loadManualPriorityContext(supabase),
    loadRankTrendByPageQuery(supabase),
  ]);

  // 1. Update existing pages (or insert if missing).
  await upsertPages(supabase, ctx.pages, ctx.pageMetas, now);

  // 2. For each page, upsert clusters (UPDATE matched, INSERT new, ARCHIVE orphans),
  //    then findings, then opportunities.
  let labelIdx = 0;
  let pagesDone = 0;
  const totalPages = ctx.candidatesByPage.size;
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
      const anchorExternalCanonicals = ctx.anchorExternalCanonicalsByCluster[labelIdx] ?? [];
      const cannibal = ctx.cannibalByCluster[labelIdx] ?? {};
      const gapSignals = ctx.gapSignalsByCluster[labelIdx] ?? {
        paa: [],
        related_searches: [],
        question_keywords: [],
        serp_top_organic: [],
      };
      const topicScores = ctx.topicScoresByCluster[labelIdx] ?? new Map<string, number>();
      const prioritization = computeClusterPrioritization({
        pageRow: pageRowsByPage.get(page) ?? null,
        candidate: c,
        coverage: cov,
        manualPriority: manualPriorityContext.byPage.get(page) ?? null,
        rankTrendByPageQuery,
      });
      const clusterScore = prioritization.computed_score;
      const coverageInputDigest = cov?.audit
        ? { ...cov.audit, prioritization }
        : null;
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
        dataforseo_intent_prior: c.aggregates.dataforseo_intent_prior,
        dataforseo_intent_mix: c.aggregates.dataforseo_intent_mix,
        member_count: c.cluster.members.length,
        total_impressions: c.aggregates.total_impressions,
        total_volume: c.aggregates.total_volume,
        total_missed_clicks: c.aggregates.total_missed_clicks,
        weighted_ctr_pct: c.aggregates.weighted_ctr_pct,
        expected_ctr_pct: c.aggregates.expected_ctr_pct,
        avg_position: c.aggregates.avg_position,
        min_kd: c.aggregates.min_kd,
        max_kd: c.aggregates.max_kd,
        score: clusterScore,
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
        coverage_input_digest: coverageInputDigest,
        coverage_classified_at: cov ? (cov.cacheSource?.classifiedAt ?? now) : null,
        coverage_cache_key: cov?.cacheKey ?? null,
        coverage_classified_in_job_id: cov ? (cov.cacheSource?.jobId ?? ctx.jobId) : null,
        anchor_queries: anchors,
        anchor_external_canonicals: anchorExternalCanonicals,
        start_with_queries: cov?.startWith ?? [],
        cannibal_overlap: cannibal,
        external_gap_signals: gapSignals,
        faq_gaps: cov?.faqGaps ?? [],
        competitor_realism: cov?.competitorRealism ?? null,
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
        dataforseo_intents: member.source.intents,
        serp_features: member.source.serp_features,
        phrase_in_body: member.source.phrase_in_body,
        in_heading: member.source.in_heading,
        novel_tokens: member.source.novel_tokens,
        topic_coverage_score: topicScores.get(member.query) ?? null,
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
            query: c.cluster.canonical_query,
            kind: "secondary",
            kind_text: oppKind,
            score: clusterScore,
            phrase_in_body: 0,
            in_heading: false,
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
            score: clusterScore,
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

    pagesDone++;
    await ctx.onPageProgress?.(pagesDone, totalPages);
  }

  // 3. Refresh the open_opportunities counter on cp_seo_pages so the dashboard
  //    sees fresh counts immediately. The existing helper still works.
  await supabase.rpc("cp_seo_refresh_open_counts");

  return { created, matched, archived, opportunities };
}

async function upsertPages(
  supabase: SupabaseClient,
  pages: SeoPageRow[],
  pageMetas: Map<string, PageMeta>,
  now: string,
): Promise<void> {
  if (pages.length === 0) return;
  const rows = pages.map((p) => {
    const meta = pageMetas.get(p.page);
    return {
      page: p.page,
      page_title: p.page_title,
      meta_source: p.meta_source,
      earnings_90d: p.earnings_90d,
      conversions_90d: p.conversions_90d,
      last_synced_at: now,
      // Phase 1D — populated when available, null otherwise. The synthesizer
      // tolerates nulls (treats them as "unknown — don't fire freshness").
      content_modified_at: meta?.contentModifiedAt ?? null,
      outbound_internal_links: meta?.outboundInternalLinks ?? null,
    };
  });
  const { error } = await supabase
    .from("cp_seo_pages")
    .upsert(rows, { onConflict: "page" });
  if (error) throw new Error(`upsertPages: ${error.message}`);
}

async function loadManualPriorityContext(
  supabase: SupabaseClient,
): Promise<ManualPriorityContext> {
  const byPage = new Map<string, ManualSeoPriority>();
  const { data, error } = await supabase
    .from("cp_seo_manual_queue_items")
    .select("page, priority")
    .is("archived_at", null)
    .in("status", ["open", "in_progress"]);
  if (error) {
    // The manual-queue migration may not exist in older local branches. The
    // sync still produces automated priorities without the manual boost.
    return { byPage };
  }

  const rank: Record<ManualSeoPriority, number> = {
    low: 1,
    medium: 2,
    high: 3,
    urgent: 4,
  };
  for (const row of (data ?? []) as Array<{ page: string | null; priority: string | null }>) {
    const page = normalizeHtPath(row.page);
    const priority = row.priority as ManualSeoPriority | null;
    if (!page || !priority || !(priority in rank)) continue;
    const existing = byPage.get(page);
    if (!existing || rank[priority] > rank[existing]) byPage.set(page, priority);
  }
  return { byPage };
}

async function loadRankTrendByPageQuery(
  supabase: SupabaseClient,
): Promise<Map<string, RankTrend>> {
  const out = new Map<string, RankTrend>();
  const since = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString();
  const rows: Array<{ page: string; query: string; position: number; recorded_at: string }> = [];
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("cp_seo_rank_history")
      .select("page, query, position, recorded_at")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return out;
    if (!data || data.length === 0) break;
    for (const r of data as Array<{
      page: string;
      query: string;
      position: number | string;
      recorded_at: string;
    }>) {
      const position = Number(r.position);
      if (!Number.isFinite(position)) continue;
      rows.push({ page: r.page, query: r.query, position, recorded_at: r.recorded_at });
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.page}|${row.query}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  for (const [key, list] of grouped) {
    if (list.length < 2) continue;
    const first = list[0].position;
    const latest = list[list.length - 1].position;
    const mean = list.reduce((sum, r) => sum + r.position, 0) / list.length;
    const variance = list.reduce((sum, r) => sum + ((r.position - mean) ** 2), 0) / list.length;
    out.set(key, {
      decline_positions: Math.round((latest - first) * 10) / 10,
      volatility_positions: Math.round(Math.sqrt(variance) * 10) / 10,
      samples: list.length,
    });
  }
  return out;
}

function computeClusterPrioritization(args: {
  pageRow: SeoPageRow | null;
  candidate: PageCandidate;
  coverage: CoverageResult | null;
  manualPriority: ManualSeoPriority | null;
  rankTrendByPageQuery: Map<string, RankTrend>;
}): ClusterPrioritizationAudit {
  const { pageRow, candidate, coverage, manualPriority, rankTrendByPageQuery } = args;
  const kind = (coverage?.kind ?? "needs_review") as CoverageKind;
  const confidence = coverage?.confidence ?? null;
  const rankTrend = summarizeClusterRankTrend(
    candidate.page,
    candidate.cluster.members.map((m) => m.query),
    rankTrendByPageQuery,
  );
  const missedClicks = candidate.aggregates.total_missed_clicks;
  const totalImpressions = candidate.aggregates.total_impressions;
  const totalVolume = candidate.aggregates.total_volume;
  const trafficScore = Math.min(
    40,
    Math.log1p((missedClicks * 12) + (totalImpressions * 0.08) + (totalVolume * 0.05)) * 5,
  );
  const earnings = pageRow?.earnings_90d ?? 0;
  const conversions = pageRow?.conversions_90d ?? 0;
  const businessScore = Math.min(20, (Math.log1p(earnings) * 2.2) + (conversions * 0.6));
  const declineScore = Math.min(
    15,
    (Math.max(0, rankTrend.avgDecline) * 3) + (rankTrend.avgVolatility * 1.2),
  );
  const confidenceScore = Math.min(15, (confidence ?? 0.35) * 15);
  const freshnessTriggered =
    coverage?.audit.recommendation_audit?.freshness_trigger.triggered === true;
  const freshnessScore = freshnessTriggered ? 8 : 0;
  const actionabilityScore = kindActionabilityScore(kind);
  const standaloneRecommended = coverage?.audit.standalone_article?.recommended === true;
  const effort = estimateEffort(kind, standaloneRecommended);
  const effortMultiplier = effort === "low" ? 1 : effort === "medium" ? 0.85 : 0.68;
  const manualMultiplier = manualPriorityMultiplier(manualPriority);
  const raw =
    trafficScore
    + businessScore
    + declineScore
    + confidenceScore
    + freshnessScore
    + actionabilityScore;
  const computedScore = Math.max(1, Math.round(raw * effortMultiplier * manualMultiplier * 10));

  const rationale = [
    `traffic ${trafficScore.toFixed(1)}/40 from impressions, volume, and missed clicks`,
    `business ${businessScore.toFixed(1)}/20 from 90d earnings/conversions`,
    rankTrend.samples > 0
      ? `rank trend ${declineScore.toFixed(1)}/15 from ${rankTrend.samples} historical samples`
      : "rank trend unavailable; no decline boost applied",
    `confidence ${confidenceScore.toFixed(1)}/15`,
    freshnessTriggered ? "freshness/event urgency boost applied" : "no freshness/event urgency boost",
    manualPriority ? `manual ${manualPriority} priority multiplier applied` : "no manual priority override",
    `${effort} effort multiplier applied`,
  ];

  return {
    formula_version: "v1",
    computed_score: computedScore,
    legacy_actionability_score: candidate.aggregates.score,
    effort_estimate: effort,
    manual_priority_override: manualPriority,
    inputs: {
      traffic_impression_opportunity: round1(trafficScore),
      current_decline_or_volatility: round1(declineScore),
      business_value: round1(businessScore),
      confidence: round1(confidenceScore),
      freshness_event_urgency: round1(freshnessScore),
      actionability: round1(actionabilityScore),
      effort_multiplier: effortMultiplier,
      manual_priority_multiplier: manualMultiplier,
    },
    evidence: {
      total_impressions: totalImpressions,
      total_volume: totalVolume,
      missed_clicks: missedClicks,
      earnings_90d: earnings,
      conversions_90d: conversions,
      avg_rank_decline_positions: round1(rankTrend.avgDecline),
      avg_rank_volatility_positions: round1(rankTrend.avgVolatility),
      confidence,
    },
    rationale,
  };
}

function summarizeClusterRankTrend(
  page: string,
  queries: string[],
  rankTrendByPageQuery: Map<string, RankTrend>,
): { avgDecline: number; avgVolatility: number; samples: number } {
  const trends = queries
    .map((q) => rankTrendByPageQuery.get(`${page}|${q}`))
    .filter((t): t is RankTrend => t != null);
  if (trends.length === 0) {
    return { avgDecline: 0, avgVolatility: 0, samples: 0 };
  }
  return {
    avgDecline: trends.reduce((sum, t) => sum + Math.max(0, t.decline_positions), 0) / trends.length,
    avgVolatility: trends.reduce((sum, t) => sum + t.volatility_positions, 0) / trends.length,
    samples: trends.reduce((sum, t) => sum + t.samples, 0),
  };
}

function kindActionabilityScore(kind: CoverageKind): number {
  switch (kind) {
    case "intent_gap":
      return 10;
    case "coverage_partial":
      return 9;
    case "consolidate":
      return 9;
    case "ai_overview_loss":
      return 8;
    case "snippet_ctr":
      return 6;
    case "needs_review":
      return 3;
    case "wrong_page":
    case "cede":
      return 2;
    case "coverage_strong":
      return 0;
  }
}

function estimateEffort(
  kind: CoverageKind,
  standaloneRecommended: boolean,
): ClusterPrioritizationAudit["effort_estimate"] {
  if (standaloneRecommended || kind === "intent_gap" || kind === "consolidate") return "high";
  if (kind === "coverage_partial" || kind === "ai_overview_loss" || kind === "needs_review") return "medium";
  return "low";
}

function manualPriorityMultiplier(priority: ManualSeoPriority | null): number {
  if (priority === "urgent") return 1.6;
  if (priority === "high") return 1.35;
  if (priority === "medium") return 1.15;
  if (priority === "low") return 1.05;
  return 1;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Persist a point-in-time rank snapshot from the just-written
 * cp_seo_query_findings into cp_seo_rank_history. Each row is a
 * (page, query, position, recorded_at) tuple — recorded_at is the same
 * for every row in this snapshot so they form one logical "sync point."
 *
 * Also prunes rows older than 90 days. Storage stays bounded.
 */
async function snapshotRankHistory(supabase: SupabaseClient): Promise<number> {
  const recordedAt = new Date().toISOString();

  // Read findings in pages — Postgres caps default at 1000 rows. Pull every
  // page from cp_seo_query_findings and snapshot.
  const PAGE_SIZE = 1000;
  let offset = 0;
  let inserted = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cp_seo_query_findings")
      .select("page, query, position")
      .is("archived_at", null)
      .not("position", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`load findings for snapshot: ${error.message}`);
    if (!data || data.length === 0) break;

    const rows = data.map((r) => ({
      page: r.page as string,
      query: r.query as string,
      position: r.position as number,
      recorded_at: recordedAt,
    }));
    const { error: insErr } = await supabase
      .from("cp_seo_rank_history")
      .upsert(rows, { onConflict: "page,query,recorded_at" });
    if (insErr) throw new Error(`insert rank history: ${insErr.message}`);
    inserted += rows.length;
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Retention: drop rows older than 90 days.
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("cp_seo_rank_history")
    .delete()
    .lt("recorded_at", cutoff);

  return inserted;
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
  serpDataByQuery: Map<string, SerpData>,
  oppByPageQuery: Map<string, Map<string, SeoOpportunityRow>>,
  pageSectionEmbeddings: Map<string, number[][]>,
  questionsBySeed: Map<string, QuestionKeyword[]>,
): CoverageInput[] {
  const out: CoverageInput[] = [];
  const pageLinkProfiles = buildPageLinkProfiles(pageMetas);
  for (let idx = 0; idx < flatCandidates.length; idx++) {
    const c = flatCandidates[idx];
    const meta = pageMetas.get(c.page);
    const sectionEmbs = pageSectionEmbeddings.get(c.page) ?? [];
    // Pre-compute the cluster's member-query set once so we can scope
    // "wins" to queries the classifier is actually deciding about.
    const clusterMemberQueries = c.cluster.members.map((mm) => mm.query);
    const members: CoverageMemberSignal[] = c.cluster.members.map((m) => {
      const competing = queryToPages.get(m.query);
      const others = competing
        ? [...competing].filter((p) => p !== c.page).sort()
        : [];
      const verifiedCompetitors = others.length > 0
        ? verifyCompetingPages({
            candidatePaths: others,
            query: m.query,
            serpDataByQuery,
            oppByPageQuery,
            clusterMemberQueries,
            queryToPages,
          })
        : [];
      // Semantic coverage — round to 3 dp for stable jsonb digests.
      const topicScore = sectionEmbs.length > 0
        ? Math.round(topicCoverageScore(m.embedding, sectionEmbs) * 1000) / 1000
        : null;
      // Per-query CTR signals. The position-conditional expected uses the
      // shared curve so the LLM sees the same baseline as snippet_ctr-checking
      // logic. SeoOpportunityRow.expected_ctr_pct is also per-position
      // (see run.ts:189) but we recompute defensively in case the source row
      // is from an older sync that used a different curve.
      const expectedAtPos = m.source.position != null
        ? Math.round(expectedCtr(m.source.position) * 10000) / 100
        : null;
      return {
        query: m.query,
        phrase_in_body: m.source.phrase_in_body,
        in_heading: m.source.in_heading,
        topic_coverage_score: topicScore,
        competing_pages: verifiedCompetitors,
        kd: m.source.kd,
        volume: m.source.volume,
        dataforseo_intents: m.source.intents,
        position: m.source.position,
        impressions: m.source.impressions,
        clicks: m.source.clicks,
        ctr_pct: m.source.ctr_pct,
        expected_ctr_pct: expectedAtPos,
      };
    });

    const anchorCandidates: AnchorCandidate[] = c.cluster.members.map((m) => ({
      query: m.query,
      position: m.source.position,
      volume: m.source.volume,
      kd: m.source.kd,
    }));
    const rawAnchors = rankAnchorQueries(anchorCandidates, 5);
    // Annotate each anchor with `external_canonical` if a different HT URL
    // ranks ≤10 in the live SERP for that query. This is the cross-cluster
    // guard — the canonical might be in a totally different cluster, but
    // optimizing this page for that anchor would still cannibalize it.
    const anchors: CoverageAnchor[] = rawAnchors.map((a) => {
      const memberKd = c.cluster.members.find((m) => m.query === a.query)?.source.kd ?? null;
      const memberVol = c.cluster.members.find((m) => m.query === a.query)?.source.volume ?? null;
      const externalCanonical = findExternalCanonical(
        a.query,
        c.page,
        serpDataByQuery,
        memberKd,
        memberVol,
      );
      return externalCanonical
        ? { query: a.query, score: a.score, external_canonical: externalCanonical }
        : { query: a.query, score: a.score };
    });

    // Per-anchor AIO presence + citation check. Anchors without SERP data
    // are simply omitted from the array (vs. emitted with aiOverview:false)
    // so the prompt can distinguish "AIO absent" from "no SERP data."
    const pageUrlKey = pathToSerpUrlKey(c.page);
    const anchorAioPresence = anchors.flatMap((a) => {
      const serp = serpDataByQuery.get(a.query);
      if (!serp) return [];
      const cited = serp.ai_overview_present
        && serp.ai_overview_sources.some((u) => normalizeUrlForMatch(u) === pageUrlKey);
      return [{
        query: a.query,
        aiOverview: serp.ai_overview_present,
        cited,
      }];
    });

    // Cluster-impression share weighted toward anchors with AIO present.
    // Used by the prompt to discount the standard expected-CTR baseline.
    const aioPresentAnchorQueries = new Set(
      anchorAioPresence.filter((a) => a.aiOverview).map((a) => a.query),
    );
    let aioImpressions = 0;
    let totalImpressions = 0;
    for (const m of c.cluster.members) {
      const imp = m.source.impressions ?? 0;
      totalImpressions += imp;
      if (aioPresentAnchorQueries.has(m.query)) aioImpressions += imp;
    }
    const clusterAioImpressionShare = totalImpressions > 0
      ? aioImpressions / totalImpressions
      : 0;

    // Hopeless queries — pos ≥10 members ranked by impressions desc, taken
    // until cumulative share crosses 50% of cluster impressions. The single-
    // dominant-borderline-query case (one query >50% imps at pos ≥10) and
    // the two-queries-at-49%+47% case both fall out naturally.
    const hopelessQueries = computeHopelessQueries(c.cluster.members, totalImpressions);

    // Aggregate external gap signals for this cluster — PAA + related searches
    // unioned across every anchor's live SERP, plus question-shaped variants
    // from the related-keywords API for canonical_query + top 2 anchors.
    // Dedup case-insensitively but preserve first-seen casing for display.
    const gapSignals = aggregateExternalGapSignals({
      page: c.page,
      pageTitle: meta?.title ?? null,
      pageContentType: meta?.contentType ?? "unknown",
      brand: c.cluster.brand,
      retailer: c.cluster.retailer,
      productFamily: c.cluster.product_family,
      canonicalQuery: c.cluster.canonical_query,
      anchorQueries: anchors.map((a) => a.query),
      serpDataByQuery,
      questionsBySeed,
    });

    out.push({
      page: c.page,
      pageTitle: meta?.title ?? null,
      metaDescription: meta?.description ?? null,
      headings: meta?.headings ?? [],
      bodyText: meta?.bodyText ?? "",
      pageContentModifiedAt: meta?.contentModifiedAt ?? null,
      pageContentType: meta?.contentType ?? "unknown",
      pageContentTypeSignals: meta?.contentTypeSignals ?? [],
      outboundInternalLinks: meta?.outboundInternalLinks ?? [],
      clusterLabel: labels[idx]?.label ?? c.cluster.canonical_query,
      canonicalQuery: c.cluster.canonical_query,
      isBranded: c.cluster.is_branded,
      brand: c.cluster.brand,
      retailer: c.cluster.retailer,
      productFamily: c.cluster.product_family,
      dataForSeoIntentPrior: c.aggregates.dataforseo_intent_prior,
      members,
      anchors,
      anchorAioPresence,
      clusterAioImpressionShare,
      hopelessQueries,
      avgPosition: c.aggregates.avg_position,
      weightedCtrPct: c.aggregates.weighted_ctr_pct,
      expectedCtrPct: c.aggregates.expected_ctr_pct,
      paaQuestions: gapSignals.paa,
      relatedSearches: gapSignals.related_searches,
      questionKeywords: gapSignals.question_keywords,
      serpTopOrganic: gapSignals.serp_top_organic,
      internalLinkRecommendations: buildInternalLinkRecommendations({
        currentPage: c.page,
        members,
        anchors,
        pageLinkProfiles,
      }),
    });
  }
  return out;
}

type PageLinkProfile = {
  page: string;
  title: string;
  tokens: Set<string>;
  outbound: Set<string>;
};

const LINK_RECOMMENDATION_GENERIC_TOKENS = new Set([
  "hearing",
  "aid",
  "aids",
  "best",
  "review",
  "reviews",
  "guide",
  "page",
  "tracker",
]);

const GENERIC_ANCHOR_TOKENS = new Set([
  ...LINK_RECOMMENDATION_GENERIC_TOKENS,
  "type",
  "types",
  "price",
  "prices",
  "pricing",
  "cost",
  "costs",
  "compare",
  "comparison",
]);

const BROAD_INTERNAL_LINK_TARGETS = new Set([
  "/hearing-aids",
  "/best-hearing-aids",
  "/how-much-do-hearing-aids-cost",
  "/hearing-aids/compare",
  "/otc-hearing-aids",
  "/prescription-hearing-aids",
]);

function buildPageLinkProfiles(pageMetas: Map<string, PageMeta>): Map<string, PageLinkProfile> {
  const profiles = new Map<string, PageLinkProfile>();
  for (const [page, meta] of pageMetas) {
    const tokens = new Set<string>();
    for (const token of [
      ...meta.titleTokens,
      ...meta.bodyTokens,
      ...tokenize(page.replace(/[/-]/g, " ")),
    ]) {
      if (token.length < 3 || LINK_RECOMMENDATION_GENERIC_TOKENS.has(token)) continue;
      tokens.add(token);
    }
    profiles.set(page, {
      page,
      title: meta.title,
      tokens,
      outbound: new Set((meta.outboundInternalLinks ?? []).map((p) => normalizeHtPath(p)).filter(Boolean) as string[]),
    });
  }
  return profiles;
}

function buildInternalLinkRecommendations(args: {
  currentPage: string;
  members: CoverageMemberSignal[];
  anchors: CoverageAnchor[];
  pageLinkProfiles: Map<string, PageLinkProfile>;
}): InternalLinkRecommendation[] {
  const current = args.pageLinkProfiles.get(args.currentPage);
  const recommendations: InternalLinkRecommendation[] = [];
  const actionableAnchorQueries = args.anchors
    .filter((a) => !a.external_canonical)
    .map((a) => a.query);
  const anchorQueries = actionableAnchorQueries.length > 0
    ? actionableAnchorQueries
    : args.members
        .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
        .map((m) => m.query)
        .slice(0, 3);

  if (current) {
    for (const anchor of args.anchors) {
      if (!anchor.external_canonical) continue;
      const target = normalizeHtPath(anchor.external_canonical.url);
      if (!target || target === args.currentPage || current.outbound.has(target)) continue;
      if (isGenericAnchorText(anchor.query) && !isBroadInternalLinkTarget(target)) continue;
      recommendations.push({
        source_page: args.currentPage,
        target_page: target,
        suggested_anchor_text: anchor.query,
        reason: `A different HearingTracker page ranks top 10 for "${anchor.query}"; link this page toward the canonical instead of double-targeting the query.`,
        confidence: 0.9,
        direction: "from_current_page",
      });
    }
  }

  const targetQueryTokens = new Set(
    anchorQueries.flatMap((q) => tokenize(q))
      .filter((t) => t.length >= 3 && !LINK_RECOMMENDATION_GENERIC_TOKENS.has(t)),
  );
  const bestAnchorText = pickInternalLinkAnchorText(anchorQueries);
  const sourceCandidates: Array<{ profile: PageLinkProfile; overlap: string[] }> = [];
  const targetCandidates: Array<{ profile: PageLinkProfile; overlap: string[] }> = [];

  if (!bestAnchorText || targetQueryTokens.size < 2) {
    return dedupeInternalLinkRecommendations(recommendations)
      .filter(shouldKeepInternalLinkRecommendation)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  for (const profile of args.pageLinkProfiles.values()) {
    if (profile.page === args.currentPage) continue;
    const overlap = [...targetQueryTokens].filter((t) => profile.tokens.has(t));
    if (overlap.length < 2) continue;

    if (!profile.outbound.has(args.currentPage)) {
      sourceCandidates.push({ profile, overlap });
    }
    if (current && !current.outbound.has(profile.page)) {
      targetCandidates.push({ profile, overlap });
    }
  }

  sourceCandidates
    .sort((a, b) => b.overlap.length - a.overlap.length || a.profile.page.length - b.profile.page.length)
    .slice(0, 2)
    .forEach(({ profile, overlap }) => {
      recommendations.push({
        source_page: profile.page,
        target_page: args.currentPage,
        suggested_anchor_text: bestAnchorText,
        reason: `${profile.page} overlaps this cluster on ${overlap.slice(0, 4).join(", ")} and does not currently link to the target page.`,
        confidence: Math.min(0.85, 0.5 + (overlap.length * 0.08)),
        direction: "to_current_page",
      });
    });

  targetCandidates
    .sort((a, b) => b.overlap.length - a.overlap.length || a.profile.page.length - b.profile.page.length)
    .slice(0, 1)
    .forEach(({ profile, overlap }) => {
      const reciprocalMissing = !profile.outbound.has(args.currentPage);
      recommendations.push({
        source_page: args.currentPage,
        target_page: profile.page,
        suggested_anchor_text: bestAnchorText,
        reason: `This page and ${profile.page} share ${overlap.slice(0, 4).join(", ")} topic overlap; add a contextual link${reciprocalMissing ? " and consider the reciprocal path" : ""}.`,
        confidence: Math.min(0.75, 0.46 + (overlap.length * 0.07)),
        direction: reciprocalMissing ? "both" : "from_current_page",
      });
    });

  return dedupeInternalLinkRecommendations(recommendations)
    .filter(shouldKeepInternalLinkRecommendation)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

function pickInternalLinkAnchorText(queries: string[]): string {
  return queries.find((q) => !isGenericAnchorText(q)) ?? "";
}

function isGenericAnchorText(query: string): boolean {
  const tokens = tokenize(query).filter((t) => t.length >= 3);
  if (tokens.length === 0) return true;
  return tokens.every((t) => GENERIC_ANCHOR_TOKENS.has(t));
}

function isBroadInternalLinkTarget(path: string): boolean {
  if (BROAD_INTERNAL_LINK_TARGETS.has(path)) return true;
  return path === "/hearing-aid-insurance-coverage"
    || path.includes("finance")
    || path.includes("medicare")
    || path.includes("otc")
    || path.includes("prescription");
}

function isProductLikeHearingAidPage(path: string): boolean {
  if (!/^\/hearing-aids\/[^/]+$/.test(path)) return false;
  return !isBroadInternalLinkTarget(path);
}

function isBroadGuidePage(path: string): boolean {
  return path === "/best-hearing-aids"
    || path === "/hearing-aids"
    || path.includes("guide")
    || path.includes("best-")
    || path.includes("compare");
}

function shouldKeepInternalLinkRecommendation(rec: InternalLinkRecommendation): boolean {
  if (rec.source_page === rec.target_page) return false;
  if (rec.confidence < 0.75) return false;
  if (isGenericAnchorText(rec.suggested_anchor_text) && !isBroadInternalLinkTarget(rec.target_page)) {
    return false;
  }
  if (
    isBroadGuidePage(rec.source_page)
    && isProductLikeHearingAidPage(rec.target_page)
    && isGenericAnchorText(rec.suggested_anchor_text)
  ) {
    return false;
  }
  return true;
}

function dedupeInternalLinkRecommendations(
  recommendations: InternalLinkRecommendation[],
): InternalLinkRecommendation[] {
  const seen = new Set<string>();
  const out: InternalLinkRecommendation[] = [];
  for (const rec of recommendations) {
    const key = `${rec.source_page}|${rec.target_page}|${rec.suggested_anchor_text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...rec,
      confidence: Math.round(rec.confidence * 100) / 100,
    });
  }
  return out;
}

/**
 * Identify "hopeless" queries — pos ≥10 members that, by impression weight,
 * dominate the cluster's headline CTR-vs-expected gap. The classifier uses
 * this list to forbid snippet_ctr when the apparent gap is structural (no
 * snippet rewrite moves CTR at pos 11 on a head term).
 *
 * Algorithm: sort members by impressions desc. Take those at pos ≥10 in
 * order; stop after the first one whose cumulative impression share crosses
 * 50%. Returns [] when no pos≥10 query (or combination of pos≥10 queries
 * surveyed in impression-rank order) reaches the threshold.
 */
function computeHopelessQueries(
  members: ClusterMember<EmbeddedQuery>[],
  totalImpressions: number,
): CoverageInput["hopelessQueries"] {
  if (totalImpressions <= 0) return [];
  const sorted = members
    .filter((m) => (m.source.impressions ?? 0) > 0 && m.source.position != null)
    .sort((a, b) => (b.source.impressions ?? 0) - (a.source.impressions ?? 0));

  const out: CoverageInput["hopelessQueries"] = [];
  let cumShare = 0;
  for (const m of sorted) {
    const pos = m.source.position!;
    const imp = m.source.impressions ?? 0;
    if (pos < 10) continue;
    const share = imp / totalImpressions;
    out.push({
      query: m.query,
      impressions: imp,
      impression_share: Math.round(share * 1000) / 1000,
      position: Math.round(pos * 10) / 10,
      expected_ctr_at_pos: Math.round(expectedCtr(pos) * 10000) / 10000,
    });
    cumShare += share;
    if (cumShare > 0.5) break;
  }
  return cumShare > 0.5 ? out : [];
}

/**
 * Collapse member-level competing_pages into a `{query: CompetingPage[]}` object
 * for jsonb storage. Each entry now carries `wins` annotations alongside the
 * URL — the dashboard reader (app/(dashboard)/seo/actions.ts) is shape-tolerant
 * so existing rows with the legacy `string[]` shape still render correctly.
 */
function buildCannibalOverlap(members: CoverageMemberSignal[]): Record<string, CompetingPage[]> {
  const out: Record<string, CompetingPage[]> = {};
  for (const m of members) {
    if (m.competing_pages && m.competing_pages.length > 0) {
      out[m.query] = m.competing_pages;
    }
  }
  return out;
}

/**
 * Pre-compute the union of every cluster's deterministic anchor queries so
 * the SERP fetch can cover them in one batched call. This is the same
 * `rankAnchorQueries` set the classifier itself will see per cluster — we
 * just gather them up-front so the SERP cache primes correctly.
 */
function collectAnchorQueries(flatCandidates: PageCandidate[]): string[] {
  const seen = new Set<string>();
  for (const c of flatCandidates) {
    const candidates: AnchorCandidate[] = c.cluster.members.map((m) => ({
      query: m.query,
      position: m.source.position,
      volume: m.source.volume,
      kd: m.source.kd,
    }));
    for (const a of rankAnchorQueries(candidates, 5)) seen.add(a.query);
  }
  return [...seen];
}

// Cap on questions we forward to the classifier per cluster. The prompt
// budget can't fit 100+; 20 is enough to surface a meaningful FAQ-gap list.
const QUESTION_KEYWORD_FORWARD_CAP = 20;

// Per-cluster aggregation of external gap signals. Unions PAA + related
// searches across every anchor's live SERP, joins in question-shaped Labs
// variants for canonical_query + top 2 anchors, and freezes the top-organic
// list of the canonical_query's SERP for the realism block.
type ExternalGapSignals = {
  paa: string[];
  related_searches: string[];
  question_keywords: QuestionKeyword[];
  // Top-organic results for the cluster's canonical_query SERP — drives the
  // SERP context disclosure on the cluster card. Empty array when the SERP
  // didn't cache (e.g. an API failure or a query whose volume kept it out
  // of the anchor set).
  serp_top_organic: Array<{ rank: number; url: string; domain: string }>;
};

const FAQ_MEDICAL_DRIFT_TOKENS = new Set([
  "tinnitus",
  "ringing",
  "muffled",
  "otosclerosis",
  "meniere",
  "meniere's",
  "menieres",
  "vertigo",
  "infection",
  "wax",
  "earwax",
  "sudden",
  "frequency",
  "corrected",
  "correct",
  "enemy",
  "silent",
  "m3",
  "t3",
]);

const FAQ_ENTITY_DRIFT_TOKENS = new Set([
  "amazon",
  "costco",
  "walmart",
  "miracle",
  "miracle-ear",
  "phonak",
  "oticon",
  "widex",
  "signia",
  "resound",
  "starkey",
  "jabra",
  "sony",
  "lexie",
  "eargo",
  "audicus",
  "mdhearing",
  "mdhearingaid",
  "audien",
  "rexton",
  "sennheiser",
]);

const FAQ_AID_TOKENS = new Set(["aid", "aids"]);
const FAQ_GENERIC_CONTEXT_TOKENS = new Set([
  "hearing",
  "aid",
  "aids",
  "best",
  "review",
  "reviews",
  "guide",
  "page",
]);

type FaqCandidateContext = {
  tokens: Set<string>;
  specificTokens: Set<string>;
  pageContentType: PageMeta["contentType"];
};

function buildFaqCandidateContext(args: {
  page: string;
  pageTitle: string | null;
  pageContentType: PageMeta["contentType"];
  brand: string | null;
  retailer: string | null;
  productFamily: string | null;
  canonicalQuery: string;
  anchorQueries: string[];
}): FaqCandidateContext {
  const tokens = new Set<string>();
  for (const value of [
    args.page.replace(/[/-]/g, " "),
    args.pageTitle,
    args.brand,
    args.retailer,
    args.productFamily,
    args.canonicalQuery,
    ...args.anchorQueries,
  ]) {
    for (const token of tokenize(value)) tokens.add(token);
  }
  const specificTokens = new Set(
    [...tokens].filter((token) => !FAQ_GENERIC_CONTEXT_TOKENS.has(token)),
  );
  return { tokens, specificTokens, pageContentType: args.pageContentType };
}

function isRelevantFaqCandidate(question: string, context: FaqCandidateContext): boolean {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return false;

  const medicalDrift = [...qTokens].filter((token) => FAQ_MEDICAL_DRIFT_TOKENS.has(token));
  if (medicalDrift.length > 0 && medicalDrift.every((token) => !context.tokens.has(token))) {
    return false;
  }

  const entityDrift = [...qTokens].filter((token) => FAQ_ENTITY_DRIFT_TOKENS.has(token));
  if (
    entityDrift.length > 0 &&
    entityDrift.every((token) => !context.tokens.has(token)) &&
    context.pageContentType !== "brand_page" &&
    context.pageContentType !== "product_review" &&
    context.pageContentType !== "comparison_page"
  ) {
    return false;
  }

  const hasAidTerm = [...qTokens].some((token) => FAQ_AID_TOKENS.has(token));
  if (hasAidTerm) return true;

  const specificOverlap = [...qTokens]
    .filter((token) => context.specificTokens.has(token))
    .length;
  if (specificOverlap >= 1 && context.specificTokens.size > 0) return true;

  const broadOverlap = [...qTokens]
    .filter((token) => context.tokens.has(token))
    .length;
  return broadOverlap >= 2;
}

function aggregateExternalGapSignals(args: {
  page: string;
  pageTitle: string | null;
  pageContentType: PageMeta["contentType"];
  brand: string | null;
  retailer: string | null;
  productFamily: string | null;
  canonicalQuery: string;
  anchorQueries: string[];
  serpDataByQuery: Map<string, SerpData>;
  questionsBySeed: Map<string, QuestionKeyword[]>;
}): ExternalGapSignals {
  const context = buildFaqCandidateContext(args);
  const paaSeen = new Map<string, string>();   // lowercase → first-seen casing
  const relatedSeen = new Map<string, string>();
  const querySources = new Set<string>([args.canonicalQuery, ...args.anchorQueries]);
  for (const q of querySources) {
    if (!q) continue;
    const serp = args.serpDataByQuery.get(q);
    if (!serp) continue;
    for (const p of serp.paa_questions) {
      const k = p.trim().toLowerCase();
      if (!k || paaSeen.has(k)) continue;
      if (!isRelevantFaqCandidate(p, context)) continue;
      paaSeen.set(k, p);
    }
    for (const r of serp.related_searches) {
      const k = r.trim().toLowerCase();
      if (!k || relatedSeen.has(k)) continue;
      relatedSeen.set(k, r);
    }
  }

  // Question keywords — union across seeds, dedup, prefer higher volume.
  const questionsByQ = new Map<string, QuestionKeyword>();
  for (const seed of querySources) {
    if (!seed) continue;
    const set = args.questionsBySeed.get(seed) ?? [];
    for (const item of set) {
      const k = item.q.trim().toLowerCase();
      if (!k) continue;
      if (!isRelevantFaqCandidate(item.q, context)) continue;
      const existing = questionsByQ.get(k);
      if (!existing) {
        questionsByQ.set(k, item);
        continue;
      }
      // Keep the entry with higher volume (null < 0 < any number).
      const existingVol = existing.volume ?? -1;
      const newVol = item.volume ?? -1;
      if (newVol > existingVol) questionsByQ.set(k, item);
    }
  }
  const questionsList = [...questionsByQ.values()]
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1))
    .slice(0, QUESTION_KEYWORD_FORWARD_CAP);

  // SERP top-organic snapshot for the canonical_query — falls back to the
  // first anchor with cached SERP data so the realism strip still has
  // something to show when canonical_query didn't cache.
  let serpTop: ExternalGapSignals["serp_top_organic"] = [];
  const candidates = [args.canonicalQuery, ...args.anchorQueries];
  for (const q of candidates) {
    const serp = args.serpDataByQuery.get(q);
    if (serp && serp.top_organic.length > 0) {
      serpTop = serp.top_organic.slice(0, 10);
      break;
    }
  }

  return {
    paa: [...paaSeen.values()],
    related_searches: [...relatedSeen.values()],
    question_keywords: questionsList,
    serp_top_organic: serpTop,
  };
}

// Seeds for loadQuestionKeywords — each cluster's canonical_query plus its
// top 2 anchors. Capping at 2 anchors (vs 5 for SERP fetch) keeps the
// fanout reasonable; PAA from the live SERP fills in the per-anchor
// question signal, and Labs related-keywords are most useful at the
// cluster-topic level rather than per striking-distance variant.
function collectQuestionKeywordSeeds(flatCandidates: PageCandidate[]): string[] {
  const seen = new Set<string>();
  for (const c of flatCandidates) {
    if (c.cluster.canonical_query) seen.add(c.cluster.canonical_query);
    const candidates: AnchorCandidate[] = c.cluster.members.map((m) => ({
      query: m.query,
      position: m.source.position,
      volume: m.source.volume,
      kd: m.source.kd,
    }));
    const topAnchors = rankAnchorQueries(candidates, 2);
    for (const a of topAnchors) seen.add(a.query);
  }
  return [...seen].filter(Boolean);
}

/** (page, query) → opportunity row index for fast win-lookup. */
function buildOppByPageQuery(
  opps: SeoOpportunityRow[],
): Map<string, Map<string, SeoOpportunityRow>> {
  const out = new Map<string, Map<string, SeoOpportunityRow>>();
  for (const o of opps) {
    let inner = out.get(o.page);
    if (!inner) { inner = new Map(); out.set(o.page, inner); }
    inner.set(o.query, o);
  }
  return out;
}

/**
 * For an anchor query, find the lowest-position HearingTracker URL in the
 * live SERP that is NOT this cluster's page and ranks ≤10. That URL is the
 * external canonical: optimizing THIS page for this anchor would cannibalize
 * its CTR. Returns undefined when no such URL exists (this page is either
 * the canonical itself, or no HT page is winning the query).
 *
 * Reuses normalizeUrlForMatch so SERP URLs and our www-host paths compare
 * apples-to-apples (no scheme/trailing-slash drift).
 */
function findExternalCanonical(
  query: string,
  currentPage: string,
  serpDataByQuery: Map<string, SerpData>,
  anchorKd: number | null,
  anchorVolume: number | null,
): NonNullable<CoverageAnchor["external_canonical"]> | undefined {
  const serp = serpDataByQuery.get(query);
  if (!serp || serp.top_organic.length === 0) return undefined;
  const currentPageKey = pathToSerpUrlKey(currentPage);
  // top_organic is rank-ascending already, but be defensive — find lowest-rank
  // HT result that isn't this page and is at rank ≤10.
  let best: { url: string; rank: number } | undefined;
  for (const r of serp.top_organic) {
    if (r.rank > 10) continue;
    const key = normalizeUrlForMatch(r.url);
    if (key === currentPageKey) continue;
    // Match HT host only — don't treat external sites as canonicals.
    if (!key.startsWith(SITE_HOSTNAME)) continue;
    if (!best || r.rank < best.rank) {
      best = { url: r.url, rank: r.rank };
    }
  }
  if (!best) return undefined;
  return {
    url: best.url,
    position: best.rank,
    kd: anchorKd,
    volume: anchorVolume,
  };
}

function pathToSerpUrlKey(path: string): string {
  // Paths are stored without the host; reconstruct the canonical full URL so
  // we can compare against DataForSEO's full-URL SERP results.
  const url = path.startsWith("http") ? path : `https://${SITE_HOSTNAME}${path}`;
  return normalizeUrlForMatch(url);
}

function normalizeHtPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith("hearingtracker.com")) return null;
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    if (!trimmed.startsWith("/")) return null;
    return trimmed.split("#")[0].split("?")[0].replace(/\/+$/, "") || "/";
  }
}

/**
 * SERP-verify a list of GSC-flagged competing paths for a single query, then
 * annotate each survivor with the queries it currently wins (best on-site
 * position AND pos ≤ 10) within this cluster's member set.
 *
 * Conservative on missing data: when no SERP is available for the query we
 * drop the cannibalization signal entirely rather than fall back to GSC noise.
 * The earlier shape (paths only, no SERP gate) was the source of false-positive
 * cannibalization that prompted this change.
 */
function verifyCompetingPages(args: {
  candidatePaths: string[];
  query: string;
  serpDataByQuery: Map<string, SerpData>;
  oppByPageQuery: Map<string, Map<string, SeoOpportunityRow>>;
  clusterMemberQueries: string[];
  queryToPages: Map<string, Set<string>>;
}): CompetingPage[] {
  const serp = args.serpDataByQuery.get(args.query);
  if (!serp || serp.top_organic.length === 0) return [];

  const serpUrlKeys = new Set(
    serp.top_organic.map((r) => normalizeUrlForMatch(r.url)),
  );

  const verifiedPaths = args.candidatePaths.filter((p) => {
    // Forum/shop subdomains are stored as full URLs by the GSC sync; the
    // www-only sync produces "/path" entries. Either way, match by SERP URL.
    return serpUrlKeys.has(pathToSerpUrlKey(p));
  });

  return verifiedPaths.map((url) => {
    const wins = computeUrlWinsInCluster({
      url,
      clusterMemberQueries: args.clusterMemberQueries,
      oppByPageQuery: args.oppByPageQuery,
      queryToPages: args.queryToPages,
    });
    return wins.length > 0 ? { url, wins } : { url };
  });
}

/**
 * For a competing URL, find queries WITHIN the current cluster where this URL
 * is the top-ranked HearingTracker page AND ranks at pos ≤ 10. These are the
 * queries the classifier must NOT recommend de-targeting away — the URL is
 * actively winning them.
 */
function computeUrlWinsInCluster(args: {
  url: string;
  clusterMemberQueries: string[];
  oppByPageQuery: Map<string, Map<string, SeoOpportunityRow>>;
  queryToPages: Map<string, Set<string>>;
}): NonNullable<CompetingPage["wins"]> {
  const wins: NonNullable<CompetingPage["wins"]> = [];
  const urlOpps = args.oppByPageQuery.get(args.url);
  if (!urlOpps) return wins;

  for (const q of args.clusterMemberQueries) {
    const compOpp = urlOpps.get(q);
    if (!compOpp || compOpp.position == null || compOpp.position > 10) continue;

    // Confirm this URL has the BEST on-site position for `q`. If a stronger
    // sibling outranks it, the win belongs to the sibling, not this URL.
    const allPages = args.queryToPages.get(q);
    if (!allPages) continue;
    let bestPage: string | null = null;
    let bestPos = Infinity;
    for (const pp of allPages) {
      const pos = args.oppByPageQuery.get(pp)?.get(q)?.position;
      if (pos != null && pos < bestPos) {
        bestPos = pos;
        bestPage = pp;
      }
    }
    if (bestPage !== args.url) continue;

    wins.push({
      query: q,
      position: compOpp.position,
      kd: compOpp.kd,
      volume: compOpp.volume,
    });
  }
  return wins;
}

// Type re-export so `import { meanCentroid } from "@/lib/seo/cluster"` isn't
// the only path to centroid math callers might want.
export { meanCentroid };
