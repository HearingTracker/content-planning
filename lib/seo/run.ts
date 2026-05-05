// Orchestrator. Pulls GSC striking-distance keywords, joins with newsletter-builder
// page revenue, classifies each keyword against page metadata (Storyblok or HTML),
// enriches with DataForSEO keyword metrics, and returns plain JS objects for the cron route to
// persist.

import { fetchGSCRows } from "./gsc";
import { fetchEarnings, type PageEarnings } from "./earnings";
import { fetchAllPageMetas } from "./storyblok";
import { loadKeywordData } from "./keyword-data";
import {
  classifyKeyword,
  expectedCtr,
  actionabilityScore,
  type PageMeta,
  type KeywordKind,
} from "./classify";

export type SeoPageRow = {
  page: string;
  page_title: string;
  meta_source: "storyblok" | "rendered";
  earnings_90d: number;
  conversions_90d: number;
};

export type SeoOpportunityRow = {
  page: string;
  query: string;
  kind: KeywordKind;
  novel_tokens: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr_pct: number;
  expected_ctr_pct: number;
  kd: number | null;
  volume: number | null;
  traffic_potential: number | null;
  parent_topic: string | null;
  intents: string | null;
  serp_features: string;
  phrase_in_body: number;
  in_heading: boolean;
  score: number;
};

