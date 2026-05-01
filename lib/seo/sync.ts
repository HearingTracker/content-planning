// Cron + admin entry point. Creates a sync_jobs row, runs the Phase 1A
// clustered pipeline synchronously (await), then returns a small summary.
//
// The admin "Refresh now" button uses a different path that returns the
// jobId immediately and lets the worker run via Next.js after() — that
// lives in app/(dashboard)/seo/actions.ts. This file is the synchronous
// entry the cron route calls.

import { createClient as createSb } from "@supabase/supabase-js";
import { createSyncJob, runSyncJob } from "./sync-job";

function getServiceClient() {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type SyncResult = {
  jobId: number;
  pages: number;
  opportunities: number;
  syncedAt: string;
};

export async function syncSeoOpportunities(): Promise<SyncResult> {
  const t0 = Date.now();
  const { jobId } = await createSyncJob({ trigger: "cron" });
  await runSyncJob(jobId);

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("cp_seo_sync_jobs")
    .select("pages_processed, opportunities_total, completed_at")
    .eq("id", jobId)
    .single();
  if (error) throw new Error(`syncSeoOpportunities: ${error.message}`);

  console.error(
    `[seo-sync] job=${jobId} done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${data?.pages_processed ?? 0} pages, ${data?.opportunities_total ?? 0} opportunities`,
  );

  return {
    jobId,
    pages: data?.pages_processed ?? 0,
    opportunities: data?.opportunities_total ?? 0,
    syncedAt: data?.completed_at ?? new Date().toISOString(),
  };
}
