"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Info, Plus, Sparkles, Type } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSeoPages } from "@/hooks/queries";
import { SeoPageDrilldown } from "./seo-page-drilldown";
import { cn } from "@/lib/utils";
import type { SeoOppKind, SeoPage } from "../types";

export function SeoPagesTable() {
  const { data: pages, isLoading, isError, error } = useSeoPages();
  const [active, setActive] = useState<SeoPage | null>(null);

  const summary = useMemo(() => {
    if (!pages || pages.length === 0) return null;
    return pages.reduce(
      (acc, p) => {
        acc.earnings += Number(p.earnings_90d ?? 0);
        acc.conversions += p.conversions_90d ?? 0;
        acc.missed += p.open_missed_clicks ?? 0;
        acc.secondary += p.open_secondary ?? 0;
        acc.supporting += p.open_supporting ?? 0;
        acc.primary += p.open_primary ?? 0;
        acc.openTotal += p.open_opportunities ?? 0;
        return acc;
      },
      {
        earnings: 0,
        conversions: 0,
        missed: 0,
        secondary: 0,
        supporting: 0,
        primary: 0,
        openTotal: 0,
        pageCount: pages.length,
      },
    );
  }, [pages]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No pages synced yet. An admin can click &ldquo;Refresh Now&rdquo; to populate the table.
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      {summary && <SummaryHeader summary={summary} />}

      <div className="overflow-hidden rounded-lg border bg-card divide-y">
        {pages.map((p, i) => (
          <PageRow key={p.page} page={p} index={i} onOpen={setActive} />
        ))}
      </div>

      <SeoPageDrilldown
        page={active}
        open={!!active}
        onOpenChange={(next) => !next && setActive(null)}
      />
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary header — dashboard-wide totals so authors see the size of the queue.
// ─────────────────────────────────────────────────────────────────────────────

function SummaryHeader({
  summary,
}: {
  summary: {
    earnings: number;
    conversions: number;
    missed: number;
    secondary: number;
    supporting: number;
    primary: number;
    openTotal: number;
    pageCount: number;
  };
}) {
  return (
    <div className="rounded-lg border bg-gradient-to-br from-zinc-50 to-white p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryStat
          label="Pages tracked"
          value={summary.pageCount.toLocaleString()}
        />
        <SummaryStat
          label="Earnings · 90d"
          value={`$${Math.round(summary.earnings).toLocaleString()}`}
          help="Total affiliate revenue across these pages over the last 90 days."
        />
        <SummaryStat
          label="Open opportunities"
          value={summary.openTotal.toLocaleString()}
          sub={
            <span className="flex items-center gap-1.5 mt-1 text-[11px]">
              {summary.secondary > 0 && (
                <KindMark kind="secondary" count={summary.secondary} compact />
              )}
              {summary.supporting > 0 && (
                <KindMark kind="supporting" count={summary.supporting} compact />
              )}
              {summary.primary > 0 && (
                <KindMark kind="primary" count={summary.primary} compact />
              )}
            </span>
          }
        />
        <SummaryStat
          label="Clicks on the table"
          value={`+${summary.missed.toLocaleString()}/mo`}
          highlight
          help="Estimated extra clicks per month if every open opportunity reached the typical CTR for its current ranking position."
        />
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  help,
  highlight,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  help?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      {help ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-muted-foreground inline-flex items-center gap-1 text-[10px] uppercase tracking-wider cursor-help">
              {label}
              <Info className="h-2.5 w-2.5 opacity-60" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {help}
          </TooltipContent>
        </Tooltip>
      ) : (
        <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      )}
      <div
        className={cn(
          "text-foreground mt-1 text-2xl font-semibold tabular-nums leading-none tracking-tight",
          highlight && "text-amber-700",
        )}
      >
        {value}
      </div>
      {sub}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page row
// ─────────────────────────────────────────────────────────────────────────────

const KIND_ROW_META: Record<
  SeoOppKind,
  {
    label: string;
    verb: string;
    chip: string;
    dot: string;
    Icon: typeof Plus;
    stripe: string;
    glow: string;
  }
> = {
  secondary: {
    label: "section",
    verb: "add a section",
    chip: "bg-amber-100 text-amber-900 ring-amber-200",
    dot: "bg-amber-500",
    Icon: Plus,
    stripe: "bg-amber-500",
    glow: "from-amber-100/70 via-amber-50/40",
  },
  supporting: {
    label: "heading",
    verb: "promote to heading",
    chip: "bg-blue-100 text-blue-900 ring-blue-200",
    dot: "bg-blue-500",
    Icon: Type,
    stripe: "bg-blue-500",
    glow: "from-blue-100/70 via-blue-50/40",
  },
  primary: {
    label: "optimized",
    verb: "already optimized",
    chip: "bg-emerald-100 text-emerald-900 ring-emerald-200",
    dot: "bg-emerald-500",
    Icon: Sparkles,
    stripe: "bg-emerald-500",
    glow: "from-emerald-100/70 via-emerald-50/40",
  },
};

function dominantKind(p: SeoPage): SeoOppKind | null {
  if ((p.open_secondary ?? 0) > 0) return "secondary";
  if ((p.open_supporting ?? 0) > 0) return "supporting";
  if ((p.open_primary ?? 0) > 0) return "primary";
  return null;
}

function PageRow({
  page: p,
  index,
  onOpen,
}: {
  page: SeoPage;
  index: number;
  onOpen: (p: SeoPage) => void;
}) {
  const dom = dominantKind(p);
  const stripe = dom ? KIND_ROW_META[dom].stripe : "bg-zinc-200";
  const glow = dom ? KIND_ROW_META[dom].glow : "from-zinc-100/70 via-zinc-50/40";
  const earnings = Math.round(Number(p.earnings_90d ?? 0));
  const avgPos = p.avg_position != null ? Number(p.avg_position) : null;

  return (
    <div
      className="group/row relative bg-card animate-in fade-in fill-mode-both duration-500 cursor-pointer"
      style={{ animationDelay: `${index * 30}ms` }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(p)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(p);
        }
      }}
    >
      {/* Hover wash — gradient bleeds in from the left, tinted by dominant kind */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover/row:opacity-100 bg-gradient-to-r to-transparent",
          glow,
        )}
      />

      {/* Color stripe — widens on hover */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-[width] duration-300 ease-out group-hover/row:w-2",
          stripe,
        )}
      />

      <div className="relative grid grid-cols-12 gap-3 px-5 py-4 sm:gap-5 transition-[padding] duration-300 ease-out group-hover/row:pl-6">
        {/* Identity — col-span-5 */}
        <div className="col-span-12 sm:col-span-5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-sm font-medium text-foreground tracking-tight truncate">
              {p.page}
            </span>
            <a
              href={`https://www.hearingtracker.com${p.page}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 -translate-x-1 rounded p-0.5 opacity-0 transition-all duration-200 group-hover/row:translate-x-0 group-hover/row:opacity-100 focus:opacity-100"
              title="Open page in new tab"
              aria-label={`Open ${p.page} in a new tab`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {p.page_title && (
            <div className="text-muted-foreground text-xs truncate mt-0.5 max-w-md">
              {p.page_title}
            </div>
          )}
          <div className="text-muted-foreground/80 mt-1.5 flex items-center gap-2 text-[10px]">
            <span>
              synced {formatDistanceToNow(new Date(p.last_synced_at), { addSuffix: true })}
            </span>
            {p.meta_source && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">{p.meta_source}</span>
              </>
            )}
          </div>
        </div>

        {/* Opportunity breakdown — col-span-4 */}
        <div className="col-span-12 sm:col-span-4 min-w-0">
          <KindBreakdownBar p={p} />
          {p.top_query && p.top_kind && (
            <div className="mt-2 flex items-start gap-1.5 min-w-0">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider shrink-0 pt-[3px]">
                Top
              </span>
              <span className="min-w-0 text-[12px] leading-snug">
                <span className="text-foreground font-medium">&ldquo;{p.top_query}&rdquo;</span>
                <span className="text-muted-foreground"> · {KIND_ROW_META[p.top_kind].verb}</span>
              </span>
            </div>
          )}
        </div>

        {/* Money + potential — col-span-3 */}
        <div className="col-span-12 sm:col-span-3 flex flex-col items-start sm:items-end gap-1">
          <div className="flex items-baseline gap-2 sm:flex-row-reverse">
            <span className="text-foreground text-xl font-semibold tabular-nums leading-none tracking-tight">
              ${earnings.toLocaleString()}
            </span>
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
              90d
            </span>
          </div>
          <div className="text-muted-foreground text-[11px] tabular-nums">
            {p.conversions_90d} conv
            {avgPos != null && (
              <>
                {" · "}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">avg #{avgPos.toFixed(1)}</span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    Average Google ranking across this page&apos;s open opportunities.
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {(p.open_missed_clicks ?? 0) > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200/70 cursor-help">
                  <Sparkles className="h-3 w-3" />
                  +{p.open_missed_clicks.toLocaleString()}/mo
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                Estimated extra clicks/mo if this page hit the typical CTR for its current
                ranking position. Based on impressions × expected CTR − actual clicks across all
                open opportunities.
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
              no traffic gap
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kind breakdown — proportional segment bar + labeled chips
// ─────────────────────────────────────────────────────────────────────────────

function KindBreakdownBar({ p }: { p: SeoPage }) {
  const total =
    (p.open_secondary ?? 0) + (p.open_supporting ?? 0) + (p.open_primary ?? 0);
  if (total === 0) {
    return (
      <div className="text-muted-foreground/80 text-[12px] italic">no open opportunities</div>
    );
  }

  // Order: secondary (most actionable) → supporting → primary
  const allSegments: Array<{ kind: SeoOppKind; count: number }> = [
    { kind: "secondary", count: p.open_secondary ?? 0 },
    { kind: "supporting", count: p.open_supporting ?? 0 },
    { kind: "primary", count: p.open_primary ?? 0 },
  ];
  const segments = allSegments.filter((s) => s.count > 0);

  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        {segments.map((s) => (
          <Tooltip key={s.kind}>
            <TooltipTrigger asChild>
              <span
                className={cn("h-full transition-opacity hover:opacity-80 cursor-help", KIND_ROW_META[s.kind].dot)}
                style={{ width: `${(s.count / total) * 100}%` }}
                aria-label={`${s.count} ${KIND_ROW_META[s.kind].label}`}
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              {s.count} {s.count === 1 ? KIND_ROW_META[s.kind].label : `${KIND_ROW_META[s.kind].label}s`}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {segments.map((s) => (
          <KindMark key={s.kind} kind={s.kind} count={s.count} />
        ))}
      </div>
    </div>
  );
}

function KindMark({
  kind,
  count,
  compact,
}: {
  kind: SeoOppKind;
  count: number;
  compact?: boolean;
}) {
  const meta = KIND_ROW_META[kind];
  const label =
    kind === "secondary"
      ? compact
        ? "sections"
        : count === 1
          ? "section to add"
          : "sections to add"
      : kind === "supporting"
        ? compact
          ? "headings"
          : count === 1
            ? "heading to promote"
            : "headings to promote"
        : compact
          ? "optimized"
          : "already optimized";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset cursor-help",
            meta.chip,
          )}
        >
          <span className="tabular-nums">{count}</span>
          <span className="opacity-90">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {kind === "secondary" && "Pages where the keyword is missing — write a new section to capture this traffic."}
        {kind === "supporting" && "Pages where the keyword is in body copy but not in any heading — promote it to an H2."}
        {kind === "primary" && "Already in this page's title or H1 — no copy change needed, just monitor."}
      </TooltipContent>
    </Tooltip>
  );
}
