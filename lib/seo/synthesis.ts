// Site-wide SEO strategic synthesis layer.
// ───────────────────────────────────────────────────────────────────────────
// Runs AFTER the per-cluster classifier upserts its frozen verdicts. Reads
// the immutable cluster output + cp_seo_query_findings + cp_seo_serp_cache
// and surfaces cross-page strategic insights the per-cluster classifier
// cannot see because it only ever inspects one (page, cluster) at a time.
//
// All detection is deterministic — no LLM in v1. Each detector is a pure
// function over loaded site state; the orchestrator (`runSiteSynthesis`)
// loads state once, runs all detectors, diffs against the existing
// cp_seo_synthesis_findings rows by (kind, identity_hash), and full-rebuilds
// (insert/update persisting findings, archive findings that drop out).
//
// Thresholds are env-overridable; the actual threshold used at run time is
// recorded in `evidence.thresholds` so retroactive tuning audits work — same
// audit pattern as `coverage_input_digest` on cp_seo_clusters.

import { createHash } from "node:crypto";
import { type SupabaseClient } from "@supabase/supabase-js";
import { AUTHORITY_DOMAIN_SUFFIXES, isAuthorityDomain } from "./authority";
import { detectBrand } from "./brand-map";
import { embedQueries } from "./embed";
import { normalizeUrlForMatch } from "./serp-data";

// ─── Constants ─────────────────────────────────────────────────────────────

const SITE_HOSTNAME = "www.hearingtracker.com";

/**
 * Defaults are tuned for the hearing-aids vertical at HearingTracker. Every
 * threshold is env-overridable; the actual values used are recorded in each
 * finding's `evidence.thresholds` for retro audit.
 */
const DEFAULT_THRESHOLDS = {
  // fully_ceded_page
  fullyCeded_minAnchorCount: numEnv("SEO_SYNTHESIS_FULLY_CEDED_MIN_ANCHORS", 3),
  fullyCeded_cededShareMin: numEnv("SEO_SYNTHESIS_FULLY_CEDED_SHARE_MIN", 0.8),

  // undesignated_topic
  undesignated_minSv: numEnv("SEO_SYNTHESIS_UNDESIGNATED_MIN_SV", 100),
  undesignated_maxKd: numEnv("SEO_SYNTHESIS_UNDESIGNATED_MAX_KD", 60),
  undesignated_minCompetingPages: numEnv("SEO_SYNTHESIS_UNDESIGNATED_MIN_COMPETING", 2),

  // aio_no_citation
  aio_minSv: numEnv("SEO_SYNTHESIS_AIO_MIN_SV", 200),

  // orphan_target
  orphan_minSv: numEnv("SEO_SYNTHESIS_ORPHAN_MIN_SV", 500),
  orphan_minAdjacencyCosine: numEnv("SEO_SYNTHESIS_ORPHAN_MIN_ADJACENCY", 0.55),

  // authority_capped_serp (v2) — 2 of top 5 = 40% authority signal. Tuned
  // for the hearing-aids vertical where Mayo/ConsumerReports/NCOA frequently
  // pair up in top 5 even when only one is "the canonical authority answer."
  authority_minSv: numEnv("SEO_SYNTHESIS_AUTHORITY_MIN_SV", 500),
  authority_topNToCheck: numEnv("SEO_SYNTHESIS_AUTHORITY_TOP_N", 5),
  authority_minDomainCount: numEnv("SEO_SYNTHESIS_AUTHORITY_MIN_DOMAINS", 2),

  // brand_cannibalization (v2) — same shape as undesignated_topic but
  // intentionally lower SV bar (brands are smaller markets).
  brandCannib_minSv: numEnv("SEO_SYNTHESIS_BRAND_CANNIB_MIN_SV", 100),
  brandCannib_minCompetingPages: numEnv("SEO_SYNTHESIS_BRAND_CANNIB_MIN_COMPETING", 2),

  // freshness (v2)
  freshness_maxContentAgeDays: numEnv("SEO_SYNTHESIS_FRESHNESS_MAX_AGE_DAYS", 365),
  freshness_minRankDeltaPositions: numEnv("SEO_SYNTHESIS_FRESHNESS_MIN_RANK_DELTA", 3),
  freshness_rankCompareWindowDays: numEnv("SEO_SYNTHESIS_FRESHNESS_RANK_WINDOW_DAYS", 56),

  // internal_link_gap (v2)
  internalLink_minRank: numEnv("SEO_SYNTHESIS_LINK_GAP_MAX_RANK", 3),
  internalLink_minSv: numEnv("SEO_SYNTHESIS_LINK_GAP_MIN_SV", 1000),
};

// Authority-domain helpers live in lib/seo/authority.ts so the coverage
// classifier can share the same suffix list without depending on synthesis.
// The full list is recorded in each finding's evidence below (see
// `domain_list_snapshot`) so historical findings remain interpretable when
// the list moves.

function numEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type SynthesisKind =
  | "fully_ceded_page"
  | "undesignated_topic"
  | "aio_no_citation"
  | "orphan_target"
  // Phase 1D: blind-spot kinds
  | "authority_capped_serp"
  | "brand_cannibalization"
  | "freshness"
  | "internal_link_gap";

export type SynthesisFinding = {
  kind: SynthesisKind;
  scope_page: string | null;
  scope_query: string | null;
  target_page: string | null;
  score: number;
  evidence: Record<string, unknown>;
  identity_hash: string;
};

export type SynthesisResult = {
  total: number;
  kindCounts: Record<SynthesisKind, number>;
  inserted: number;
  updated: number;
  archived: number;
};

// Loaded site state — built once per run, passed to every detector.
type AnchorExternalCanonicalRow = {
  query: string;
  url: string;
  position: number;
  kd: number | null;
  volume: number | null;
};

type ClusterRow = {
  id: number;
  page: string;
  canonical_query: string;
  current_centroid: number[] | null;
  total_volume: number | null;
  avg_position: number | null;
  is_branded: boolean;
  brand: string | null;
  /**
   * The deterministic top-3-to-5 anchor ranking, persisted as
   * [{query, score}]. Synthesis reads this as the cluster's anchor count
   * for the fully_ceded_page share calculation (ceded / total).
   */
  anchor_queries: Array<{ query: string; score: number }> | null;
  anchor_external_canonicals: AnchorExternalCanonicalRow[] | null;
  /** Per-cluster classifier verdict — used to suppress cross-page duplicates. */
  coverage_kind: string | null;
  /** Member queries (joined from findings during loadSiteState). */
  member_queries: string[];
};

type PageRow = {
  page: string;
  page_title: string | null;
  content_modified_at: string | null;
  outbound_internal_links: string[] | null;
};

type SynthesisPageContentType =
  | "best_list"
  | "brand_page"
  | "product_review"
  | "comparison_page"
  | "price_or_buying_guide"
  | "general_guide"
  | "generic_article"
  | "unknown";

