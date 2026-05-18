"use client";

// Left-rail TOC for the per-page SEO detail view. Two sections:
//   1. Status filter (all / open / in_progress / done) — controlled
//   2. Cluster list — clicking sets the active cluster (driven by URL state
//      from the parent; this component is presentational)
//
// On lg+ this renders as a sticky vertical rail. Below lg it collapses to a
// horizontal chip strip pinned beneath the masthead so mobile editors can
// still see and tap between clusters.

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getKindMeta } from "./kind-meta";
import type { SeoOpportunity } from "../types";

export type ClusterStatusFilter = "all" | "open" | "in_progress" | "done";

const STATUS_FILTER_LABELS: Record<ClusterStatusFilter, string> = {
  all:         "All",
  open:        "Open",
  in_progress: "In progress",
  done:        "Done",
};

const STATUS_FILTER_ORDER: ClusterStatusFilter[] = ["all", "open", "in_progress", "done"];

export function ClusterToc({
  opps,
  statusFilter,
  onStatusFilterChange,
  activeId,
  onSelect,
}: {
  opps: SeoOpportunity[];
  statusFilter: ClusterStatusFilter;
  onStatusFilterChange: (s: ClusterStatusFilter) => void;
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const filterCounts = useMemo(() => {
    const c: Record<ClusterStatusFilter, number> = {
      all: opps.length,
      open: 0,
      in_progress: 0,
      done: 0,
    };
    for (const o of opps) {
      if (o.status === "open" || o.status === "in_progress" || o.status === "done") {
        c[o.status] += 1;
      }
    }
    return c;
  }, [opps]);

  const visible = useMemo(
    () => (statusFilter === "all" ? opps : opps.filter((o) => o.status === statusFilter)),
    [opps, statusFilter],
  );

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Cluster navigation"
        className="hidden lg:block lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
      >
        <div className="space-y-5 pr-2">
          <StatusFilterStack
            filterCounts={filterCounts}
            statusFilter={statusFilter}
            onStatusFilterChange={onStatusFilterChange}
            layout="vertical"
          />

          <div>
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Clusters
            </div>
            {visible.length === 0 ? (
              <p className="px-1 text-[11px] text-muted-foreground/80">
                No clusters in this status.
              </p>
            ) : (
              <ul className="space-y-px">
                {visible.map((o, i) => {
                  const meta = getKindMeta(o.kind);
                  const isActive = activeId === o.id;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(o.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "group relative flex w-full items-start gap-2.5 rounded-md py-2 pl-3 pr-2 text-left transition-colors",
                          isActive
                            ? "bg-foreground/[0.06]"
                            : "hover:bg-foreground/[0.035]",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-y-1.5 left-0 rounded-full transition-all",
                            meta.tone.stripe,
                            isActive ? "w-1" : "w-[3px] opacity-80",
                          )}
                        />
                        <span className="mt-0.5 w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <span
                          className={cn(
                            "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded",
                            meta.tone.iconWrap,
                          )}
                        >
                          <meta.Icon className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-[13px] leading-snug line-clamp-2",
                              isActive ? "font-medium text-foreground" : "text-foreground/85",
                            )}
                          >
                            {o.cluster_label}
                          </span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
                            {meta.shortLabel}
                            <span className="opacity-60"> · {o.member_count}q</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile chip strip */}
      <div className="lg:hidden">
        <StatusFilterStack
          filterCounts={filterCounts}
          statusFilter={statusFilter}
          onStatusFilterChange={onStatusFilterChange}
          layout="horizontal"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {visible.length === 0 ? (
            <span className="text-[11px] text-muted-foreground/80">
              No clusters in this status
            </span>
          ) : (
            visible.map((o) => {
              const meta = getKindMeta(o.kind);
              const isActive = activeId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onSelect(o.id)}
                  title={o.cluster_label}
                  className={cn(
                    "inline-flex max-w-[14rem] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset transition-colors",
                    meta.tone.chip,
                    isActive && "ring-2 ring-foreground/70",
                  )}
                >
                  <meta.Icon className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{o.cluster_label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function StatusFilterStack({
  filterCounts,
  statusFilter,
  onStatusFilterChange,
  layout,
}: {
  filterCounts: Record<ClusterStatusFilter, number>;
  statusFilter: ClusterStatusFilter;
  onStatusFilterChange: (s: ClusterStatusFilter) => void;
  layout: "vertical" | "horizontal";
}) {
  return (
    <div>
      {layout === "vertical" && (
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </div>
      )}
      <div
        className={cn(
          layout === "vertical"
            ? "flex flex-col gap-px"
            : "flex w-fit items-center gap-1 rounded-full bg-background p-0.5 ring-1 ring-inset ring-border",
        )}
      >
        {STATUS_FILTER_ORDER.map((k) => {
          const active = statusFilter === k;
          if (layout === "vertical") {
            return (
              <button
                key={k}
                type="button"
                onClick={() => onStatusFilterChange(k)}
                aria-pressed={active}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "bg-foreground text-background font-medium"
                    : "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                <span>{STATUS_FILTER_LABELS[k]}</span>
                <span className="tabular-nums opacity-70">{filterCounts[k]}</span>
              </button>
            );
          }
          return (
            <button
              key={k}
              type="button"
              onClick={() => onStatusFilterChange(k)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-foreground/65 hover:text-foreground",
              )}
            >
              {STATUS_FILTER_LABELS[k]}
              <span className="ml-1 tabular-nums opacity-75">{filterCounts[k]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