export type RunOptions = {
  site?: string;          // GSC site (default https://www.hearingtracker.com/)
  gscDays?: number;       // default 28
  earningsDays?: number;  // default 90
  minPosition?: number;   // default 4
  maxPosition?: number;   // default 15
  minImpressions?: number;// default 50
  topPerPage?: number;    // default 10. Set to 0/null via includeAllForClustering to disable cap.
  country?: string;       // default 'us' (DataForSEO)
  includePrimary?: boolean; // default false (skip head terms)
  /**
   * Phase 1A clustering mode: returns every striking-distance keyword on
   * revenue pages with full classification + DataForSEO enrichment, with no
   * primary filter and no per-page cap. Caller is responsible for the
   * downstream cluster-level capping.
   */
  includeAllForClustering?: boolean;
};

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export async function runOpportunityExport(opts: RunOptions = {}): Promise<{
  pages: SeoPageRow[];
  opportunities: SeoOpportunityRow[];
  pageMetas: Map<string, PageMeta>;
}> {
  const t0 = Date.now();
  const log = (msg: string) => console.error(`[seo-run +${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

  const site = opts.site ?? "https://www.hearingtracker.com/";
  const gscDays = opts.gscDays ?? 28;
  const earningsDays = opts.earningsDays ?? 90;
  const minPos = opts.minPosition ?? 4;
  const maxPos = opts.maxPosition ?? 15;
  const minImp = opts.minImpressions ?? 50;
  const includeAllForClustering = opts.includeAllForClustering ?? false;
  const topPerPage = includeAllForClustering ? null : (opts.topPerPage ?? 10);
  const country = opts.country ?? "us";
  const includePrimary = includeAllForClustering ? true : (opts.includePrimary ?? false);

  // 1. GSC striking-distance keywords
  const end = new Date(); end.setDate(end.getDate() - 3); // 3-day lag
  const start = new Date(end); start.setDate(start.getDate() - gscDays);
  log(`querying GSC ${fmt(start)} → ${fmt(end)}`);
  const rows = await fetchGSCRows({ siteUrl: site, startDate: fmt(start), endDate: fmt(end) });
  log(`GSC rows: ${rows.length}`);

  type SDRow = {
    query: string; path: string; position: number;
    impressions: number; clicks: number; ctr: number;
  };
  const sd: SDRow[] = rows
    .map((r) => ({
      query: r.keys[0],
      path: pathOf(r.keys[1]),
      position: r.position,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
    }))
    .filter((r) => r.position >= minPos && r.position <= maxPos && r.impressions >= minImp);
  log(`striking-distance rows: ${sd.length}`);

  const distinctPaths = [...new Set(sd.map((r) => r.path))];

  // 2. Earnings (via newsletter-builder endpoint) — only revenue pages survive
  const sinceDate = fmt(new Date(Date.now() - earningsDays * 86400_000));
  log(`fetching earnings for ${distinctPaths.length} paths since ${sinceDate}`);
  const earnings = await fetchEarnings({ paths: distinctPaths, sinceDate });
  const revenuePaths = new Set(
    [...earnings.entries()]
      .filter(([, v]) => (v?.earnings ?? 0) > 0)
      .map(([p]) => p),
  );
  log(`pages with revenue: ${revenuePaths.size}`);

  // 3. Page metadata (Storyblok preferred, HTML fallback)
  const origin = new URL(site).origin;
  log(`fetching page metadata for ${revenuePaths.size} pages…`);
  const pageMetas = await fetchAllPageMetas(origin, [...revenuePaths], process.env.STORYBLOK_SECRET);
  log(`page metadata done`);

  // 4. Classify striking-distance keywords on revenue pages
  const sdOnRev = sd.filter((r) => revenuePaths.has(r.path));
  const classified = sdOnRev.map((r) => {
    const meta = pageMetas.get(r.path) as PageMeta | undefined;
    const c = meta
      ? classifyKeyword(r.query, meta)
      : { kind: "secondary" as const, novelTokens: [], phraseInBody: 0, inHeading: false };
    return { ...r, ...c };
  });

  const candidates = includePrimary ? classified : classified.filter((r) => r.kind !== "primary");
  const counts = classified.reduce((m: Record<string, number>, r) => { m[r.kind] = (m[r.kind] ?? 0) + 1; return m; }, {});
  log(`keyword breakdown: ${JSON.stringify(counts)}`);

  // 5. Per-keyword KD/volume/intents/SERP features for kept keywords (DataForSEO,
  //    cached). traffic_potential isn't returned by this provider.
  // SEO_DEV_KEYWORD_LIMIT caps the keyword universe in dev to bound API spend.
  // We keep the top-N by impressions so clusters remain meaningful.
  const impByQuery = candidates.reduce((m: Map<string, number>, r) => {
    m.set(r.query, (m.get(r.query) ?? 0) + r.impressions);
    return m;
  }, new Map<string, number>());
  let kwUniverse = [...impByQuery.keys()].sort((a, b) => (impByQuery.get(b)! - impByQuery.get(a)!));
  const devLimit = Number(process.env.SEO_DEV_KEYWORD_LIMIT ?? 0);
  if (devLimit > 0 && kwUniverse.length > devLimit) {
    log(`SEO_DEV_KEYWORD_LIMIT=${devLimit}: capping ${kwUniverse.length} → ${devLimit} keywords (top by impressions)`);
    kwUniverse = kwUniverse.slice(0, devLimit);
  }
  log(`fetching keyword data for ${kwUniverse.length} keywords…`);
  const kdMap = await loadKeywordData(kwUniverse, country);
  log(`keyword data done (${kdMap.size}/${kwUniverse.length} hits)`);

  // 6. Build per-page rows, sorted by score. When the dev cap is in effect we
  //    also drop candidates outside the kept set so embeddings/LLM calls
  //    downstream don't pay full price either.
  const keptQueries = new Set(kwUniverse);
  const keptCandidates = devLimit > 0
    ? candidates.filter((r) => keptQueries.has(r.query))
    : candidates;
  const byPage = new Map<string, SeoOpportunityRow[]>();
  for (const r of keptCandidates) {
    const kd = kdMap.get(r.query);
    const opp: SeoOpportunityRow = {
      page: r.path,
      query: r.query,
      kind: r.kind,
      novel_tokens: r.novelTokens.join(" "),
      position: Math.round(r.position * 10) / 10,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr_pct: Math.round(r.ctr * 10000) / 100,
      expected_ctr_pct: Math.round(expectedCtr(r.position) * 10000) / 100,
      kd: kd?.difficulty ?? null,
      volume: kd?.volume ?? null,
      traffic_potential: null,
      parent_topic: kd?.parent_topic ?? null,
      intents: kd?.intents
        ? Object.keys(kd.intents).filter((k) => kd.intents![k]).join("|")
        : null,
      serp_features: (kd?.serp_features ?? []).join("|"),
      phrase_in_body: r.phraseInBody,
      in_heading: r.inHeading,
      score: 0,
    };
    opp.score = Math.round(actionabilityScore({
      pos: r.position, imp: r.impressions, ctr: r.ctr, kd: opp.kd,
    }));
    if (!byPage.has(r.path)) byPage.set(r.path, []);
    byPage.get(r.path)!.push(opp);
  }

  const opportunities: SeoOpportunityRow[] = [];
  for (const list of byPage.values()) {
    list.sort((a, b) => b.score - a.score);
    if (topPerPage == null) {
      opportunities.push(...list);
    } else {
      opportunities.push(...list.slice(0, topPerPage));
    }
  }

  // 7. Page summaries for cp_seo_pages
  const pages: SeoPageRow[] = [];
  for (const path of revenuePaths) {
    const e = earnings.get(path) as PageEarnings | undefined;
    const meta = pageMetas.get(path);
    pages.push({
      page: path,
      page_title: meta?.title ?? "",
      meta_source: meta?.source ?? "rendered",
      earnings_90d: e?.earnings ?? 0,
      conversions_90d: e?.conversions ?? 0,
    });
  }

  return { pages, opportunities, pageMetas };
}
