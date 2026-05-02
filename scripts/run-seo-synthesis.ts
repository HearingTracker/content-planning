/**
 * Standalone synthesizer runner — exercises lib/seo/synthesis.ts against
 * the current local DB without re-running the full sync. Used to iterate
 * on detector logic and verify findings without paying for embeddings or
 * SERP fetches the per-cluster classifier already paid for upstream.
 *
 * Run with: npx tsx scripts/run-seo-synthesis.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { runSiteSynthesis } = await import("../lib/seo/synthesis");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  // Re-use the most recent sync job id so the FK on detected_in_job_id
  // resolves; ad-hoc runs aren't tied to a real sync run.
  const { data: latestJob } = await sb
    .from("cp_seo_sync_jobs")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const jobId = latestJob?.id ?? 0;
  console.log(`[synthesis] using detected_in_job_id=${jobId}`);
  const t0 = Date.now();
  const result = await runSiteSynthesis(sb, jobId);
  console.log(`[synthesis] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[synthesis] failed:", err);
  process.exit(1);
});
