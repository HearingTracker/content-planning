/**
 * One-shot Phase 1B sync runner. Used during development to verify the
 * coverage classifier end-to-end without going through the admin UI.
 *
 * Run with: npx tsx scripts/run-seo-sync.ts
 *
 * Honors SEO_DEV_KEYWORD_LIMIT in .env.local to keep the run cheap.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { createSyncJob, runSyncJob } = await import("../lib/seo/sync-job");
  const { jobId } = await createSyncJob({ trigger: "admin" });
  console.log(`[run-seo-sync] created job ${jobId}, running…`);
  const t0 = Date.now();
  await runSyncJob(jobId);
  console.log(`[run-seo-sync] done in ${((Date.now() - t0) / 1000).toFixed(1)}s — job ${jobId}`);
}

main().catch((err) => {
  console.error("[run-seo-sync] failed:", err);
  process.exit(1);
});
