// Per-query live SERP data — top 20 organic + AI Overview presence.
// Backed by DataForSEO `serp/google/organic/live/advanced` (one request per
// keyword — the live endpoint rejects multi-task batches).
//
// Used by the coverage classifier (lib/seo/sync-job.ts) to gate GSC-derived
// "competing pages" against the actual SERP. A revenue page that GSC reports
// at striking-distance position 14 with a few impressions is not competing
// in any meaningful sense unless it also shows up in the live top 20.
//
// Read-through cache via cp_seo_serp_cache: rows fresher than CACHE_TTL_MS
// short-circuit the API call. SERPs shuffle faster than KD/volume so the TTL
// is 7 days (vs 14 in keyword-data.ts).
//
// Sequential dispatch: DataForSEO's live endpoint returns
// "You can set only one task at a time" for multi-element bodies. This module
// fetches with a small concurrency pool instead.

import { createClient as createSb } from "@supabase/supabase-js";

export type SerpOrganicResult = {
  rank: number;
  url: string;
  domain: string;
};

export type SerpData = {
  keyword: string;
  top_organic: SerpOrganicResult[];
  ai_overview_present: boolean;
  ai_overview_sources: string[];
  // "People also ask" question titles, in SERP order. Empty when the block
  // didn't appear on this SERP. Used to feed the FAQ-gap surface.
  paa_questions: string[];
  // "Related searches" block at the bottom of the SERP. Cheap topic adjacency
  // for surfacing nearby intents the page could expand into.
  related_searches: string[];
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOP_N = 20;
const FETCH_CONCURRENCY = 5;
// Migration 20260517032418 added PAA / related-search columns. If a local DB
// applied an earlier draft of that migration with DEFAULT '[]', pre-migration
// cache rows are indistinguishable from true empty results unless we also look
// at fetched_at. Refetch old empty rows once so the new gap signals back-fill.
const GAP_SIGNAL_SCHEMA_CUTOFF_MS = Date.parse("2026-05-17T03:24:18Z");

// DataForSEO uses numeric location codes; map our short country codes onto them.
const COUNTRY_TO_LOCATION_CODE: Record<string, number> = {
  us: 2840,
  uk: 2826,
  gb: 2826,
  ca: 2124,
  au: 2036,
};

function getServiceClient() {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

type DfsPaaChild = {
  type?: string;
  title?: string | null;
  seed_question?: string | null;
};

type DfsSerpItem = {
  type?: string;
  rank_absolute?: number | null;
  url?: string | null;
  domain?: string | null;
  references?: Array<{ url?: string | null }> | null;
  // people_also_ask: a parent block whose .items array contains the questions.
  // Older DataForSEO responses occasionally surface PAA questions directly via
  // a top-level "title" instead, so we handle both shapes.
  items?: DfsPaaChild[] | string[] | null;
  title?: string | null;
};

type DfsSerpResponse = {
  status_code: number;
  status_message?: string;
  tasks?: Array<{
    status_code: number;
    status_message?: string;
    result?: Array<{ items?: DfsSerpItem[] | null }> | null;
  }>;
};

async function fetchOne(keyword: string, locationCode: number): Promise<SerpData> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD env vars are required");
  }
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  // depth: 30 covers the top 20 organic comfortably even when AIO/PAA/video
  // blocks push organic items down. Cost is negligible vs the cache hit rate.
  const body = [{
    keyword,
    location_code: locationCode,
    language_code: "en",
    depth: 30,
  }];

  const res = await fetch(
    "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as DfsSerpResponse;
  if (json.status_code >= 40000) {
    throw new Error(`DataForSEO ${json.status_code}: ${json.status_message ?? "unknown"}`);
  }
  const task = json.tasks?.[0];
  if (task && task.status_code >= 40000) {
    throw new Error(`DataForSEO task ${task.status_code}: ${task.status_message ?? "unknown"}`);
  }
  const items = task?.result?.[0]?.items ?? [];

  const organic: SerpOrganicResult[] = [];
  let aiOverviewPresent = false;
  const aiSources = new Set<string>();
  const paa: string[] = [];
  const related: string[] = [];
  for (const item of items) {
    if (item.type === "ai_overview") {
      aiOverviewPresent = true;
      for (const ref of item.references ?? []) {
        if (ref?.url) aiSources.add(ref.url);
      }
      continue;
    }
    if (item.type === "people_also_ask") {
      for (const child of (item.items ?? []) as DfsPaaChild[] | string[]) {
        if (typeof child === "string") {
          if (child) paa.push(child);
          continue;
        }
        // PAA child shape: {type:"people_also_ask_element", title:"..."}.
        // Some responses also include a top-level title — fall back to it.
        const q = child?.title ?? child?.seed_question ?? null;
        if (q) paa.push(q);
      }
      continue;
    }
    if (item.type === "related_searches") {
      // Related-searches block shape: {type, items: string[]} (array of
      // plain strings, not objects). Defensive: also tolerate object items
      // with .title for forward compatibility.
      for (const child of (item.items ?? []) as DfsPaaChild[] | string[]) {
        if (typeof child === "string") {
          if (child) related.push(child);
          continue;
        }
        const q = child?.title ?? null;
        if (q) related.push(q);
      }
      continue;
    }
    if (item.type !== "organic") continue;
    if (organic.length >= TOP_N) continue;
    if (item.rank_absolute == null || !item.url || !item.domain) continue;
    organic.push({
      rank: item.rank_absolute,
      url: item.url,
      domain: item.domain,
    });
  }

  return {
    keyword,
    top_organic: organic,
    ai_overview_present: aiOverviewPresent,
    ai_overview_sources: [...aiSources],
    paa_questions: [...new Set(paa)],
    related_searches: [...new Set(related)],
  };
}

type CacheRow = {
  keyword: string;
  country: string;
  top_organic: SerpOrganicResult[] | null;
  ai_overview_present: boolean;
  ai_overview_sources: string[] | null;
  paa_questions: string[] | null;
  related_searches: string[] | null;
  fetched_at: string;
};

function rowToSerp(r: CacheRow): SerpData {
  return {
    keyword: r.keyword,
    top_organic: r.top_organic ?? [],
    ai_overview_present: r.ai_overview_present,
    ai_overview_sources: r.ai_overview_sources ?? [],
    paa_questions: r.paa_questions ?? [],
    related_searches: r.related_searches ?? [],
  };
}

// Pre-migration rows have NULL paa_questions / related_searches columns
// (or the columns themselves don't exist yet in stale envs). We treat those
// as cache misses so the next sync re-fetches and back-fills the row.
function rowHasGapSignals(r: CacheRow): boolean {
  if (r.paa_questions == null || r.related_searches == null) return false;
  const fetchedAtMs = Date.parse(r.fetched_at);
  if (
    Array.isArray(r.paa_questions) &&
    Array.isArray(r.related_searches) &&
    r.paa_questions.length === 0 &&
    r.related_searches.length === 0 &&
    Number.isFinite(fetchedAtMs) &&
    fetchedAtMs < GAP_SIGNAL_SCHEMA_CUTOFF_MS
  ) {
    return false;
  }
  return true;
}

/**
 * Bulk-load SERP data with read-through caching. Misses are fetched
 * concurrently (FETCH_CONCURRENCY workers) and persisted. Returns a Map
 * keyed by keyword for caller-side lookups.
 *
 * Failures on individual keywords are logged and omitted from the result —
 * the coverage classifier should fall back to GSC-only signals when a SERP
 * isn't available rather than blocking the whole sync.
 */
export async function loadSerps(
  keywords: string[],
  country = "us",
  opts: {
    onCacheRead?: (cached: number, misses: number) => void | Promise<void>;
    onFetchProgress?: (completed: number, total: number) => void | Promise<void>;
  } = {},
): Promise<Map<string, SerpData>> {
  const out = new Map<string, SerpData>();
  if (keywords.length === 0) return out;

  const locationCode = COUNTRY_TO_LOCATION_CODE[country.toLowerCase()];
  if (!locationCode) throw new Error(`Unsupported country: ${country}`);

  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  // 1. Read fresh cache rows in chunks (defensive against parameter caps).
  const lookupChunk = 500;
  const dedupedKeywords = [...new Set(keywords)];
  for (let i = 0; i < dedupedKeywords.length; i += lookupChunk) {
    const slice = dedupedKeywords.slice(i, i + lookupChunk);
    const { data, error } = await sb
      .from("cp_seo_serp_cache")
      .select("*")
      .eq("country", country)
      .gte("fetched_at", cutoff)
      .in("keyword", slice);
    if (error) throw new Error(`serp cache read failed: ${error.message}`);
    for (const row of (data ?? []) as CacheRow[]) {
      // Skip rows missing the PAA/related fields — they were cached before
      // the paa_questions/related_searches migration and would silently feed
      // the classifier no FAQ-gap signal. Treating them as misses re-fetches.
      if (!rowHasGapSignals(row)) continue;
      out.set(row.keyword, rowToSerp(row));
    }
  }

  const misses = dedupedKeywords.filter((k) => !out.has(k));
  await opts.onCacheRead?.(out.size, misses.length);
  if (misses.length === 0) return out;

  // 2. Fetch misses with a small concurrency pool. DataForSEO's live endpoint
  //    only allows one task per request, so each miss is its own HTTP call.
  let next = 0;
  let completed = 0;
  const fresh: SerpData[] = [];
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= misses.length) return;
      const kw = misses[i];
      try {
        const data = await fetchOne(kw, locationCode);
        fresh.push(data);
        out.set(kw, data);
      } catch (err) {
        // Don't fail the whole batch on one bad keyword; the classifier will
        // simply have no SERP data for this query and fall back to GSC-only.
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[serp-data] fetch failed for "${kw}": ${msg}`);
      }
      completed++;
      await opts.onFetchProgress?.(completed, misses.length);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, misses.length) }, worker),
  );

  // 3. Persist freshly fetched rows.
  if (fresh.length > 0) {
    const upsertRows = fresh.map((r) => ({
      keyword: r.keyword,
      country,
      top_organic: r.top_organic,
      ai_overview_present: r.ai_overview_present,
      ai_overview_sources: r.ai_overview_sources,
      paa_questions: r.paa_questions,
      related_searches: r.related_searches,
      fetched_at: new Date().toISOString(),
    }));
    const upsertChunk = 200;
    for (let i = 0; i < upsertRows.length; i += upsertChunk) {
      const { error: upErr } = await sb
        .from("cp_seo_serp_cache")
        .upsert(upsertRows.slice(i, i + upsertChunk), { onConflict: "keyword,country" });
      if (upErr) throw new Error(`serp cache write failed: ${upErr.message}`);
    }
  }

  return out;
}

/**
 * Normalize a URL to its hostname+path for SERP-membership comparison. GSC
 * page URLs and DataForSEO SERP URLs both arrive as full https:// strings,
 * but trailing slashes, query strings, and fragments differ. We compare on
 * `hostname + pathname` (no scheme, no query, no fragment, trailing slash
 * stripped) so equivalent URLs match.
 */
export function normalizeUrlForMatch(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}
