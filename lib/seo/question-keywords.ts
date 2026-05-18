// Question-shaped keyword expansion. For each seed keyword (a cluster's
// canonical_query plus its top anchors), pull DataForSEO Labs
// related-keywords, then filter to the question-shaped subset:
//   - starts with who/what/when/where/why/how/can/could/does/do/is/are/will/should, OR
//   - contains a question mark
//
// Feeds the FAQ-gap surface alongside the live PAA block from
// lib/seo/serp-data.ts. PAA is what Google shows readers right now; the
// question variants from Labs are the broader long-tail of question intent
// (including questions Google doesn't necessarily render as PAA), with
// search volume so we can rank candidates.
//
// Cached for 30 days via cp_seo_question_keyword_cache — question intent
// moves slower than SERPs, and the request units are larger, so a longer TTL
// keeps cost bounded.

import { createClient as createSb } from "@supabase/supabase-js";

export type QuestionKeyword = {
  q: string;
  volume: number | null;
};

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RELATED_DEPTH = 2;
const RELATED_LIMIT = 100;
const FETCH_CONCURRENCY = 4;

// Match the codes used by keyword-data.ts / serp-data.ts.
const COUNTRY_TO_LOCATION_CODE: Record<string, number> = {
  us: 2840,
  uk: 2826,
  gb: 2826,
  ca: 2124,
  au: 2036,
};

// Question-prefix regex. Anchored to the start of the keyword (case-insensitive)
// so "android phone" doesn't false-positive on "do" inside. We accept either a
// matching prefix OR the presence of a question mark anywhere.
const QUESTION_PREFIX_RE = /^(who|what|when|where|why|how|can|could|does|do|is|are|will|should|which)\b/i;
function isQuestionShaped(kw: string): boolean {
  if (!kw) return false;
  if (kw.includes("?")) return true;
  return QUESTION_PREFIX_RE.test(kw.trim());
}

function getServiceClient() {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

type DfsRelatedItem = {
  keyword_data?: {
    keyword?: string | null;
    keyword_info?: { search_volume?: number | null } | null;
  } | null;
};

type DfsRelatedResponse = {
  status_code: number;
  status_message?: string;
  tasks?: Array<{
    status_code: number;
    status_message?: string;
    result?: Array<{ items?: DfsRelatedItem[] | null }> | null;
  }>;
};

async function fetchOne(seed: string, locationCode: number): Promise<QuestionKeyword[]> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD env vars are required");
  }
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const body = [{
    keyword: seed,
    location_code: locationCode,
    language_code: "en",
    depth: RELATED_DEPTH,
    limit: RELATED_LIMIT,
  }];

  const res = await fetch(
    "https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live",
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

  const json = (await res.json()) as DfsRelatedResponse;
  if (json.status_code >= 40000) {
    throw new Error(`DataForSEO ${json.status_code}: ${json.status_message ?? "unknown"}`);
  }
  const task = json.tasks?.[0];
  if (task && task.status_code >= 40000) {
    throw new Error(`DataForSEO task ${task.status_code}: ${task.status_message ?? "unknown"}`);
  }
  const items = task?.result?.[0]?.items ?? [];
  const out: QuestionKeyword[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const kw = item.keyword_data?.keyword?.trim();
    if (!kw) continue;
    if (!isQuestionShaped(kw)) continue;
    if (seen.has(kw.toLowerCase())) continue;
    seen.add(kw.toLowerCase());
    out.push({
      q: kw,
      volume: item.keyword_data?.keyword_info?.search_volume ?? null,
    });
  }
  // Sort by volume desc so the consumer can take the top N for prompt input
  // without re-sorting. Nulls go last.
  out.sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
  return out;
}

type CacheRow = {
  seed_keyword: string;
  country: string;
  questions: QuestionKeyword[] | null;
  fetched_at: string;
};

/**
 * Bulk-load question-shaped keyword candidates per seed with read-through
 * caching. Misses are fetched concurrently and persisted. Failures on
 * individual seeds are logged and the seed gets an empty array for this run
 * only — never blocks the whole sync, and never poisons the 30-day cache with
 * a transient API/network failure.
 */
export async function loadQuestionKeywords(
  seeds: string[],
  country = "us",
  opts: {
    onCacheRead?: (cached: number, misses: number) => void | Promise<void>;
    onFetchProgress?: (completed: number, total: number) => void | Promise<void>;
  } = {},
): Promise<Map<string, QuestionKeyword[]>> {
  const out = new Map<string, QuestionKeyword[]>();
  if (seeds.length === 0) return out;

  const locationCode = COUNTRY_TO_LOCATION_CODE[country.toLowerCase()];
  if (!locationCode) throw new Error(`Unsupported country: ${country}`);

  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  const dedupedSeeds = [...new Set(seeds.map((s) => s.trim()).filter(Boolean))];

  const lookupChunk = 500;
  for (let i = 0; i < dedupedSeeds.length; i += lookupChunk) {
    const slice = dedupedSeeds.slice(i, i + lookupChunk);
    const { data, error } = await sb
      .from("cp_seo_question_keyword_cache")
      .select("*")
      .eq("country", country)
      .gte("fetched_at", cutoff)
      .in("seed_keyword", slice);
    if (error) throw new Error(`question keyword cache read failed: ${error.message}`);
    for (const row of (data ?? []) as CacheRow[]) {
      out.set(row.seed_keyword, row.questions ?? []);
    }
  }

  const misses = dedupedSeeds.filter((k) => !out.has(k));
  await opts.onCacheRead?.(out.size, misses.length);
  if (misses.length === 0) return out;

  let next = 0;
  let completed = 0;
  const fresh: Array<{ seed: string; questions: QuestionKeyword[] }> = [];
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= misses.length) return;
      const seed = misses[i];
      try {
        const questions = await fetchOne(seed, locationCode);
        fresh.push({ seed, questions });
        out.set(seed, questions);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[question-keywords] fetch failed for "${seed}": ${msg}`);
        // Do not persist failure-as-empty. A transient auth/rate-limit/network
        // problem should not suppress keyword-tool FAQ gaps for the whole TTL.
        out.set(seed, []);
      }
      completed++;
      await opts.onFetchProgress?.(completed, misses.length);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, misses.length) }, worker),
  );

  if (fresh.length > 0) {
    const upsertRows = fresh.map((r) => ({
      seed_keyword: r.seed,
      country,
      questions: r.questions,
      fetched_at: new Date().toISOString(),
    }));
    const upsertChunk = 200;
    for (let i = 0; i < upsertRows.length; i += upsertChunk) {
      const { error: upErr } = await sb
        .from("cp_seo_question_keyword_cache")
        .upsert(upsertRows.slice(i, i + upsertChunk), {
          onConflict: "seed_keyword,country",
        });
      if (upErr) throw new Error(`question keyword cache write failed: ${upErr.message}`);
    }
  }

  return out;
}
