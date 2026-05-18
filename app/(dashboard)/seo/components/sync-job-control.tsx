"use client";

// SyncJobControl — admin entry point for triggering SEO sync jobs.
//
// Idle state: a "Refresh now" button (admin-only).
// Active state: a panel with current phase, progress bar, elapsed time,
//   collapsible log tail. Polls cp_seo_sync_jobs every 2s while running.
// On completion: invalidates the SEO query cache and shows a toast.
//
// Long-running by design — Phase 1A pipeline is 1–3 minutes typical, with
// the embed → cluster → label sequence dominating runtime. The polling
// shape is what the user explicitly asked for.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  GitMerge,
  Layers,
  Loader2,
  Network,
  RefreshCw,
  Save,
  Tag,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveSyncJob, useSyncJob, useTriggerSyncJob } from "@/hooks/queries";
import { useCurrentUserRole } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import type { SeoSyncJob, SeoSyncJobPhase } from "../types";

const PHASE_META: Record<
  SeoSyncJobPhase,
  { label: string; Icon: typeof Database }
> = {
  gsc:      { label: "Pulling GSC + earnings + page metadata", Icon: Database },
  embed:    { label: "Embedding queries",                      Icon: Cpu },
  cluster:  { label: "Clustering per page",                    Icon: Layers },
  label:    { label: "Labeling clusters",                      Icon: Tag },
  match:    { label: "Matching against existing clusters",     Icon: GitMerge },
  classify: { label: "Classifying coverage per cluster",       Icon: Wand2 },
  upsert:        { label: "Writing to database",                    Icon: Save },
  rank_snapshot: { label: "Snapshotting rank history",               Icon: Database },
  synthesize:    { label: "Synthesizing site-wide insights",         Icon: Network },
  done:          { label: "Done",                                    Icon: CheckCircle2 },
};

export function SyncJobControl() {
  const { data: role } = useCurrentUserRole();
  const isAdmin = role === "admin";

  // Active-job poll is enabled for both admin and non-admin so editors can
  // see "a sync is running" while the trigger button stays admin-only.
  const { data: activeJob } = useActiveSyncJob({ enabled: true });
  const [trackedJobId, setTrackedJobId] = useState<number | null>(null);
  const { data: trackedJob } = useSyncJob(trackedJobId);
  const trigger = useTriggerSyncJob();

  // Resolve the job we're showing: either the freshly-triggered one or any
  // active job that was already running when this component mounted.
  const job = trackedJob ?? activeJob ?? null;

  // When a tracked job terminates, surface a toast and clear the tracker after
  // a brief moment so the panel slides away.
  useEffect(() => {
    if (!trackedJob) return;
    if (trackedJob.status === "completed") {
      const stats = formatStats(trackedJob);
      toast.success(`Sync done — ${stats}`);
      const t = setTimeout(() => setTrackedJobId(null), 4000);
      return () => clearTimeout(t);
    }
    if (trackedJob.status === "failed") {
      toast.error(`Sync failed: ${trackedJob.error_message ?? "unknown error"}`);
    }
  }, [trackedJob]);

  const isActive = job?.status === "pending" || job?.status === "running";

  // Non-admins see the read-only panel during an active sync (so they know
  // why the dashboard might shift under them) but never the Refresh button.
  if (!isAdmin) {
    if (isActive && job) return <SyncJobPanel job={job} />;
    return null;
  }

  if (!isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={trigger.isPending}
        onClick={() => {
          trigger.mutate(undefined, {
            onSuccess: ({ jobId }) => {
              setTrackedJobId(jobId);
              toast(`Sync started — job #${jobId}`);
            },
            onError: (err) => {
              toast.error(`Failed to start sync: ${(err as Error).message}`);
            },
          });
        }}
      >
        <RefreshCw className={cn("h-4 w-4", trigger.isPending && "animate-spin")} />
        {trigger.isPending ? "Starting…" : "Refresh now"}
      </Button>
    );
  }

  return <SyncJobPanel job={job} />;
}