function inferSynthesisPageContentType(page: string, title: string | null): SynthesisPageContentType {
  const text = `${page} ${title ?? ""}`.toLowerCase();
  if (
    page === "/best-hearing-aids"
    || /(^|\/)best[-/]/i.test(page)
    || /\b(best|top)\s+\w*(?:\s+\w+){0,4}\s+hearing aids?\b/i.test(title ?? "")
  ) {
    return "best_list";
  }
  if (/\b(vs|versus|compare|comparison|compared)\b/i.test(title ?? "") || page.includes("/compare") || /-vs-|\/vs\//i.test(page)) {
    return "comparison_page";
  }
  if (/\breviews?\b/i.test(title ?? "") || /\/reviews?\//i.test(page)) {
    return "product_review";
  }
  if (/^\/hearing-aids\/[^/]+$/.test(page)) {
    return "brand_page";
  }
  if (/\b(price|prices|pricing|cost|costs|affordable|cheap|finance|financing|insurance|medicare)\b/i.test(text)) {
    return "price_or_buying_guide";
  }
  if (text.includes("hearing-aids") || /\bhearing aids?\b/i.test(text)) {
    return "general_guide";
  }
  return title ? "generic_article" : "unknown";
}

function hasBestListModifier(query: string): boolean {
  return /\b(best|top|rated|recommended)\b/i.test(query);
}

function hasReviewModifier(query: string): boolean {
  return /\breviews?\b/i.test(query);
}

function hasComparisonModifier(query: string): boolean {
  return /\b(compare|comparison|vs|versus)\b/i.test(query);
}

function isPriceIntentQuery(query: string): boolean {
  return /\b(price|prices|pricing|cost|costs|affordable|cheap|finance|financing|insurance|medicare)\b/i.test(query);
}

function isLocalIntentQuery(query: string): boolean {
  return /\b(near me|nearby|local|location|locations|store|stores|dealer|dealers|clinic|clinics|provider|providers)\b/i.test(query);
}

function scoreQueryPageFit(query: string, page: PageRow | undefined): {
  score: number;
  content_type: SynthesisPageContentType;
  reasons: string[];
} {
  if (!page) {
    return { score: 0.4, content_type: "unknown", reasons: ["page metadata missing"] };
  }

  const contentType = inferSynthesisPageContentType(page.page, page.page_title);
  const haystack = `${page.page} ${page.page_title ?? ""}`.toLowerCase();
  const brand = detectBrand(query);
  const hasBrand = Boolean(brand.brand || brand.product_family || brand.retailer);
  const hasBestModifier = hasBestListModifier(query);
  const hasReview = hasReviewModifier(query);
  const hasComparison = hasComparisonModifier(query);
  const priceIntent = isPriceIntentQuery(query);
  const reasons: string[] = [`content_type:${contentType}`];
  let score = 0.5;

  if (isLocalIntentQuery(query)) {
    return {
      score: 0.05,
      content_type: contentType,
      reasons: [...reasons, "local/provider intent is not an article target"],
    };
  }

  if (hasBrand) {
    const ownerToken = brand.brand ?? brand.product_family ?? brand.retailer ?? "";
    const ownerNeedles = [ownerToken, ownerToken.replace(/-/g, " ")].filter(Boolean);
    if (ownerNeedles.some((needle) => haystack.includes(needle))) {
      score += 0.4;
      reasons.push("brand/page token match");
    } else if (contentType === "brand_page" || contentType === "product_review") {
      score += hasReview ? 0.3 : 0.2;
      reasons.push(hasReview ? "brand review intent fits brand/product page" : "brand/product page type");
    } else if (contentType === "best_list") {
      if (hasBestModifier && !hasReview && !priceIntent) {
        score += 0.05;
        reasons.push("best-list modifier softens brand mismatch");
      } else {
        score -= 0.45;
        reasons.push("exact brand/product intent on best list");
      }
    } else {
      score -= 0.15;
      reasons.push("brand query without brand-owner page fit");
    }
  }

  if (priceIntent) {
    if (contentType === "price_or_buying_guide") {
      score += 0.35;
      reasons.push("price intent matches price guide");
    } else if ((contentType === "brand_page" || contentType === "product_review") && hasBrand) {
      score += 0.15;
      reasons.push("brand price intent can fit brand/product page");
    } else if (contentType === "best_list" && !hasBestModifier) {
      score -= 0.35;
      reasons.push("broad price intent on best list");
    } else {
      score -= 0.1;
      reasons.push("price intent without price-guide fit");
    }
  }

  if (hasBestModifier) {
    if (contentType === "best_list") {
      score += 0.25;
      reasons.push("best-list modifier fits page type");
    }
  }
  if (hasReview) {
    if (contentType === "product_review" || contentType === "brand_page") {
      score += 0.3;
      reasons.push("review modifier fits brand/product page");
    } else if (contentType === "best_list" && hasBrand) {
      score -= 0.2;
      reasons.push("brand review intent does not fit broad best list");
    }
  }
  if (hasComparison) {
    if (contentType === "comparison_page" || contentType === "product_review") {
      score += 0.3;
      reasons.push("comparison modifier fits page type");
    }
  }

  return {
    score: Math.max(0, Math.min(1, Number(score.toFixed(3)))),
    content_type: contentType,
    reasons,
  };
}

type RankHistoryRow = {
  page: string;
  query: string;
  position: number;
  recorded_at: string;
};

type FindingRow = {
  page: string;
  query: string;
  position: number | null;
  kd: number | null;
  volume: number | null;
};

type SerpRow = {
  keyword: string;
  top_organic: Array<{ rank: number; url: string; domain: string }>;
  ai_overview_present: boolean;
  ai_overview_sources: string[];
  fetched_at: string;
};

type SiteState = {
  clusters: ClusterRow[];
  findings: FindingRow[];
  serpByQuery: Map<string, SerpRow>;
  /** All non-archived HT pages — used to look up URL-implied canonicals. */
  pages: string[];
  /** Per-page metadata indexed by `page` path. Phase 1D additions. */
  pagesById: Map<string, PageRow>;
  /**
   * Rank-history snapshots for the trailing 90 days, indexed by (page, query).
   * Inner array sorted ascending by recorded_at so the freshness detector
   * can compute "now vs 8 weeks ago" deltas with a single pass.
   */
  rankHistory: Map<string, RankHistoryRow[]>;
};

// Generic site-wide tokens that should not count as URL-implied canonical
// signals — they appear on most HT URLs and therefore can't disambiguate
// which page is the "right" target for a query. Keep this list small and
// vertical-specific.
const GENERIC_PATH_TOKENS = new Set([
  "hearing",
  "aid",
  "aids",
  "best",
  "top",
  "the",
  "for",
  "and",
  "vs",
  "compare",
]);

/**
 * Tokenize a query and a URL path, then return the non-generic tokens that
 * appear in both. Used to find the URL-implied canonical for a query — e.g.
 * "best otc hearing aids" ↔ "/otc-hearing-aids" matches on "otc".
 */
function urlPathMatchTokens(query: string, page: string): string[] {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !GENERIC_PATH_TOKENS.has(t));
  const queryTokens = new Set(tokenize(query));
  const pathTokens = new Set(tokenize(page));
  const overlap: string[] = [];
  for (const t of queryTokens) {
    if (pathTokens.has(t)) overlap.push(t);
  }
  return overlap;
}

// ─── State loading ─────────────────────────────────────────────────────────

