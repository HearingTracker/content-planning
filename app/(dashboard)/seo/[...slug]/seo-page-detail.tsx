"use client";

// Per-page SEO detail view at /seo/[...slug]. Refined-editorial layout:
//   • Masthead — breadcrumb, title, slug, primary actions, dominant-kind stripe
//   • KPI hero — earnings, conversions, open clusters, missed clicks (4 tiles)
//   • Site-wide context — full-width cross-page findings before cluster work
//   • Two-column body — sticky left-rail cluster TOC + a SINGLE active cluster
//     in the main column. Prev/next pager on top of the cluster lets editors
//     advance without scrolling; ?c={id} URL state makes specific clusters
//     deep-linkable and shareable.
//
// The cluster cards themselves are reused from cluster-card.tsx; this file
// owns the page chrome that frames them and the pager that drives selection.

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseAsInteger, useQueryStates } from "nuqs";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  MoreHorizontal,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useSeoOpportunities,
  useSeoPage,
  useSynthesisFindingsForPage,
} from "@/hooks/queries";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { ClusterCard } from "../components/cluster-card";
import { SiteWideContextCallout } from "../components/site-wide-context-callout";
import { ClusterToc, type ClusterStatusFilter } from "../components/cluster-toc";
import { dominantKind, getKindMeta } from "../components/kind-meta";
import type { SeoOpportunity, SeoPage, SeoSynthesisFinding } from "../types";

const HT_ORIGIN = "https://www.hearingtracker.com";