function SyncJobPanel({ job }: { job: SeoSyncJob }) {
  const [logOpen, setLogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const phase = (job.current_phase ?? "gsc") as SeoSyncJobPhase;
  const meta = PHASE_META[phase];
  const { Icon } = meta;

  // Tick once a second so elapsed time keeps moving while the job runs.
  useEffect(() => {
    if (job.status !== "running" && job.status !== "pending") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [job.status]);

  const elapsedMs = job.started_at
    ? now - new Date(job.started_at).getTime()
    : now - new Date(job.triggered_at).getTime();

  const progress = job.phase_progress;
  const percent =
    progress && progress.total > 0
      ? clamp(Math.round((progress.completed / progress.total) * 100), 0, 100)
      : null;

  const failed = job.status === "failed";
  const progressDetail = progress?.detail?.trim();
  const currentLabel = failed ? "Sync failed" : progressDetail || meta.label;
  const phaseContext = progressDetail && progressDetail !== meta.label ? meta.label : null;
  const progressUnit = formatProgressUnit(progress?.label, meta.label, progressDetail, phase);
  const latestActivity = formatLatestActivity(job.log_tail?.[0], currentLabel);

  return (
    <div
      className={cn(
        "min-w-[320px] rounded-lg border bg-card p-3 shadow-sm",
        failed ? "border-rose-300/70" : "border-blue-200/70",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            failed
              ? "bg-rose-100 text-rose-700"
              : "bg-blue-100 text-blue-700",
          )}
        >
          {failed ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4 animate-pulse" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-foreground block text-sm font-medium leading-tight">
                {currentLabel}
              </span>
              {phaseContext && (
                <span className="text-muted-foreground mt-0.5 block text-[11px] leading-tight">
                  {phaseContext}
                </span>
              )}
            </div>
            <span className="text-muted-foreground text-[11px] tabular-nums shrink-0">
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          {!failed && progress && progress.total > 0 && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="text-muted-foreground mt-1 flex items-center justify-between text-[11px] tabular-nums">
                <span>
                  {progress.completed.toLocaleString()} / {progress.total.toLocaleString()}
                  {progressUnit ? ` ${progressUnit}` : ""}
                </span>
                {percent != null && <span>{percent}%</span>}
              </div>
            </div>
          )}
          {!failed && (!progress || progress.total === 0) && (
            <div className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-[11px]">
              <Loader2 className="h-3 w-3 animate-spin" />
              working…
            </div>
          )}
          {!failed && latestActivity && (
            <div className="text-muted-foreground mt-1 truncate text-[11px]">
              {latestActivity}
            </div>
          )}
          {failed && job.error_message && (
            <div className="text-rose-700 mt-1 text-[12px] leading-snug">{job.error_message}</div>
          )}
        </div>
      </div>

      {/* Collapsible log */}
      {(job.log_tail?.length ?? 0) > 0 && (
        <div className="mt-2 border-t pt-2">
          <button
            type="button"
            onClick={() => setLogOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px] uppercase tracking-wider"
          >
            {logOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Log
          </button>
          {logOpen && (
            <pre className="text-muted-foreground/80 mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 font-mono text-[10.5px] leading-relaxed">
              {job.log_tail.slice(0, 30).join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatProgressUnit(
  label: string | undefined,
  phaseLabel: string,
  progressDetail: string | undefined,
  phase: SeoSyncJobPhase,
): string {
  if (!label) return "";
  if (label === phaseLabel || label === progressDetail) return defaultProgressUnit(phase);
  return label;
}

function defaultProgressUnit(phase: SeoSyncJobPhase): string {
  if (phase === "label" || phase === "match" || phase === "classify") return "clusters";
  if (phase === "embed") return "queries";
  if (phase === "upsert") return "pages";
  return "";
}

function formatLatestActivity(line: string | undefined, currentLabel: string): string | null {
  if (!line) return null;
  const activity = line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "").replace(/^▸\s*/, "");
  if (!activity || activity === currentLabel) return null;
  return activity;
}

function formatStats(job: SeoSyncJob): string {
  const parts: string[] = [];
  if (job.pages_processed != null) parts.push(`${job.pages_processed} pages`);
  const clusters = (job.clusters_created ?? 0) + (job.clusters_matched ?? 0);
  if (clusters > 0) {
    let s = `${clusters} clusters`;
    if (job.clusters_review_flagged) s += ` (${job.clusters_review_flagged} flagged)`;
    parts.push(s);
  }
  if (job.estimated_cost_usd > 0) parts.push(`$${job.estimated_cost_usd.toFixed(3)}`);
  return parts.join(", ");
}