async function loadSiteState(supabase: SupabaseClient): Promise<SiteState> {
  // Open clusters only — archived clusters are stale signals.
  const { data: clusters, error: clusterErr } = await supabase
    .from("cp_seo_clusters")
    .select(
      "id, page, canonical_query, current_centroid, total_volume, avg_position, is_branded, brand, anchor_queries, anchor_external_canonicals, coverage_kind",
    )
    .is("archived_at", null);
  if (clusterErr) throw new Error(`load clusters: ${clusterErr.message}`);

  // Findings rows scoped to non-archived clusters. We pull broadly and then
  // index in-memory; per-detector filtering happens after.
  const { data: findings, error: findingsErr } = await supabase
    .from("cp_seo_query_findings")
    .select("cluster_id, page, query, position, kd, volume")
    .is("archived_at", null);
  if (findingsErr) throw new Error(`load findings: ${findingsErr.message}`);

  // SERP cache — small (one row per anchor query, ~thousands max).
  const { data: serps, error: serpErr } = await supabase
    .from("cp_seo_serp_cache")
    .select("keyword, top_organic, ai_overview_present, ai_overview_sources, fetched_at");
  if (serpErr) throw new Error(`load serps: ${serpErr.message}`);

  // Page inventory for URL-implied canonical detection in undesignated_topic
  // and Phase 1D fields for freshness / internal_link_gap.
  const { data: pages, error: pagesErr } = await supabase
    .from("cp_seo_pages")
    .select("page, page_title, content_modified_at, outbound_internal_links");
  if (pagesErr) throw new Error(`load pages: ${pagesErr.message}`);

  // Rank history for the freshness detector's rank-decline signal. Pull
  // rows from the trailing 90 days only (matches retention) — older rows
  // shouldn't exist but the constraint keeps memory bounded if retention
  // ever lapses. Synthesizer runs after rank_snapshot, so today's snapshot
  // is included here.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rankRows, error: rankErr } = await supabase
    .from("cp_seo_rank_history")
    .select("page, query, position, recorded_at")
    .gte("recorded_at", ninetyDaysAgo)
    .order("recorded_at", { ascending: true });
  if (rankErr) throw new Error(`load rank history: ${rankErr.message}`);

  const serpByQuery = new Map<string, SerpRow>(
    (serps ?? []).map((r) => [r.keyword as string, r as SerpRow]),
  );

  // Index member queries by cluster_id so each cluster row carries its own
  // member set without a separate join. Used by the aio_no_citation
  // suppression check (does this cluster's classifier already own the query?).
  type RawFinding = { cluster_id: number | null; page: string; query: string; position: number | null; kd: number | null; volume: number | null };
  const findingRows = (findings ?? []) as RawFinding[];
  const queriesByClusterId = new Map<number, string[]>();
  for (const f of findingRows) {
    if (f.cluster_id == null) continue;
    const list = queriesByClusterId.get(f.cluster_id) ?? [];
    list.push(f.query);
    queriesByClusterId.set(f.cluster_id, list);
  }

  // Postgres returns vector(1536) as a JSON-encoded string like "[0.1,0.2,...]"
  // when read through PostgREST. Parse defensively so we don't blow up on
  // clusters that haven't been re-embedded yet (legacy rows).
  const parsedClusters: ClusterRow[] = (clusters ?? []).map((c) => ({
    id: c.id as number,
    page: c.page as string,
    canonical_query: c.canonical_query as string,
    current_centroid: parseVector(c.current_centroid),
    total_volume: c.total_volume as number | null,
    avg_position: c.avg_position as number | null,
    is_branded: Boolean(c.is_branded),
    brand: c.brand as string | null,
    anchor_queries: c.anchor_queries as
      | Array<{ query: string; score: number }>
      | null,
    anchor_external_canonicals: c.anchor_external_canonicals as
      | AnchorExternalCanonicalRow[]
      | null,
    coverage_kind: c.coverage_kind as string | null,
    member_queries: queriesByClusterId.get(c.id as number) ?? [],
  }));

  type RawPageRow = {
    page: string;
    page_title: string | null;
    content_modified_at: string | null;
    outbound_internal_links: unknown;
  };
  const pageRows = ((pages ?? []) as RawPageRow[]).map<PageRow>((p) => ({
    page: p.page,
    page_title: p.page_title,
    content_modified_at: p.content_modified_at,
    outbound_internal_links: Array.isArray(p.outbound_internal_links)
      ? (p.outbound_internal_links as string[])
      : null,
  }));
  const pagesById = new Map<string, PageRow>(pageRows.map((p) => [p.page, p]));

  // Rank history is already ordered ASC by recorded_at; bucket into a
  // (page|query) → snapshots[] map for O(1) lookup in the freshness detector.
  const rankHistory = new Map<string, RankHistoryRow[]>();
  for (const r of (rankRows ?? []) as RankHistoryRow[]) {
    const key = `${r.page}|${r.query}`;
    const list = rankHistory.get(key) ?? [];
    list.push(r);
    rankHistory.set(key, list);
  }

  return {
    clusters: parsedClusters,
    findings: findingRows.map(({ page, query, position, kd, volume }) => ({
      page,
      query,
      position,
      kd,
      volume,
    })),
    serpByQuery,
    pages: pageRows.map((p) => p.page),
    pagesById,
    rankHistory,
  };
}