export function SeoPageDetail({ page }: { page: string }) {
  const { data: row, isLoading: rowLoading, isError, error } = useSeoPage(page);
  const { data: opps, isLoading: oppsLoading } = useSeoOpportunities(page);
  const { data: synthesis } = useSynthesisFindingsForPage(page);

  const [statusFilterTouched, setStatusFilterTouched] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ClusterStatusFilter>("open");
  const [urlState, setUrlState] = useQueryStates(
    { c: parseAsInteger },
    { history: "replace" },
  );

  const effectiveStatusFilter = useMemo<ClusterStatusFilter>(() => {
    if (!opps || opps.length === 0) return statusFilter;

    if (urlState.c != null) {
      const target = opps.find((o) => o.id === urlState.c);
      if (target) return statusToFilter(target.status);
    }

    if (statusFilterTouched) return statusFilter;
    if (statusFilter === "all" || opps.some((o) => o.status === statusFilter)) {
      return statusFilter;
    }

    return preferredNonEmptyStatusFilter(opps);
  }, [opps, statusFilter, statusFilterTouched, urlState.c]);

  const visibleOpps = useMemo(() => {
    if (!opps) return [];
    if (effectiveStatusFilter === "all") return opps;
    return opps.filter((o) => o.status === effectiveStatusFilter);
  }, [opps, effectiveStatusFilter]);

  // Active cluster: URL ?c={id} when valid in the current filter, else first
  // visible. Falls back to first "ready" actionable cluster when no URL hint —
  // matches the old drawer's open-time scroll behavior so deep-linked /seo/X
  // lands on the actionable item.
  const activeOpp = useMemo<SeoOpportunity | null>(() => {
    if (visibleOpps.length === 0) return null;
    if (urlState.c != null) {
      const found = visibleOpps.find((o) => o.id === urlState.c);
      if (found) return found;
    }
    return visibleOpps.find((o) => o.actionability === "ready") ?? visibleOpps[0];
  }, [visibleOpps, urlState.c]);

  // When the active cluster genuinely disappears, clear the URL hint. If it is
  // only hidden by the user's manual filter, keep the URL until the filter
  // handler clears it intentionally.
  useEffect(() => {
    if (!opps) return;
    if (urlState.c == null) return;
    const target = opps.find((o) => o.id === urlState.c);
    if (target && statusToFilter(target.status) !== effectiveStatusFilter) return;
    const stillVisible = visibleOpps.some((o) => o.id === urlState.c);
    if (!stillVisible) setUrlState({ c: null });
  }, [opps, effectiveStatusFilter, urlState.c, visibleOpps, setUrlState]);

  const currentIndex = activeOpp
    ? visibleOpps.findIndex((o) => o.id === activeOpp.id)
    : -1;
  const prevOpp = currentIndex > 0 ? visibleOpps[currentIndex - 1] : null;
  const nextOpp =
    currentIndex >= 0 && currentIndex < visibleOpps.length - 1
      ? visibleOpps[currentIndex + 1]
      : null;

  const goTo = (id: number | null) => setUrlState({ c: id });
  const changeStatusFilter = (next: ClusterStatusFilter) => {
    setStatusFilterTouched(true);
    setStatusFilter(next);
    if (urlState.c != null) setUrlState({ c: null });
  };

  // Page row failed to load — treat a confirmed null as 404.
  if (!rowLoading && row === null) {
    notFound();
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load page: {(error as Error).message}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-7xl space-y-6">
        <Breadcrumb page={page} pageTitle={row?.page_title ?? null} loading={rowLoading} />

        <Masthead
          page={page}
          row={row ?? null}
          opps={opps ?? null}
          loading={rowLoading}
        />

        {(synthesis?.length ?? 0) > 0 && (
          <SiteWideContextCallout currentPage={page} findings={synthesis ?? []} />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <ClusterToc
            opps={opps ?? []}
            statusFilter={effectiveStatusFilter}
            onStatusFilterChange={changeStatusFilter}
            activeId={activeOpp?.id ?? null}
            onSelect={goTo}
          />

          <MainColumn
            currentPage={page}
            visibleOpps={visibleOpps}
            allOpps={opps ?? null}
            activeOpp={activeOpp}
            currentIndex={currentIndex}
            prevOpp={prevOpp}
            nextOpp={nextOpp}
            synthesis={synthesis ?? []}
            loading={oppsLoading}
            statusFilter={effectiveStatusFilter}
            onResetFilter={() => changeStatusFilter("all")}
            onGoTo={goTo}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

function statusToFilter(status: SeoOpportunity["status"]): ClusterStatusFilter {
  return status === "open" || status === "in_progress" || status === "done"
    ? status
    : "all";
}

function preferredNonEmptyStatusFilter(opps: SeoOpportunity[]): ClusterStatusFilter {
  if (opps.some((o) => o.status === "open")) return "open";
  if (opps.some((o) => o.status === "in_progress")) return "in_progress";
  if (opps.some((o) => o.status === "done")) return "done";
  return "all";
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────

function Breadcrumb({
  page,
  pageTitle,
  loading,
}: {
  page: string;
  pageTitle: string | null;
  loading: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
      <Link
        href="/seo"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        SEO
      </Link>
      <span className="text-muted-foreground/50">/</span>
      {loading ? (
        <Skeleton className="h-3 w-48" />
      ) : (
        <span className="truncate text-muted-foreground">
          {pageTitle || page}
        </span>
      )}
    </nav>
  );
}

// ─── Masthead + KPI hero ───────────────────────────────────────────────────

function Masthead({
  page,
  row,
  opps,
  loading,
}: {
  page: string;
  row: SeoPage | null;
  opps: SeoOpportunity[] | null;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const liveUrl = `${HT_ORIGIN}${page}`;

  const dominant = row ? dominantKind(row) : null;
  const stripeClass = dominant ? getKindMeta(dominant).tone.stripe : "bg-border";

  const kpis = useKpis(row, opps);

  const copyUrl = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(liveUrl).then(
      () => toast.success("Copied URL"),
      () => toast.error("Couldn't copy"),
    );
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: queryKeys.seo.all });
    toast.success("Refreshing");
  };

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className={cn("h-px w-full", stripeClass)} aria-hidden />
      <div className="flex flex-col gap-4 px-6 pt-6 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          {loading || !row ? (
            <>
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
                {row.page_title || "(no title)"}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono hover:text-foreground hover:underline decoration-1 underline-offset-4"
                >
                  {row.page}
                </a>
                <span className="opacity-40">·</span>
                <span>90d window</span>
                {row.meta_source && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="font-mono">{row.meta_source}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
            <a href={liveUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open page
            </a>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={copyUrl}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={refresh}>
                <RotateCw className="mr-2 h-3.5 w-3.5" /> Refresh data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <KpiStrip kpis={kpis} loading={loading || !row} />
    </section>
  );
}

type Kpi = { label: string; value: string; sub: string };

function useKpis(row: SeoPage | null, opps: SeoOpportunity[] | null): Kpi[] {
  return useMemo<Kpi[]>(() => {
    const earnings = row?.earnings_90d ?? 0;
    const conversions = row?.conversions_90d ?? 0;
    const total = opps?.length ?? 0;
    const open = (opps ?? []).filter((o) => o.status === "open").length;
    const missedClicks = (opps ?? [])
      .filter((o) => o.status === "open")
      .reduce((acc, o) => acc + Number(o.total_missed_clicks ?? 0), 0);

    return [
      {
        label: "Earnings",
        value: `$${Math.round(earnings).toLocaleString()}`,
        sub: "90d",
      },
      {
        label: "Conversions",
        value: conversions.toLocaleString(),
        sub: "90d",
      },
      {
        label: "Open clusters",
        value: `${open}`,
        sub: total > 0 ? `of ${total} total` : "—",
      },
      {
        label: "Missed clicks",
        value: missedClicks > 0 ? `+${Math.round(missedClicks).toLocaleString()}` : "—",
        sub: "/mo across open",
      },
    ];
  }, [row, opps]);
}

function KpiStrip({ kpis, loading }: { kpis: Kpi[]; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.label} className="bg-card px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {k.label}
          </div>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-24" />
          ) : (
            <div className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-foreground">
              {k.value}
            </div>
          )}
          <div className="mt-0.5 text-xs text-muted-foreground">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main column ──────────────────────────────────────────────────────────

function MainColumn({
  currentPage,
  visibleOpps,
  allOpps,
  activeOpp,
  currentIndex,
  prevOpp,
  nextOpp,
  synthesis,
  loading,
  statusFilter,
  onResetFilter,
  onGoTo,
}: {
  currentPage: string;
  visibleOpps: SeoOpportunity[];
  allOpps: SeoOpportunity[] | null;
  activeOpp: SeoOpportunity | null;
  currentIndex: number;
  prevOpp: SeoOpportunity | null;
  nextOpp: SeoOpportunity | null;
  synthesis: SeoSynthesisFinding[];
  loading: boolean;
  statusFilter: ClusterStatusFilter;
  onResetFilter: () => void;
  onGoTo: (id: number) => void;
}) {
  return (
    <div className="min-w-0 space-y-4">
      {loading && <Skeleton className="h-[28rem] w-full" />}

      {!loading && (allOpps?.length ?? 0) === 0 && (
        <div className="rounded-lg border border-dashed bg-card py-10 text-center">
          <p className="text-sm text-foreground">No open clusters for this page.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try lowering the cron min-impressions threshold or wait for the next sync.
          </p>
        </div>
      )}

      {!loading && (allOpps?.length ?? 0) > 0 && visibleOpps.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card py-6 text-center">
          <p className="text-xs text-muted-foreground">
            No clusters in {statusLabel(statusFilter)}.{" "}
            <button
              type="button"
              onClick={onResetFilter}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Show all
            </button>
          </p>
        </div>
      )}

      {activeOpp && (
        <>
          <Pager
            current={currentIndex + 1}
            total={visibleOpps.length}
            prev={prevOpp}
            next={nextOpp}
            onGoTo={onGoTo}
          />
          <ClusterCard
            key={activeOpp.id}
            opp={activeOpp}
            delay={0}
            currentPage={currentPage}
            siteFindings={synthesis ?? []}
          />
        </>
      )}
    </div>
  );
}

function Pager({
  current,
  total,
  prev,
  next,
  onGoTo,
}: {
  current: number;
  total: number;
  prev: SeoOpportunity | null;
  next: SeoOpportunity | null;
  onGoTo: (id: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <PagerSide
        side="prev"
        opp={prev}
        onGoTo={onGoTo}
      />

      <div className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground tabular-nums">
        Cluster <span className="text-foreground font-semibold">{current}</span>
        <span className="opacity-60"> / {total}</span>
      </div>

      <PagerSide
        side="next"
        opp={next}
        onGoTo={onGoTo}
      />
    </div>
  );
}

function PagerSide({
  side,
  opp,
  onGoTo,
}: {
  side: "prev" | "next";
  opp: SeoOpportunity | null;
  onGoTo: (id: number) => void;
}) {
  if (!opp) {
    return <span className="w-32 sm:w-48" aria-hidden />;
  }
  const meta = getKindMeta(opp.kind);
  const Icon = side === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={() => onGoTo(opp.id)}
      className={cn(
        "group flex min-w-0 max-w-[12rem] items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-muted sm:max-w-xs",
        side === "next" && "flex-row-reverse text-right",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
          {side === "prev" ? "Previous" : "Next"} · {meta.shortLabel}
        </span>
        <span className="block truncate text-foreground/90">{opp.cluster_label}</span>
      </span>
    </button>
  );
}

function statusLabel(s: ClusterStatusFilter): string {
  if (s === "all") return "any status";
  if (s === "in_progress") return "in-progress";
  return s;
}
