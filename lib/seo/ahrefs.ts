// Ahrefs Keywords Explorer overview — KD, volume, traffic potential, intents,
// SERP features. Endpoint caps around 250 results per call so we chunk.

export type AhrefsKeyword = {
  keyword: string;
  difficulty?: number | null;
  volume?: number | null;
  traffic_potential?: number | null;
  parent_topic?: string | null;
  parent_volume?: number | null;
  intents?: Record<string, boolean> | null;
  serp_features?: string[] | null;
};

async function batch(keywords: string[], country: string): Promise<AhrefsKeyword[]> {
  const apiKey = process.env.AHREFS_API_KEY;
  if (!apiKey) throw new Error("AHREFS_API_KEY env var is required");

  const params = new URLSearchParams({
    country,
    select: "keyword,difficulty,volume,traffic_potential,parent_topic,parent_volume,intents,serp_features",
    keywords: keywords.join(","),
    output: "json",
    limit: "1000",
  });
  const res = await fetch(`https://api.ahrefs.com/v3/keywords-explorer/overview?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Ahrefs ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { keywords?: AhrefsKeyword[] };
  return data.keywords ?? [];
}

export async function loadAhrefs(keywords: string[], country = "us"): Promise<Map<string, AhrefsKeyword>> {
  const out = new Map<string, AhrefsKeyword>();
  const chunk = 200;
  for (let i = 0; i < keywords.length; i += chunk) {
    const got = await batch(keywords.slice(i, i + chunk), country);
    for (const r of got) out.set(r.keyword, r);
  }
  return out;
}