function parseVector(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isHtUrl(url: string): boolean {
  return normalizeUrlForMatch(url).startsWith(SITE_HOSTNAME);
}

function htInTop10(serp: SerpRow): boolean {
  return serp.top_organic.some((r) => r.rank <= 10 && isHtUrl(r.url));
}

function htInTop30(serp: SerpRow): boolean {
  return serp.top_organic.some((r) => r.rank <= 30 && isHtUrl(r.url));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na > 0 && nb > 0 ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ─── Detectors ─────────────────────────────────────────────────────────────

/**
 * Pages where most anchors across the page's clusters are won by a different
 * HearingTracker URL ranking ≤10. Question for the editor: should this page
 * exist at all, or be redirected/consolidated?
 *
 * Two gates:
 *   1. Absolute count — at least N ceded anchors (else not enough signal).
 *   2. Share — ceded_count / total_anchor_count ≥ share threshold (else
 *      the page has plenty of unceded anchors of its own to optimize for).
 *
 * Without the share gate this fires on healthy revenue pages that happen
 * to share a few anchors with a stronger sibling — which is the exact
 * "false positive on the top-revenue page" problem we hit in the first
 * deploy of this layer. Total anchor count comes from cp_seo_clusters.anchor_queries
 * (the deterministic ranking, ~3-5 per cluster), summed across the page's
 * clusters. The denominator we care about is "anchors the page is currently
 * trying to optimize for" — anchor_queries is exactly that surface.
 *
 * Hub-prefix exemption: when every canonical URL shares the page's path
 * prefix (e.g. /hearing-aids → canonicals all start with /hearing-aids/),
 * the page is a parent hub by design — not a redundancy.
 */
export function detectFullyCededPages(
  state: SiteState,
  thresholds = DEFAULT_THRESHOLDS,
): SynthesisFinding[] {
  const byPage = new Map<string, ClusterRow[]>();
  for (const c of state.clusters) {
    const list = byPage.get(c.page) ?? [];
    list.push(c);
    byPage.set(c.page, list);
  }

  const findings: SynthesisFinding[] = [];
  for (const [page, clusters] of byPage) {
    const allCanonicals: AnchorExternalCanonicalRow[] = [];
    let totalAnchorCount = 0;
    for (const c of clusters) {
      const anchors = c.anchor_queries ?? [];
      totalAnchorCount += anchors.length;
      for (const a of c.anchor_external_canonicals ?? []) {
        allCanonicals.push(a);
      }
    }

    const cededCount = allCanonicals.length;
    if (cededCount < thresholds.fullyCeded_minAnchorCount) continue;

    // Without anchor_queries data we can't compute a share — be conservative
    // and skip rather than fall back to "ceded count alone". (Pre-Phase 1C
    // synced clusters won't have anchor_queries yet.)
    if (totalAnchorCount === 0) continue;

    const cededShare = cededCount / totalAnchorCount;
    if (cededShare < thresholds.fullyCeded_cededShareMin) continue;

    // Hub check: are all canonicals deeper paths under this page?
    const pagePrefix = page.endsWith("/") ? page : `${page}/`;
    const allUnderPrefix = allCanonicals.every((a) => {
      try {
        const u = new URL(a.url);
        return u.pathname.startsWith(pagePrefix);
      } catch {
        return false;
      }
    });
    if (allUnderPrefix) continue;

    const totalVolume = allCanonicals.reduce(
      (sum, a) => sum + (a.volume ?? 0),
      0,
    );

    findings.push({
      kind: "fully_ceded_page",
      scope_page: page,
      scope_query: null,
      target_page: null,
      score: totalVolume,
      evidence: {
        ceded_anchor_count: cededCount,
        total_anchor_count: totalAnchorCount,
        ceded_share: Number(cededShare.toFixed(3)),
        canonicals: allCanonicals.slice(0, 20),
        cluster_ids: clusters.map((c) => c.id),
        thresholds: {
          min_anchors: thresholds.fullyCeded_minAnchorCount,
          ceded_share_min: thresholds.fullyCeded_cededShareMin,
        },
        score_rationale: "sum of search volume across ceded anchors",
      },
      identity_hash: hash(`fully_ceded_page|${page}`),
    });
  }
  return findings;
}

/**
 * Queries where ≥2 HearingTracker pages rank in positions 11–30 and no HT
 * URL is in the top 10. Multiple pages competing for the same query without
 * a clear winner — designate one. The per-cluster classifier sees only one
 * cluster at a time and can't make this call when the strongest sibling is
 * in a totally different cluster on a different page.
 *
 * Winner selection prefers URL-IMPLIED CANONICALS over current rank: if a
 * page exists whose path contains a non-generic token from the query (e.g.
 * "best otc hearing aids" ↔ "/otc-hearing-aids" via "otc"), pick it as the
 * winner even if it doesn't currently rank — that's the strategic move,
 * not the tactical one. Fall back to lowest-position competitor when no
 * URL match exists. Both candidates are recorded in evidence so the editor
 * can see the choice.
 */
export function detectUndesignatedTopics(
  state: SiteState,
  thresholds = DEFAULT_THRESHOLDS,
): SynthesisFinding[] {
  // Group findings by query.
  const byQuery = new Map<string, FindingRow[]>();
  for (const f of state.findings) {
    if (f.position == null) continue;
    const list = byQuery.get(f.query) ?? [];
    list.push(f);
    byQuery.set(f.query, list);
  }

  const findings: SynthesisFinding[] = [];
  for (const [query, rows] of byQuery) {
    const serp = state.serpByQuery.get(query);
    // Without SERP data we can't verify "no HT in top 10" — drop the signal
    // rather than risk a false positive on a stale ranking.
    if (!serp) continue;
    if (htInTop10(serp)) continue;

    // Dedup competing pages by page (best position per page).
    const bestByPage = new Map<string, FindingRow>();
    for (const r of rows) {
      const pos = r.position!;
      if (pos < 11 || pos > 30) continue;
      const cur = bestByPage.get(r.page);
      if (!cur || pos < (cur.position ?? Infinity)) bestByPage.set(r.page, r);
    }
    if (bestByPage.size < thresholds.undesignated_minCompetingPages) continue;

    const sv = Math.max(...rows.map((r) => r.volume ?? 0));
    const kdNum = Math.min(
      ...rows.map((r) => r.kd ?? 100).filter((k) => Number.isFinite(k)),
    );
    if (sv < thresholds.undesignated_minSv) continue;
    if (kdNum > thresholds.undesignated_maxKd) continue;

    const competingPages = [...bestByPage.values()].sort(
      (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity),
    );
    const lowestPositionWinner = competingPages[0].page;

    // Look across the WHOLE page inventory (not just current ranking pages)
    // for a URL-implied canonical. The strategic winner might be a page that
    // doesn't yet rank for the query — that's the lever.
    const urlMatches = state.pages
      .map((p) => ({ page: p, tokens: urlPathMatchTokens(query, p) }))
      .filter((m) => m.tokens.length > 0)
      // Prefer the most specific match (highest token count, then shortest path).
      .sort((a, b) => b.tokens.length - a.tokens.length || a.page.length - b.page.length);

    const urlImpliedWinner = urlMatches[0]?.page ?? null;
    const winner = urlImpliedWinner ?? lowestPositionWinner;
    const winnerSource = urlImpliedWinner ? "url_implied_canonical" : "lowest_position";

    findings.push({
      kind: "undesignated_topic",
      scope_page: null,
      scope_query: query,
      target_page: winner,
      score: sv * (1 - kdNum / 100),
      evidence: {
        sv,
        kd: kdNum,
        winning_candidate: winner,
        winner_source: winnerSource,
        url_implied_winner: urlImpliedWinner,
        url_match_tokens: urlMatches[0]?.tokens ?? [],
        lowest_position_winner: lowestPositionWinner,
        lowest_position: competingPages[0].position,
        competing_pages: competingPages.map((c) => ({
          page: c.page,
          best_pos: c.position,
        })),
        serp_top_3: serp.top_organic.slice(0, 3).map((r) => ({
          rank: r.rank,
          url: r.url,
        })),
        serp_fetched_at: serp.fetched_at,
        thresholds: {
          min_sv: thresholds.undesignated_minSv,
          max_kd: thresholds.undesignated_maxKd,
          min_competing_pages: thresholds.undesignated_minCompetingPages,
        },
        score_rationale: "sv × (1 − kd/100)",
      },
      identity_hash: hash(`undesignated_topic|${query}`),
    });
  }
  return findings;
}

/**
 * Queries with an AI Overview present where no HearingTracker URL is cited
 * in the AIO source list AND ≥1 HT page ranks for the query (i.e. we have a
 * shot — pure orphan AIOs flow to orphan_target instead). The lever here
 * is passage-level GEO: rewrite for AIO-citation patterns.
 *
 * Suppress when the per-cluster classifier already owns the verdict: if a
 * cluster on the target page has coverage_kind='ai_overview_loss' and lists
 * this query as a member, the cluster card already surfaces the same lever
 * with richer prose. Cross-page synthesis should not re-stack the signal.
 */
export function detectAioNoCitation(
  state: SiteState,
  thresholds = DEFAULT_THRESHOLDS,
): SynthesisFinding[] {
  // Group findings by query for "does HT rank somewhere" check.
  const findingsByQuery = new Map<string, FindingRow[]>();
  for (const f of state.findings) {
    const list = findingsByQuery.get(f.query) ?? [];
    list.push(f);
    findingsByQuery.set(f.query, list);
  }

  // Index of (page, query) → "is owned by an active ai_overview_loss cluster
  // on that page". Used to suppress redundant findings (the cluster card on
  // the target page already says the same thing).
  const aioLossOwned = new Set<string>();
  for (const c of state.clusters) {
    if (c.coverage_kind !== "ai_overview_loss") continue;
    for (const q of c.member_queries) {
      aioLossOwned.add(`${c.page}|${q}`);
    }
  }

  const findings: SynthesisFinding[] = [];
  for (const [query, serp] of state.serpByQuery) {
    if (!serp.ai_overview_present) continue;
    const cited = serp.ai_overview_sources.some(isHtUrl);
    if (cited) continue;

    const htRankings = findingsByQuery.get(query) ?? [];
    if (htRankings.length === 0) continue; // pure orphan → handled by orphan_target

    const sv = Math.max(...htRankings.map((r) => r.volume ?? 0));
    if (sv < thresholds.aio_minSv) continue;

    // Pick the best page-type fit first, then current rank. This avoids
    // sending exact brand/product or price AIO gaps to a broad best list just
    // because it happens to rank above the canonical page.
    const rankedTargets = htRankings
      .filter((r) => r.position != null)
      .map((r) => ({
        row: r,
        fit: scoreQueryPageFit(query, state.pagesById.get(r.page)),
      }))
      .sort((a, b) => {
        if (b.fit.score !== a.fit.score) return b.fit.score - a.fit.score;
        return (a.row.position ?? Infinity) - (b.row.position ?? Infinity);
      });
    const best = rankedTargets[0]?.row ?? null;
    const bestFit = rankedTargets[0]?.fit ?? null;

    if (bestFit && bestFit.score < 0.35) continue;

    // Suppress when the target page's cluster already owns this query under
    // the per-cluster ai_overview_loss verdict.
    if (best && aioLossOwned.has(`${best.page}|${query}`)) continue;

    findings.push({
      kind: "aio_no_citation",
      scope_page: null,
      scope_query: query,
      target_page: best?.page ?? null,
      score: sv,
      evidence: {
        sv,
        ht_rankings: htRankings.map((r) => ({
          page: r.page,
          position: r.position,
          target_fit: scoreQueryPageFit(query, state.pagesById.get(r.page)),
        })),
        selected_target_fit: bestFit,
        aio_source_count: serp.ai_overview_sources.length,
        aio_source_sample: serp.ai_overview_sources.slice(0, 5),
        serp_fetched_at: serp.fetched_at,
        thresholds: { min_sv: thresholds.aio_minSv },
        score_rationale: "search volume",
      },
      identity_hash: hash(`aio_no_citation|${query}`),
    });
  }
  return findings;
}

/**
 * Topically adjacent queries with high SV where no HT URL ranks in top 30.
 * The per-cluster classifier never sees this — the canonical example is
 * "over the counter hearing aids" being an offensive lever to fix
 * /otc-hearing-aids, not an action on /best-hearing-aids.
 *
 * Adjacency uses cluster current_centroid embeddings: we embed candidate
 * queries on-the-fly and pick the cluster with max cosine similarity. If
 * max cosine ≥ threshold, the query is adjacent and the owning page is
 * the recommended target.
 */
export async function detectOrphanTargets(
  state: SiteState,
  thresholds = DEFAULT_THRESHOLDS,
): Promise<SynthesisFinding[]> {
  // Candidates: SERP-cache queries where no HT URL ranks in top 30 AND HT
  // does not appear in cp_seo_query_findings for the query at all.
  const findingsQueries = new Set(state.findings.map((f) => f.query));

  const candidates: { query: string; sv: number; kd: number | null; serp: SerpRow }[] = [];
  for (const [query, serp] of state.serpByQuery) {
    if (htInTop30(serp)) continue;
    if (findingsQueries.has(query)) continue;
    // SV/KD are not on the SERP cache; pull from any cluster anchor that
    // referenced this query during sync. As a simpler fallback for v1,
    // skip SV/KD gating here and gate purely on adjacency + presence.
    // The score will use 1.0 SV factor when missing. Tunable later by
    // joining cp_seo_keyword_cache once that table lands.
    candidates.push({ query, sv: 0, kd: null, serp });
  }

  if (candidates.length === 0) return [];

  // Embed candidate queries on the fly. Cap the candidate set defensively
  // — in practice it should be O(hundreds) at most because the SERP cache
  // is bounded by anchor + multi-page candidates.
  const MAX_EMBED = 1000;
  const toEmbed = candidates.slice(0, MAX_EMBED);
  const embedResult = await embedQueries(toEmbed.map((c) => c.query));
  const embeddingByQuery = new Map<string, number[]>();
  for (let i = 0; i < toEmbed.length; i++) {
    embeddingByQuery.set(toEmbed[i].query, embedResult.embeddings[i]);
  }

  // For each candidate, find the most-similar cluster centroid.
  const clustersWithCentroids = state.clusters.filter(
    (c) => c.current_centroid != null && c.current_centroid.length > 0,
  );

  const findings: SynthesisFinding[] = [];
  for (const cand of toEmbed) {
    if (isLocalIntentQuery(cand.query)) continue;

    const emb = embeddingByQuery.get(cand.query);
    if (!emb) continue;

    let best: {
      cluster: ClusterRow;
      cosine: number;
      targetFit: ReturnType<typeof scoreQueryPageFit>;
      combined: number;
    } | null = null;
    for (const cl of clustersWithCentroids) {
      const sim = cosine(emb, cl.current_centroid!);
      if (sim < thresholds.orphan_minAdjacencyCosine) continue;
      const targetFit = scoreQueryPageFit(cand.query, state.pagesById.get(cl.page));
      if (targetFit.score < 0.35) continue;
      const combined = sim * targetFit.score;
      if (!best || combined > best.combined) {
        best = { cluster: cl, cosine: sim, targetFit, combined };
      }
    }
    if (!best) continue;

    const sv = cand.sv;
    if (sv > 0 && sv < thresholds.orphan_minSv) continue;

    const score = sv > 0
      ? sv * (1 - (cand.kd ?? 50) / 100) * best.cosine
      : best.cosine; // fall back to adjacency-only ranking when SV missing

    findings.push({
      kind: "orphan_target",
      scope_page: null,
      scope_query: cand.query,
      target_page: best.cluster.page,
      score,
      evidence: {
        sv,
        kd: cand.kd,
        adjacency_cosine: Number(best.cosine.toFixed(4)),
        adjacent_cluster_id: best.cluster.id,
        adjacent_cluster_page: best.cluster.page,
        adjacent_cluster_query: best.cluster.canonical_query,
        selected_target_fit: best.targetFit,
        serp_top_3: cand.serp.top_organic.slice(0, 3).map((r) => ({
          rank: r.rank,
          url: r.url,
        })),
        serp_fetched_at: cand.serp.fetched_at,
        thresholds: {
          min_sv: thresholds.orphan_minSv,
          min_adjacency_cosine: thresholds.orphan_minAdjacencyCosine,
        },
        score_rationale: "sv × (1 − kd/100) × adjacency_cosine (or adjacency alone when SV unknown)",
      },
      identity_hash: hash(`orphan_target|${cand.query}`),
    });
  }
  return findings;
}

// ─── Phase 1D detectors ────────────────────────────────────────────────────

/**
 * SERPs where the top 5 organic results are dominated by curated authority
 * domains (.gov / .edu / Mayo / NIH / Forbes / etc). Rank ceiling on these
 * queries is link authority, not on-page anything — recommending
 * `snippet_ctr` or `aio_no_citation` here is wrong-leveled advice.
 *
 * Emits one finding per query. Also stamps `is_authority_capped=true` on
 * any v1 finding (aio_no_citation, undesignated_topic) for the same query
 * during the orchestrator's annotation pass below.
 */
export function detectAuthorityCappedSerps(
  state: SiteState,
  thresholds = DEFAULT_THRESHOLDS,
): SynthesisFinding[] {
  // Index findings by query so we can look up the best-ranking HT page (if any)
  // as the target — a soft "if you wanted to push at all, push from here."
  const findingsByQuery = new Map<string, FindingRow[]>();
  for (const f of state.findings) {
    const list = findingsByQuery.get(f.query) ?? [];
    list.push(f);
    findingsByQuery.set(f.query, list);
  }

  const findings: SynthesisFinding[] = [];
  for (const [query, serp] of state.serpByQuery) {
    if (serp.top_organic.length === 0) continue;
    const topN = serp.top_organic
      .filter((r) => r.rank <= thresholds.authority_topNToCheck)
      .map((r) => r.domain);
    const authorityCount = topN.filter(isAuthorityDomain).length;
    if (authorityCount < thresholds.authority_minDomainCount) continue;

    const htRankings = (findingsByQuery.get(query) ?? []).filter((r) => r.position != null);
    const sv = htRankings.length > 0
      ? Math.max(...htRankings.map((r) => r.volume ?? 0))
      : 0;
    if (sv > 0 && sv < thresholds.authority_minSv) continue;

    const rankedTargets = htRankings
      .map((r) => ({
        row: r,
        fit: scoreQueryPageFit(query, state.pagesById.get(r.page)),
      }))
      .filter((r) => r.fit.score >= 0.35)
      .sort((a, b) => {
        if (b.fit.score !== a.fit.score) return b.fit.score - a.fit.score;
        return (a.row.position ?? Infinity) - (b.row.position ?? Infinity);
      });
    const best = rankedTargets[0]?.row ?? null;
    const bestFit = rankedTargets[0]?.fit ?? null;
    if (htRankings.length > 0 && !best) continue;

    findings.push({
      kind: "authority_capped_serp",
      scope_page: null,
      scope_query: query,
      target_page: best?.page ?? null,
      score: sv,
      evidence: {
        sv,
        authority_domain_count: authorityCount,
        authority_domains_in_top: topN.filter(isAuthorityDomain),
        top_n_checked: thresholds.authority_topNToCheck,
        ht_best_position: best?.position ?? null,
        ht_best_page: best?.page ?? null,
        selected_target_fit: bestFit,
        domain_list_snapshot: AUTHORITY_DOMAIN_SUFFIXES,
        serp_fetched_at: serp.fetched_at,
        thresholds: {
          min_sv: thresholds.authority_minSv,
          top_n: thresholds.authority_topNToCheck,
          min_domain_count: thresholds.authority_minDomainCount,
        },
        score_rationale: "search volume (rank ceiling is structural; not actionable)",
      },
      identity_hash: hash(`authority_capped_serp|${query}`),
    });
  }
  return findings;
}

/**
 * Branded queries where multiple HT pages compete and no HT URL owns top
 * 10. Different from `undesignated_topic` because the ANSWER is usually
 * clear — the brand-specific page (path contains the brand token) should
 * win. We surface it as its own kind so editors can prioritize brand
 * cleanup separately, and so the dashboard tone (rose) signals "fix this."
 *
 * Brand detection: cluster.is_branded=true AND cluster.brand non-null.
 */
export function detectBrandCannibalization(
  state: SiteState,
  thresholds = DEFAULT_THRESHOLDS,
): SynthesisFinding[] {
  // Build brand → query set from clusters. Each branded cluster contributes
  // its member queries to the brand's query universe.
  type BrandIndex = { brand: string; queries: Set<string> };
  const brandsByQuery = new Map<string, BrandIndex>();
  for (const c of state.clusters) {
    if (!c.is_branded || !c.brand) continue;
    for (const q of c.member_queries) {
      // First-seen-wins: brand assignment is per-query for matching purposes.
      if (!brandsByQuery.has(q)) {
        brandsByQuery.set(q, { brand: c.brand, queries: new Set() });
      }
      brandsByQuery.get(q)!.queries.add(q);
    }
  }

  // Group findings by query (same shape as undesignated_topic).
  const byQuery = new Map<string, FindingRow[]>();
  for (const f of state.findings) {
    if (f.position == null) continue;
    const list = byQuery.get(f.query) ?? [];
    list.push(f);
    byQuery.set(f.query, list);
  }

  const findings: SynthesisFinding[] = [];
  for (const [query, rows] of byQuery) {
    const brandHit = brandsByQuery.get(query);
    if (!brandHit) continue;

    const serp = state.serpByQuery.get(query);
    if (!serp) continue;
    if (htInTop10(serp)) continue;

    const bestByPage = new Map<string, FindingRow>();
    for (const r of rows) {
      const pos = r.position!;
      if (pos < 11 || pos > 30) continue;
      const cur = bestByPage.get(r.page);
      if (!cur || pos < (cur.position ?? Infinity)) bestByPage.set(r.page, r);
    }
    if (bestByPage.size < thresholds.brandCannib_minCompetingPages) continue;

    const sv = Math.max(...rows.map((r) => r.volume ?? 0));
    if (sv < thresholds.brandCannib_minSv) continue;

    const competingPages = [...bestByPage.values()].sort(
      (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity),
    );

    // Brand-specific URL preference: prefer pages whose path contains the
    // brand token (e.g. "phonak" → /hearing-aids/phonak). Fall back to
    // URL-implied canonical, then lowest-position.
    const brandToken = brandHit.brand.toLowerCase();
    const brandPathMatches = state.pages.filter((p) => p.toLowerCase().includes(brandToken));
    const brandPathOnly = brandPathMatches[0] ?? null;
    const urlMatches = state.pages
      .map((p) => ({ page: p, tokens: urlPathMatchTokens(query, p) }))
      .filter((m) => m.tokens.length > 0)
      .sort((a, b) => b.tokens.length - a.tokens.length || a.page.length - b.page.length);
    const urlImpliedWinner = urlMatches[0]?.page ?? null;
    const winner = brandPathOnly ?? urlImpliedWinner ?? competingPages[0].page;
    const winnerSource = brandPathOnly
      ? "brand_path_match"
      : urlImpliedWinner
        ? "url_implied_canonical"
        : "lowest_position";

    const kdNum = Math.min(
      ...rows.map((r) => r.kd ?? 100).filter((k) => Number.isFinite(k)),
    );

    findings.push({
      kind: "brand_cannibalization",
      scope_page: null,
      scope_query: query,
      target_page: winner,
      score: sv * (1 - kdNum / 100),
      evidence: {
        sv,
        kd: kdNum,
        brand: brandHit.brand,
        winning_candidate: winner,
        winner_source: winnerSource,
        brand_path_match: brandPathOnly,
        url_implied_winner: urlImpliedWinner,
        competing_pages: competingPages.map((c) => ({
          page: c.page,
          best_pos: c.position,
        })),
        serp_top_3: serp.top_organic.slice(0, 3).map((r) => ({ rank: r.rank, url: r.url })),
        serp_fetched_at: serp.fetched_at,
        thresholds: {
          min_sv: thresholds.brandCannib_minSv,
          min_competing_pages: thresholds.brandCannib_minCompetingPages,
        },
        score_rationale: "sv × (1 − kd/100)",
      },
      identity_hash: hash(`brand_cannibalization|${query}`),
    });
  }
  return findings;
}

/**
 * Stale-content pages. Three independent signals fire findings; the
 * evidence records which signal(s) matched so editors can prioritize:
 *   (a) `year_in_title` — title contains a year-stamp older than the
 *       current year, AFTER a freshness-signaling word (Best/Top/Updated/in).
 *       Skipped when title contains "history" or "timeline" (evergreen).
 *   (b) `content_age` — page's content_modified_at > N days ago AND the
 *       page has ≥1 cluster ranking pos 4–15 (declining-rank zone).
 *   (c) `rank_decline` — ≥1 cluster's avg_position has dropped ≥N places
 *       over the trailing window per cp_seo_rank_history.
 */
export function detectFreshness(
  state: SiteState,
  thresholds = DEFAULT_THRESHOLDS,
): SynthesisFinding[] {
  const now = Date.now();
  const currentYear = new Date(now).getUTCFullYear();
  const ageThresholdMs = thresholds.freshness_maxContentAgeDays * 24 * 60 * 60 * 1000;
  const windowAgoMs = thresholds.freshness_rankCompareWindowDays * 24 * 60 * 60 * 1000;
  const windowAgoTs = now - windowAgoMs;

  // Group clusters by page.
  const clustersByPage = new Map<string, ClusterRow[]>();
  for (const c of state.clusters) {
    const list = clustersByPage.get(c.page) ?? [];
    list.push(c);
    clustersByPage.set(c.page, list);
  }

  const findings: SynthesisFinding[] = [];
  for (const [page, clusters] of clustersByPage) {
    const meta = state.pagesById.get(page);
    if (!meta) continue;
    const signals: string[] = [];
    const evidenceParts: Record<string, unknown> = {};

    // Signal (a): year-in-title. Only the most-recent year that's BEFORE
    // current year matters — "Best Hearing Aids in 2024 (Updated 2025)"
    // contains both "2024" and "2025"; we look at the latest one.
    if (meta.page_title) {
      const title = meta.page_title;
      const isEvergreen = /\b(history|timeline)\b/i.test(title);
      if (!isEvergreen) {
        const yearMatches = [...title.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
        const latestYear = yearMatches.length > 0 ? Math.max(...yearMatches) : null;
        if (latestYear != null && latestYear < currentYear) {
          // Confirm a freshness-signaling word precedes the year so we don't
          // flag titles like "Hearing Aids: A 2023 Lawsuit" as stale.
          const hasSignal = /(best|top|updated|in|review of|guide to)\s+[^]*\b20\d{2}\b/i.test(title);
          if (hasSignal) {
            signals.push("year_in_title");
            evidenceParts.year_in_title = {
              title,
              detected_year: latestYear,
              current_year: currentYear,
            };
          }
        }
      }
    }

    // Signal (b): content age + declining-rank-zone cluster.
    if (meta.content_modified_at) {
      const modifiedTs = new Date(meta.content_modified_at).getTime();
      if (Number.isFinite(modifiedTs)) {
        const ageMs = now - modifiedTs;
        if (ageMs > ageThresholdMs) {
          const inDeclineZone = clusters.some((c) =>
            c.avg_position != null && c.avg_position >= 4 && c.avg_position <= 15,
          );
          if (inDeclineZone) {
            signals.push("content_age");
            evidenceParts.content_age = {
              content_modified_at: meta.content_modified_at,
              age_days: Math.round(ageMs / (24 * 60 * 60 * 1000)),
            };
          }
        }
      }
    }

    // Signal (c): rank decline over the rank_compare_window. For each
    // cluster's anchor queries, compare the most-recent snapshot vs the
    // closest snapshot to (now - window_days). Skip the signal entirely if
    // no snapshot exists older than window_days × 0.75 (warmup period).
    const rankDeclines: Array<{ query: string; from: number; to: number; delta: number }> = [];
    let hasOldEnoughHistory = false;
    for (const c of clusters) {
      for (const a of c.anchor_queries ?? []) {
        const key = `${page}|${a.query}`;
        const series = state.rankHistory.get(key);
        if (!series || series.length < 2) continue;
        const latest = series[series.length - 1];
        // Find the snapshot closest to windowAgoTs (and at or before it).
        let baseline: RankHistoryRow | null = null;
        for (const r of series) {
          const ts = new Date(r.recorded_at).getTime();
          if (ts <= windowAgoTs) baseline = r;
          if (ts > windowAgoTs) break;
        }
        if (!baseline) continue;
        hasOldEnoughHistory = true;
        const delta = latest.position - baseline.position;
        if (delta >= thresholds.freshness_minRankDeltaPositions) {
          rankDeclines.push({ query: a.query, from: baseline.position, to: latest.position, delta });
        }
      }
    }
    if (rankDeclines.length > 0) {
      signals.push("rank_decline");
      evidenceParts.rank_decline = {
        declines: rankDeclines,
        window_days: thresholds.freshness_rankCompareWindowDays,
      };
    } else if (!hasOldEnoughHistory) {
      evidenceParts.rank_decline_skipped = "warmup — no snapshot older than the compare window yet";
    }

    if (signals.length === 0) continue;

    const totalVolume = clusters.reduce((sum, c) => sum + (c.total_volume ?? 0), 0);
    findings.push({
      kind: "freshness",
      scope_page: page,
      scope_query: null,
      target_page: null,
      score: totalVolume,
      evidence: {
        ...evidenceParts,
        signals,
        cluster_ids: clusters.map((c) => c.id),
        thresholds: {
          max_content_age_days: thresholds.freshness_maxContentAgeDays,
          min_rank_delta_positions: thresholds.freshness_minRankDeltaPositions,
          rank_compare_window_days: thresholds.freshness_rankCompareWindowDays,
        },
        score_rationale: "sum of cluster volume (impressions at risk if rank decays)",
      },
      identity_hash: hash(`freshness|${page}`),
    });
  }
  return findings;
}

/**
 * Pages that rank top-N in cp_seo_query_findings for an SV ≥ N query but
 * have ZERO inbound HT internal links. Pouring link equity into a proven
 * winner is one of the highest-leverage moves on a site, but the per-cluster
 * classifier never sees the link graph and never recommends it.
 *
 * Inbound counts are inverted in-memory from cp_seo_pages.outbound_internal_links.
 */
export function detectInternalLinkGaps(
  state: SiteState,
  thresholds = DEFAULT_THRESHOLDS,
): SynthesisFinding[] {
  // Build inbound count map: for each page, how many other HT pages link to it.
  const inboundCount = new Map<string, number>();
  for (const [, meta] of state.pagesById) {
    for (const target of meta.outbound_internal_links ?? []) {
      inboundCount.set(target, (inboundCount.get(target) ?? 0) + 1);
    }
  }

  // Group findings by page so we can look at each page's top-ranking queries.
  const findingsByPage = new Map<string, FindingRow[]>();
  for (const f of state.findings) {
    if (f.position == null) continue;
    if (f.position > thresholds.internalLink_minRank) continue;
    if ((f.volume ?? 0) < thresholds.internalLink_minSv) continue;
    const list = findingsByPage.get(f.page) ?? [];
    list.push(f);
    findingsByPage.set(f.page, list);
  }

  const findings: SynthesisFinding[] = [];
  for (const [page, qualifying] of findingsByPage) {
    const inbound = inboundCount.get(page) ?? 0;
    if (inbound > 0) continue;
    // Skip when the page itself has no outbound link data — we can't
    // distinguish "genuinely unlinked" from "scrape didn't capture links."
    // If literally zero pages have outbound data, the whole detector goes
    // dark; that's the desired warmup behavior before the new column populates.
    if (state.pagesById.get(page)?.outbound_internal_links == null) continue;

    const totalSv = qualifying.reduce((sum, f) => sum + (f.volume ?? 0), 0);
    const sample = qualifying
      .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
      .slice(0, 5)
      .map((f) => ({ query: f.query, position: f.position, sv: f.volume }));

    findings.push({
      kind: "internal_link_gap",
      scope_page: page,
      scope_query: null,
      target_page: null,
      score: totalSv,
      evidence: {
        inbound_count: inbound,
        qualifying_query_count: qualifying.length,
        top_queries: sample,
        thresholds: {
          max_rank: thresholds.internalLink_minRank,
          min_sv: thresholds.internalLink_minSv,
        },
        score_rationale: "sum of search volume across qualifying top-rank queries",
      },
      identity_hash: hash(`internal_link_gap|${page}`),
    });
  }
  return findings;
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

export async function runSiteSynthesis(
  supabase: SupabaseClient,
  jobId: number,
  thresholds = DEFAULT_THRESHOLDS,
): Promise<SynthesisResult> {
  const state = await loadSiteState(supabase);

  // Detect — order doesn't matter for emission, but we run authority-cap
  // FIRST so we can use its results to annotate other findings below.
  const authorityCappedFindings = detectAuthorityCappedSerps(state, thresholds);
  const authorityCappedQueries = new Set(
    authorityCappedFindings.map((f) => f.scope_query!).filter(Boolean),
  );
  const brandFindings = detectBrandCannibalization(state, thresholds);
  const brandSupersededQueries = new Set(
    brandFindings.map((f) => f.scope_query!).filter(Boolean),
  );

  let undesignatedFindings = detectUndesignatedTopics(state, thresholds);
  // Brand-cannibalization is more specific than undesignated_topic on the
  // same query — drop the latter to avoid stacking two different
  // recommendations on the same row in the dashboard.
  undesignatedFindings = undesignatedFindings.filter(
    (f) => !brandSupersededQueries.has(f.scope_query ?? ""),
  );

  const detected: SynthesisFinding[] = [
    ...detectFullyCededPages(state, thresholds),
    ...undesignatedFindings,
    ...detectAioNoCitation(state, thresholds),
    ...(await detectOrphanTargets(state, thresholds)),
    ...authorityCappedFindings,
    ...brandFindings,
    ...detectFreshness(state, thresholds),
    ...detectInternalLinkGaps(state, thresholds),
  ];

  // Authority-cap annotation pass: stamp `is_authority_capped=true` onto
  // any aio_no_citation / undesignated_topic / brand_cannibalization
  // finding whose scope_query is on the authority-capped list. We don't
  // suppress — keeping these findings visible lets editors override —
  // but the dashboard prose changes when this flag is set.
  for (const f of detected) {
    if (
      f.scope_query &&
      authorityCappedQueries.has(f.scope_query) &&
      f.kind !== "authority_capped_serp"
    ) {
      (f.evidence as Record<string, unknown>).is_authority_capped = true;
    }
  }

  const now = new Date().toISOString();

  // Load existing open findings so we can preserve first_seen_at on persisting
  // findings. Findings that drop out get archived_at set.
  const { data: existing, error: exErr } = await supabase
    .from("cp_seo_synthesis_findings")
    .select("id, kind, identity_hash")
    .is("archived_at", null);
  if (exErr) throw new Error(`load existing findings: ${exErr.message}`);

  type ExistingRow = { id: number; kind: string; identity_hash: string };
  const existingByKey = new Map<string, ExistingRow>(
    ((existing ?? []) as ExistingRow[]).map((r) => [
      `${r.kind}|${r.identity_hash}`,
      r,
    ]),
  );
  const detectedKeys = new Set(detected.map((d) => `${d.kind}|${d.identity_hash}`));

  // Archive findings that dropped out.
  const archivedIds: number[] = [];
  for (const [key, row] of existingByKey) {
    if (!detectedKeys.has(key)) archivedIds.push(row.id);
  }
  if (archivedIds.length > 0) {
    const { error: archErr } = await supabase
      .from("cp_seo_synthesis_findings")
      .update({ archived_at: now })
      .in("id", archivedIds);
    if (archErr) throw new Error(`archive findings: ${archErr.message}`);
  }

  // Upsert all detected findings. Use the (kind, identity_hash) UNIQUE
  // constraint so persisting rows update in place; first_seen_at is set on
  // INSERT only by the column default, so it survives updates naturally.
  let inserted = 0;
  let updated = 0;
  if (detected.length > 0) {
    const rows = detected.map((d) => ({
      kind: d.kind,
      scope_page: d.scope_page,
      scope_query: d.scope_query,
      target_page: d.target_page,
      score: Number(d.score.toFixed(2)),
      evidence: d.evidence,
      detected_in_job_id: jobId,
      last_seen_at: now,
      archived_at: null,
      identity_hash: d.identity_hash,
    }));

    // Chunk to avoid PostgREST payload limits on large runs.
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error: upErr } = await supabase
        .from("cp_seo_synthesis_findings")
        .upsert(slice, { onConflict: "kind,identity_hash" });
      if (upErr) throw new Error(`upsert synthesis findings: ${upErr.message}`);
    }

    for (const d of detected) {
      const key = `${d.kind}|${d.identity_hash}`;
      if (existingByKey.has(key)) updated++;
      else inserted++;
    }
  }

  const kindCounts: Record<SynthesisKind, number> = {
    fully_ceded_page: 0,
    undesignated_topic: 0,
    aio_no_citation: 0,
    orphan_target: 0,
    authority_capped_serp: 0,
    brand_cannibalization: 0,
    freshness: 0,
    internal_link_gap: 0,
  };
  for (const d of detected) kindCounts[d.kind]++;

  return {
    total: detected.length,
    kindCounts,
    inserted,
    updated,
    archived: archivedIds.length,
  };
}
