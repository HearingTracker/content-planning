// Per-keyword overview data — KD, volume, intents, SERP features, parent topic.
// Backed by DataForSEO Labs Google Keyword Overview (live endpoint).
//
// Read-through cache via cp_seo_keyword_cache: rows fresher than CACHE_TTL_MS
// short-circuit the API call. KD/volume drift slowly, so the 14-day TTL keeps
// cost negligible at our query volumes.

import { createClient as createSb } from "@supabase/supabase-js";

export type KeywordData = {
  keyword: string;
  difficulty?: number | null;
  volume?: number | null;
  parent_topic?: string | null;
  intents?: Record<string, boolean> | null;
  serp_features?: string[] | null;
};

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// DataForSEO uses numeric location codes; map our short country codes onto them.
// Codes from https://docs.dataforseo.com/v3/business_data/google/locations/.
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

type DfsItem = {
  keyword: string;
  keyword_info?: { search_volume?: number | null } | null;
  keyword_properties?: {
    keyword_difficulty?: number | null;
    core_keyword?: string | null;
  } | null;
  search_intent_info?: {
    main_intent?: string | null;
    foreign_intent?: string[] | null;
  } | null;
  serp_info?: { serp_item_types?: string[] | null } | null;
};

type DfsResponse = {
  status_code: number;
  status_message?: string;
  tasks?: Array<{
    status_code: number;
    status_message?: string;
    result?: Array<{ items?: DfsItem[] | null }> | null;
  }>;
};

function itemToKeyword(item: DfsItem): KeywordData {
  const intents: Record<string, boolean> = {};
  if (item.search_intent_info?.main_intent) {
    intents[item.search_intent_info.main_intent] = true;
  }
  for (const tag of item.search_intent_info?.foreign_intent ?? []) {
    intents[tag] = true;
  }
  return {
    keyword: item.keyword,
    difficulty: item.keyword_properties?.keyword_difficulty ?? null,
    volume: item.keyword_info?.search_volume ?? null,
    parent_topic: item.keyword_properties?.core_keyword ?? null,
    intents: Object.keys(intents).length > 0 ? intents : null,
    serp_features: item.serp_info?.serp_item_types ?? null,
  };
}

async function batch(keywords: string[], country: string): Promise<KeywordData[]> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD env vars are required");
  }
  const locationCode = COUNTRY_TO_LOCATION_CODE[country.toLowerCase()];
  if (!locationCode) throw new Error(`Unsupported country: ${country}`);

  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const body = [{
    keywords,
    location_code: locationCode,
    language_code: "en",
    include_serp_info: true,
  }];

  const res = await fetch(
    "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live",
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

  const json = (await res.json()) as DfsResponse;
  // DataForSEO returns 2xx HTTP for application-level errors; check the body.
  if (json.status_code >= 40000) {
    throw new Error(`DataForSEO ${json.status_code}: ${json.status_message ?? "unknown"}`);
  }
  const task = json.tasks?.[0];
  if (task && task.status_code >= 40000) {
    throw new Error(`DataForSEO task ${task.status_code}: ${task.status_message ?? "unknown"}`);
  }
  const items = task?.result?.[0]?.items ?? [];
  return items.map(itemToKeyword);
}

type CacheRow = {
  keyword: string;
  country: string;
  difficulty: number | null;
  volume: number | null;
  parent_topic: string | null;
  intents: Record<string, boolean> | null;
  serp_features: string[] | null;
  fetched_at: string;
};

function rowToKeyword(r: CacheRow): KeywordData {
  return {
    keyword: r.keyword,
    difficulty: r.difficulty,
    volume: r.volume,
    parent_topic: r.parent_topic,
    intents: r.intents,
    serp_features: r.serp_features,
  };
}

export async function loadKeywordData(
  keywords: string[],
  country = "us",
): Promise<Map<string, KeywordData>> {
  const out = new Map<string, KeywordData>();
  if (keywords.length === 0) return out;

  const sb = getServiceClient();
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  // 1. Read fresh cache rows in chunks (defensive against parameter caps).
  const lookupChunk = 500;
  for (let i = 0; i < keywords.length; i += lookupChunk) {
    const slice = keywords.slice(i, i + lookupChunk);
    const { data, error } = await sb
      .from("cp_seo_keyword_cache")
      .select("*")
      .eq("country", country)
      .gte("fetched_at", cutoff)
      .in("keyword", slice);
    if (error) throw new Error(`keyword cache read failed: ${error.message}`);
    for (const row of (data ?? []) as CacheRow[]) {
      out.set(row.keyword, rowToKeyword(row));
    }
  }

  const misses = keywords.filter((k) => !out.has(k));
  if (misses.length === 0) return out;

  // 2. Fetch misses from DataForSEO (700 keywords/request max) and persist.
  const apiChunk = 700;
  for (let i = 0; i < misses.length; i += apiChunk) {
    const got = await batch(misses.slice(i, i + apiChunk), country);
    if (got.length === 0) continue;
    for (const r of got) out.set(r.keyword, r);

    const upsertRows = got.map((r) => ({
      keyword: r.keyword,
      country,
      difficulty: r.difficulty ?? null,
      volume: r.volume ?? null,
      traffic_potential: null,
      parent_topic: r.parent_topic ?? null,
      parent_volume: null,
      intents: r.intents ?? null,
      serp_features: r.serp_features ?? null,
      fetched_at: new Date().toISOString(),
    }));
    const { error: upErr } = await sb
      .from("cp_seo_keyword_cache")
      .upsert(upsertRows, { onConflict: "keyword,country" });
    if (upErr) throw new Error(`keyword cache write failed: ${upErr.message}`);
  }

  return out;
}
