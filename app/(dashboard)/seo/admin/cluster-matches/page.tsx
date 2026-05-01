"use client";

// Phase 1A.5 — admin-only review screen for cluster matching decisions.
//
// Surfaces clusters where the matcher chose 'review' (combined score landed
// between the auto and review thresholds) so admins can sanity-check binding
// quality before the cluster ids carry forward into briefs and measurement.
// Read-only in 1A; override actions can come later.

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserRole } from "@/hooks/queries";
import { getClusterMatchesForReview, type ClusterMatchReviewRow } from "../../actions";
import { cn } from "@/lib/utils";

type Scope = "review" | "all_recent";

export default function ClusterMatchesPage() {
  const { data: role, isLoading: roleLoading } = useCurrentUserRole();
  const [scope, setScope] = useState<Scope>("review");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["seo", "admin", "cluster-matches", scope],
    queryFn: () => getClusterMatchesForReview({ scope, limit: 200 }),
    enabled: role === "admin",
  });

  if (roleLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="rounded-md border bg-card p-6 text-sm">
        <p className="text-foreground">Admin role required.</p>
        <p className="text-muted-foreground mt-1">
          This page reviews cluster-binding decisions made during sync.
        </p>
      </div>
    );
  }

  const counts = countByDecision(data ?? []);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4 min-w-0">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/seo">
              <ArrowLeft className="h-4 w-4" />
              Back to SEO
            </Link>
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground text-xl font-semibold tracking-tight">
              Cluster matches review
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Clusters whose binding to an existing row landed in the &ldquo;review&rdquo; band
              (between the review and auto thresholds), or whose drift guard kicked in. Use
              this to spot mis-bindings before they propagate into briefs.
            </p>
          </div>
          <ScopeToggle scope={scope} onChange={setScope} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <Pill label="auto" n={counts.auto} tone="emerald" />
          <Pill label="review" n={counts.review} tone="amber" />
          <Pill label="new" n={counts.new_} tone="blue" />
          <span className="ml-auto text-[11px]">
            Auto threshold ≥ {process.env.NEXT_PUBLIC_SEO_MATCH_AUTO_THRESHOLD ?? "0.72"} ·
            Review threshold ≥ {process.env.NEXT_PUBLIC_SEO_MATCH_REVIEW_THRESHOLD ?? "0.55"}
          </span>
        </div>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {isError && (
          <div className="rounded-md border bg-card p-4 text-sm text-destructive">
            Failed to load: {(error as Error).message}
          </div>
        )}

        {!isLoading && !isError && (data?.length ?? 0) === 0 && (
          <div className="rounded-md border border-dashed bg-card p-8 text-center">
            <p className="text-foreground text-sm">
              {scope === "review"
                ? "No clusters need review."
                : "No clusters yet — run a sync first."}
            </p>
          </div>
        )}

        {data && data.length > 0 && <MatchTable rows={data} />}
      </div>
    </TooltipProvider>
  );
}

function ScopeToggle({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  return (
    <div className="inline-flex rounded-md border bg-card p-0.5">
      {(
        [
          { v: "review", label: "Review queue" },
          { v: "all_recent", label: "All recent" },
        ] as const
      ).map(({ v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-colors",
            scope === v
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Pill({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone: "emerald" | "amber" | "blue";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
      : tone === "amber"
        ? "bg-amber-100 text-amber-900 ring-amber-200"
        : "bg-blue-100 text-blue-900 ring-blue-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        cls,
      )}
    >
      <span className="tabular-nums">{n}</span>
      <span>{label}</span>
    </span>
  );
}

function MatchTable({ rows }: { rows: ClusterMatchReviewRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-[10px] uppercase tracking-wider">
            <th className="px-4 py-2 font-medium">Page · cluster</th>
            <th className="px-4 py-2 font-medium">Decision</th>
            <th className="px-4 py-2 font-medium tabular-nums">Score</th>
            <th className="px-4 py-2 font-medium tabular-nums">Centroid</th>
            <th className="px-4 py-2 font-medium tabular-nums">Jaccard</th>
            <th className="px-4 py-2 font-medium tabular-nums">Label</th>
            <th className="px-4 py-2 font-medium">Members</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40 align-top">
              <td className="px-4 py-3">
                <div className="font-mono text-xs text-muted-foreground">{r.page}</div>
                <div className="text-foreground mt-0.5 font-medium">{r.label}</div>
                {r.matched_from_label && r.matched_from_label !== r.label && (
                  <div className="text-muted-foreground text-[10px] mt-0.5">
                    was: <span className="text-foreground">{r.matched_from_label}</span>
                  </div>
                )}
                {r.brand && (
                  <span className="mt-1 inline-flex rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-700">
                    {r.brand}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <DecisionPill decision={r.match_decision} />
              </td>
              <td className="px-4 py-3 tabular-nums">
                {r.match_score != null ? r.match_score.toFixed(3) : "—"}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {r.match_components?.centroid != null
                  ? r.match_components.centroid.toFixed(3)
                  : "—"}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {r.match_components?.jaccard != null
                  ? r.match_components.jaccard.toFixed(3)
                  : "—"}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {r.match_components?.label != null
                  ? r.match_components.label.toFixed(3)
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                      {r.member_count}
                      <Info className="h-3 w-3 opacity-60" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-md">
                    <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                      Member queries
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {r.member_queries.slice(0, 12).map((q) => (
                        <li key={q}>· {q}</li>
                      ))}
                      {r.member_queries.length > 12 && (
                        <li className="opacity-60">… +{r.member_queries.length - 12} more</li>
                      )}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionPill({ decision }: { decision: ClusterMatchReviewRow["match_decision"] }) {
  if (!decision) return <span className="text-muted-foreground">—</span>;
  const cls =
    decision === "auto"
      ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
      : decision === "review"
        ? "bg-amber-100 text-amber-900 ring-amber-200"
        : "bg-blue-100 text-blue-900 ring-blue-200";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        cls,
      )}
    >
      {decision}
    </span>
  );
}

function countByDecision(rows: ClusterMatchReviewRow[]): {
  auto: number; review: number; new_: number;
} {
  let auto = 0, review = 0, new_ = 0;
  for (const r of rows) {
    if (r.match_decision === "auto") auto++;
    else if (r.match_decision === "review") review++;
    else if (r.match_decision === "new") new_++;
  }
  return { auto, review, new_ };
}
