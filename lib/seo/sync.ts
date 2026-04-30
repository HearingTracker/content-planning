// Shared sync logic: rebuild SEO opportunity rows, upsert, archive stale, refresh counts.
// Called by both the cron HTTP route and the in-app "Refresh Now" server action.

import { createClient as createSb } from "@supabase/supabase-js";
import { runOpportunityExport } from "./run";

function getServiceClient() {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type SyncResult = {
  pages: number;
  opportunities: number;
  syncedAt: string;
};

export async function syncSeoOpportunities(): Promise<SyncResult> {
  const t0 = Date.now();
  const log = (msg: string) => console.error(`[seo-sync +${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

  log("starting export…");
  const { pages, opportunities } = await runOpportunityExport();
  log(`export complete: ${pages.length} pages, ${opportunities.length} opportunities`);

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // One server-side RPC does it all atomically — much faster than 4 PostgREST
  // round-trips and avoids per-table schema-cache cold starts.
  log("syncing to DB (single RPC)…");
  const { data, error } = await supabase.rpc("cp_seo_sync_all", {
    pages_data: pages,
    opps_data: opportunities,
    sync_at: now,
  });
  if (error) throw new Error(`sync_all: ${error.message}`);

  const summary = data as { pages: number; opportunities: number; archived: number };
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — archived ${summary.archived} stale rows`);
  return { pages: summary.pages, opportunities: summary.opportunities, syncedAt: now };
}
