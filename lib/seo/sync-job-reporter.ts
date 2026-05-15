// SyncJobReporter — durable progress writes for cp_seo_sync_jobs.
//
// Wraps the supabase service client with start/setPhase/setProgress/
// finishPhase/log/complete/fail helpers. Each call is one DB roundtrip; we
// don't debounce in 1A because the LLM phases dominate runtime and a few
// extra updates per phase are negligible.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PhaseKey =
  | "gsc"
  | "embed"
  | "cluster"
  | "label"
  | "match"
  | "classify"
  | "upsert"
  | "rank_snapshot"
  | "synthesize"
  | "done";

export const PHASE_LABELS: Record<PhaseKey, string> = {
  gsc:           "Pulling GSC + earnings + page metadata",
  embed:         "Embedding queries",
  cluster:       "Clustering per page",
  label:         "Labeling clusters",
  match:         "Matching against existing clusters",
  classify:      "Classifying coverage per cluster",
  upsert:        "Writing to database",
  rank_snapshot: "Snapshotting rank history",
  synthesize:    "Synthesizing site-wide insights",
  done:          "Done",
};

const LOG_TAIL_MAX = 50;

type PhaseProgress = {
  completed: number;
  total: number;
  label?: string;
  detail?: string;
};

type PhaseStartProgress =
  | number
  | {
      total?: number;
      label?: string;
      detail?: string;
    };

function makePhaseProgress(
  completed: number,
  total: number,
  label?: string,
  detail?: string,
): PhaseProgress {
  const progress: PhaseProgress = { completed, total };
  if (label) progress.label = label;
  if (detail) progress.detail = detail;
  return progress;
}

function normalizePhaseStartProgress(progress?: PhaseStartProgress): PhaseProgress | null {
  if (progress == null) return null;
  if (typeof progress === "number") {
    return makePhaseProgress(0, progress);
  }
  return makePhaseProgress(0, progress.total ?? 0, progress.label, progress.detail);
}

function formatPhaseLog(phase: PhaseKey, progress: PhaseProgress | null): string {
  if (!progress || progress.total <= 0) return PHASE_LABELS[phase];
  return `${PHASE_LABELS[phase]} (${progress.total.toLocaleString()}${progress.label ? ` ${progress.label}` : ""})`;
}

export type CompletionStats = {
  pages_processed: number;
  clusters_created: number;
  clusters_matched: number;
  clusters_review_flagged: number;
  clusters_archived: number;
  opportunities_total: number;
  embedding_tokens: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  estimated_cost_usd: number;
};

export class SyncJobReporter {
  private phaseStartedAt: Date | null = null;

  constructor(
    private readonly supabase: SupabaseClient,
    public readonly jobId: number,
  ) {}

  async start(): Promise<void> {
    const { error } = await this.supabase
      .from("cp_seo_sync_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", this.jobId);
    if (error) throw new Error(`reporter.start: ${error.message}`);
    await this.log("Sync job started");
  }

  async setPhase(phase: PhaseKey, progress?: PhaseStartProgress): Promise<void> {
    // Close out the previous phase in phase_history before flipping.
    if (this.phaseStartedAt) {
      await this.appendPhaseHistory({
        phase: this.previousPhase,
        started_at: this.phaseStartedAt.toISOString(),
        completed_at: new Date().toISOString(),
        items: this.previousItems,
      });
    }

    this.phaseStartedAt = new Date();
    this.previousPhase = phase;
    this.previousItems = 0;

    const phaseProgress = normalizePhaseStartProgress(progress);
    const update: Record<string, unknown> = {
      current_phase: phase,
      phase_progress: phaseProgress,
    };
    const { error } = await this.supabase
      .from("cp_seo_sync_jobs")
      .update(update)
      .eq("id", this.jobId);
    if (error) throw new Error(`reporter.setPhase(${phase}): ${error.message}`);
    await this.log(`▸ ${formatPhaseLog(phase, phaseProgress)}`);
  }

  async setProgress(
    completed: number,
    total: number,
    label?: string,
    detail?: string,
  ): Promise<void> {
    this.previousItems = completed;
    const { error } = await this.supabase
      .from("cp_seo_sync_jobs")
      .update({ phase_progress: makePhaseProgress(completed, total, label, detail) })
      .eq("id", this.jobId);
    if (error) throw new Error(`reporter.setProgress: ${error.message}`);
  }

  async log(message: string): Promise<void> {
    const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS
    const line = `[${ts}] ${message}`;
    // Postgres array_prepend then slice. Easier in JS — fetch existing tail,
    // prepend, slice, write back.
    const { data, error: readErr } = await this.supabase
      .from("cp_seo_sync_jobs")
      .select("log_tail")
      .eq("id", this.jobId)
      .single();
    if (readErr) {
      // Don't throw on log writes — a logging hiccup shouldn't fail the job.
      console.error("[seo-sync] reporter.log read failed:", readErr.message);
      return;
    }
    const next = [line, ...(data?.log_tail ?? [])].slice(0, LOG_TAIL_MAX);
    const { error: writeErr } = await this.supabase
      .from("cp_seo_sync_jobs")
      .update({ log_tail: next })
      .eq("id", this.jobId);
    if (writeErr) console.error("[seo-sync] reporter.log write failed:", writeErr.message);
  }

  async complete(stats: CompletionStats): Promise<void> {
    if (this.phaseStartedAt) {
      await this.appendPhaseHistory({
        phase: this.previousPhase,
        started_at: this.phaseStartedAt.toISOString(),
        completed_at: new Date().toISOString(),
        items: this.previousItems,
      });
    }
    const { error } = await this.supabase
      .from("cp_seo_sync_jobs")
      .update({
        status: "completed",
        current_phase: "done",
        completed_at: new Date().toISOString(),
        ...stats,
      })
      .eq("id", this.jobId);
    if (error) throw new Error(`reporter.complete: ${error.message}`);
    await this.log(
      `✓ Done — ${stats.pages_processed} pages, ${stats.clusters_created + stats.clusters_matched} clusters (${stats.clusters_review_flagged} flagged), $${stats.estimated_cost_usd.toFixed(3)}`,
    );
  }

  async fail(err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    const { error } = await this.supabase
      .from("cp_seo_sync_jobs")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", this.jobId);
    if (error) console.error("[seo-sync] reporter.fail write failed:", error.message);
    await this.log(`✗ Failed: ${message}`);
  }

  // ── private ─────────────────────────────────────────────────────────────

  private previousPhase: PhaseKey = "gsc";
  private previousItems = 0;

  private async appendPhaseHistory(entry: {
    phase: PhaseKey;
    started_at: string;
    completed_at: string;
    items: number;
  }): Promise<void> {
    const { data, error: readErr } = await this.supabase
      .from("cp_seo_sync_jobs")
      .select("phase_history")
      .eq("id", this.jobId)
      .single();
    if (readErr) {
      console.error("[seo-sync] phase_history read failed:", readErr.message);
      return;
    }
    const next = [...((data?.phase_history as unknown[]) ?? []), entry];
    const { error } = await this.supabase
      .from("cp_seo_sync_jobs")
      .update({ phase_history: next })
      .eq("id", this.jobId);
    if (error) console.error("[seo-sync] phase_history write failed:", error.message);
  }
}
