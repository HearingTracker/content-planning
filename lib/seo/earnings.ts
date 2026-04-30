// Per-page revenue totals, fetched from the newsletter-builder
// /api/internal/page-earnings endpoint. We do NOT talk to that DB directly so
// content-planning never holds a service-role key for it (PII boundary).

export type PageEarnings = {
  sessions: number;
  conversions: number;
  earnings: number;
};

export async function fetchEarnings(opts: {
  paths: string[];
  sinceDate: string; // YYYY-MM-DD
}): Promise<Map<string, PageEarnings>> {
  const url = process.env.NEWSLETTER_INTERNAL_API_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!url) throw new Error("NEWSLETTER_INTERNAL_API_URL env var is required");
  if (!secret) throw new Error("INTERNAL_API_SECRET env var is required");

  const totals = new Map<string, PageEarnings>();
  // newsletter-builder caps at 1000 paths per request; chunk just in case.
  const chunkSize = 800;
  for (let i = 0; i < opts.paths.length; i += chunkSize) {
    const paths = opts.paths.slice(i, i + chunkSize);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ paths, sinceDate: opts.sinceDate }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`page-earnings ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { pages: Record<string, PageEarnings> };
    for (const [k, v] of Object.entries(data.pages ?? {})) totals.set(k, v);
  }
  return totals;
}
