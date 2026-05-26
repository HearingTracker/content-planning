"use client";

// SEO pages table — one editorial row per revenue page, summary header strip
// across the top. Cluster-aware: uses the new kind keys from
// cp_seo_opportunity_kinds via getKindMeta(). Stripe + hover tint on each
// row are tinted by the most-actionable kind currently open on that page.
//
// Sort/search/filter state is held in the URL via nuqs so an editor's view is
// shareable and survives reloads. The drawer's open state is also in the URL
// (?page=/some-slug) — opened from a row, closed on Esc / outside-click.

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  useQueryStates,
  parseAsString,
  parseAsStringLiteral,
  parseAsBoolean,
} from "nuqs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, ExternalLink, Eye, EyeOff, Info, Search, Sparkles, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSeoPages } from "@/hooks/queries";
import Link from "next/link";
import {
  KIND_COUNT_FIELDS,
  KIND_META,
  dominantKind,
  getKindMeta,
  nonZeroKindCounts,
} from "./kind-meta";
import { cn } from "@/lib/utils";
import type { SeoOppKindKey, SeoOppStatus, SeoPage } from "../types";

const KIND_KEYS = Object.keys(KIND_META) as SeoOppKindKey[];

// Sort options exposed in the toolbar. Keyed by `${field}:${dir}` so the URL
// param is a single string and we don't need a custom parser for the SortingState.
const SORT_OPTIONS = [
  { value: "earnings_90d:desc",      label: "Earnings (high → low)",    sortKey: "earnings_90d",      desc: true  },
  { value: "task_status:asc",        label: "Task status (open first)",  sortKey: "task_status_rank",  desc: false },
  { value: "open_missed_clicks:desc",label: "Missed clicks (high → low)", sortKey: "open_missed_clicks", desc: true },
  { value: "max_score:desc",         label: "Priority score (high → low)", sortKey: "max_score",       desc: true  },
  { value: "avg_position:asc",       label: "Avg rank (best first)",      sortKey: "avg_position",    desc: false },
  { value: "page:asc",               label: "Page (A → Z)",               sortKey: "page",            desc: false },
  { value: "last_synced_at:desc",    label: "Last synced (newest)",       sortKey: "last_synced_at",  desc: true  },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];
const SORT_VALUES = SORT_OPTIONS.map((o) => o.value) as readonly SortValue[];
const DEFAULT_SORT: SortValue = "earnings_90d:desc";

const STATUS_SORT_RANK: Record<SeoOppStatus, number> = {
  open: 0,
  in_progress: 1,
  done: 2,
  dismissed: 3,
};

const STATUS_META: Record<SeoOppStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-blue-50 text-blue-800 ring-blue-200",
  },
  in_progress: {
    label: "In progress",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  done: {
    label: "Done",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  dismissed: {
    label: "Dismissed",
    className: "bg-zinc-50 text-zinc-600 ring-zinc-200",
  },
};

function sortValueToState(value: SortValue): SortingState {
  const opt = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
  return [{ id: opt.sortKey, desc: opt.desc }];
}

export function SeoPagesTable() {
  const { data: pages, isLoading, isError, error } = useSeoPages();

  const [urlState, setUrlState] = useQueryStates(
    {
      kind: parseAsStringLiteral(KIND_KEYS),
      q: parseAsString.withDefault(""),
      sort: parseAsStringLiteral(SORT_VALUES).withDefault(DEFAULT_SORT),
      hideEmpty: parseAsBoolean.withDefault(false),
    },
    { history: "push" },
  );

  // Tanstack table runs in headless mode — it owns sort + filter state but the
  // rows render as the existing PageRow component, not as <TableCell>s. This
  // preserves the card-style layout (stripe, hover wash, animate-in) that the
  // editorial design depends on.
  const columns = useMemo<ColumnDef<SeoPage>[]>(
    () => [
      { id: "page", accessorKey: "page" },
      { id: "page_title", accessorKey: "page_title" },
      {
        id: "earnings_90d",
        accessorFn: (row) => Number(row.earnings_90d ?? 0),
      },
      {
        id: "open_missed_clicks",
        accessorFn: (row) => Number(row.open_missed_clicks ?? 0),
      },
      {
        id: "max_score",
        accessorFn: (row) => Number(row.max_score ?? 0),
      },
      {
        id: "task_status_rank",
        accessorFn: (row) => {
          const status = pageTaskStatus(row);
          return status ? STATUS_SORT_RANK[status] : Number.MAX_SAFE_INTEGER;
        },
      },
      {
        id: "avg_position",
        accessorFn: (row) => (row.avg_position == null ? Number.MAX_SAFE_INTEGER : Number(row.avg_position)),
      },
      { id: "last_synced_at", accessorKey: "last_synced_at" },
    ],
    [],
  );

  const sortingState = useMemo(() => sortValueToState(urlState.sort), [urlState.sort]);

  const table = useReactTable({
    data: pages ?? [],
    columns,
    state: {
      sorting: sortingState,
      globalFilter: urlState.q,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue ?? "").trim().toLowerCase();
      if (!q) return true;
      const p = row.original;
      return (
        p.page.toLowerCase().includes(q)
        || (p.page_title ?? "").toLowerCase().includes(q)
        || (p.top_query ?? "").toLowerCase().includes(q)
      );
    },
  });

  // Filter is a linear scan over an already-sorted small array (table.getRowModel
  // does the sort + search). No memoization — every render recomputes cheaply,
  // and the tanstack model reference is unstable in ways React Compiler can't see.
  const filteredPages = (() => {
    let result = table.getRowModel().rows.map((r) => r.original);
    if (urlState.kind) {
      const field = KIND_COUNT_FIELDS.find((f) => f.key === urlState.kind)?.field;
      if (field) result = result.filter((p) => Number(p[field] ?? 0) > 0);
    }
    if (urlState.hideEmpty) {
      result = result.filter((p) => (p.open_missed_clicks ?? 0) > 0);
    }
    return result;
  })();

  const summary = useMemo(() => {
    if (!pages || pages.length === 0) return null;
    return pages.reduce(
      (acc, p) => {
        acc.earnings += Number(p.earnings_90d ?? 0);
        acc.conversions += p.conversions_90d ?? 0;
        acc.missed += p.open_missed_clicks ?? 0;
        acc.openTotal += p.open_clusters ?? p.open_opportunities ?? 0;
        for (const { key, field } of KIND_COUNT_FIELDS) {
          acc.byKind[key] = (acc.byKind[key] ?? 0) + Number(p[field] ?? 0);
        }
        return acc;
      },
      {
        earnings: 0,
        conversions: 0,
        missed: 0,
        openTotal: 0,
        pageCount: pages.length,
        byKind: {} as Record<SeoOppKindKey, number>,
      },
    );
  }, [pages]);

  const lastSyncedAt = useMemo(() => {
    if (!pages || pages.length === 0) return null;
    return pages.reduce<string | null>((latest, p) => {
      if (!p.last_synced_at) return latest;
      if (!latest) return p.last_synced_at;
      return p.last_synced_at > latest ? p.last_synced_at : latest;
    }, null);
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
          No pages synced yet. An admin can click &ldquo;Refresh now&rdquo; to populate the table.
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      {summary && (
        <OverviewHeader
          summary={summary}
          lastSyncedAt={lastSyncedAt}
          activeKind={urlState.kind ?? null}
          onToggleKind={(k) =>
            setUrlState({ kind: urlState.kind === k ? null : k })
          }
        />
      )}

      <Toolbar
        q={urlState.q}
        onQChange={(q) => setUrlState({ q })}
        sort={urlState.sort}
        onSortChange={(sort) => setUrlState({ sort })}
        hideEmpty={urlState.hideEmpty}
        onHideEmptyChange={(hideEmpty) => setUrlState({ hideEmpty })}
        visibleCount={filteredPages.length}
        totalCount={pages.length}
        hasSearch={urlState.q.trim().length > 0}
        hasKindFilter={urlState.kind != null}
        onClearFilters={() => setUrlState({ q: "", kind: null, hideEmpty: false })}
      />

      <div
        id="seo-pages-list"
        className="mt-3 overflow-hidden rounded-lg border bg-card divide-y"
      >
        {filteredPages.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No pages match your filters.{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => setUrlState({ q: "", kind: null, hideEmpty: false })}
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredPages.map((p, i) => (
            <PageRow key={p.page} page={p} index={i} />
          ))
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────
// Search + sort + hide-empty controls. Mirrors the search-input convention from
// app/(dashboard)/content/components/content-filters.tsx (controlled, no debounce).

function Toolbar({
  q,
  onQChange,
  sort,
  onSortChange,
  hideEmpty,
  onHideEmptyChange,
  visibleCount,
  totalCount,
  hasSearch,
  hasKindFilter,
  onClearFilters,
}: {
  q: string;
  onQChange: (q: string) => void;
  sort: SortValue;
  onSortChange: (s: SortValue) => void;
  hideEmpty: boolean;
  onHideEmptyChange: (v: boolean) => void;
  visibleCount: number;
  totalCount: number;
  hasSearch: boolean;
  hasKindFilter: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <div className="relative min-w-0 flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search pages"
          aria-controls="seo-pages-list"
          placeholder="Search by page slug, title, or top query…"
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          className="h-8 pl-8 pr-7 text-sm"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQChange("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <Select value={sort} onValueChange={(v) => onSortChange(v as SortValue)}>
        <SelectTrigger className="h-8 w-[220px] text-xs" aria-label="Sort pages">
          <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant={hideEmpty ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => onHideEmptyChange(!hideEmpty)}
        aria-pressed={hideEmpty}
        aria-controls="seo-pages-list"
      >
        {hideEmpty ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        <span className="text-xs">
          {hideEmpty ? "Hidden: no-gap pages" : "Show all"}
        </span>
      </Button>

      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {visibleCount} of {totalCount}
        </span>
        {(hasSearch || hasKindFilter || hideEmpty) && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded px-2 py-1 underline underline-offset-2 hover:bg-zinc-100 hover:text-foreground"
          >
            clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Overview header ───────────────────────────────────────────────────────
// Hero zone leads with the actual prize (missed clicks/mo). Distribution zone
// renders a clickable stacked bar + chips that drive the row filter below.

function OverviewHeader({
  summary,
  lastSyncedAt,
  activeKind,
  onToggleKind,
}: {
  summary: {
    earnings: number;
    conversions: number;
    missed: number;
    openTotal: number;
    pageCount: number;
    byKind: Partial<Record<SeoOppKindKey, number>>;
  };
  lastSyncedAt: string | null;
  activeKind: SeoOppKindKey | null;
  onToggleKind: (k: SeoOppKindKey) => void;
}) {
  // Hover state for the inline glossary line below the chips. Hover takes
  // precedence over the active filter so the user can preview a kind without
  // losing their current filter selection.
  const [hoveredKind, setHoveredKind] = useState<SeoOppKindKey | null>(null);
  const explainKind = hoveredKind ?? activeKind;

  const kindEntries = KIND_COUNT_FIELDS.map(({ key }) => ({
    key,
    n: summary.byKind[key] ?? 0,
  })).filter((e) => e.n > 0);

  const totalKindCount = kindEntries.reduce((s, e) => s + e.n, 0);
  const dollarsPerConv = summary.conversions > 0 ? summary.earnings / summary.conversions : null;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_24px_-12px_rgba(0,0,0,0.08)]">
      {/* Subtle decorative paper grain — keeps it from feeling sterile */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(0 0 0) 1px, transparent 0)",
          backgroundSize: "14px 14px",
        }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-12">
        {/* ── Hero zone — col-span-5 ───────────────────────────────────── */}
        <div className="lg:col-span-5 relative p-5 sm:p-6 bg-gradient-to-br from-amber-50/70 via-white to-white">
          {/* Right-edge hairline divider on desktop */}
          <div
            aria-hidden
            className="hidden lg:block absolute inset-y-5 right-0 w-px bg-gradient-to-b from-transparent via-zinc-200 to-transparent"
          />

          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-800/80">
            <Sparkles className="h-3 w-3" />
            <span>Raw monthly lift</span>
          </div>

          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-[44px] sm:text-[52px] font-semibold leading-none tabular-nums tracking-tight text-amber-900">
              +{summary.missed.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">clicks / mo</span>
          </div>

          {/* A1: caveat pill — promoted from a muted prose line to an
              unmissable badge so editors don't take the hero number at face
              value. The full calculation explanation stays on the badge's
              tooltip. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200 cursor-help">
                <Info className="h-3 w-3" />
                raw ceiling · pre-cap
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              For each open cluster: impressions × expected CTR by average position minus actual
              clicks. Cluster cards discount this where AIO, canonical ownership, or rank caps apply.
            </TooltipContent>
          </Tooltip>

          {/* Hero stat bar */}
          <div className="mt-5 grid grid-cols-3 gap-4 border-t pt-4">
            <HeroStat label="Pages tracked" value={summary.pageCount.toLocaleString()} />
            <HeroStat
              label="Open clusters"
              value={summary.openTotal.toLocaleString()}
            />
            <HeroStat
              label="Earnings · 90d"
              value={`$${Math.round(summary.earnings).toLocaleString()}`}
              sub={
                dollarsPerConv != null ? (
                  <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                    ${dollarsPerConv.toFixed(0)} / conv
                  </span>
                ) : null
              }
            />
          </div>
        </div>

        {/* ── Distribution zone — col-span-7 ───────────────────────────── */}
        <div className="lg:col-span-7 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground cursor-help">
                  Work distribution
                  <Info className="h-2.5 w-2.5 opacity-60" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {totalKindCount} open clusters across all pages, broken down by the action
                type. Click a kind to filter the table.
              </TooltipContent>
            </Tooltip>

            {activeKind ? (
              <button
                type="button"
                onClick={() => onToggleKind(activeKind)}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-zinc-700"
              >
                <X className="h-3 w-3" />
                Showing {KIND_META[activeKind].shortLabel.toLowerCase()} only
              </button>
            ) : (
              // A2: visible on every viewport. Touch users need the hint more
              // than desktop users since hover-discovery doesn't exist there.
              <span className="text-[11px] text-muted-foreground/80">
                click a chip to filter
              </span>
            )}
          </div>

          {/* Stacked bar — clickable segments */}
          {totalKindCount > 0 ? (
            <div
              className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 ring-1 ring-inset ring-zinc-200/70"
              role="group"
              aria-label="Open clusters by kind"
            >
              {kindEntries.map(({ key, n }) => {
                const meta = KIND_META[key];
                const isActive = activeKind === key;
                const isDimmed = activeKind != null && !isActive;
                const pct = (n / totalKindCount) * 100;
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onToggleKind(key)}
                        className={cn(
                          "h-full transition-all duration-200 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
                          meta.tone.stripe,
                          isDimmed && "opacity-25",
                          isActive && "ring-2 ring-inset ring-white/60",
                        )}
                        style={{ width: `${pct}%` }}
                        aria-label={`${n} ${meta.displayLabel} — ${pct.toFixed(0)}%`}
                        aria-pressed={isActive}
                        aria-controls="seo-pages-list"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span className="font-medium">{meta.displayLabel}</span> · {n} clusters
                      · {pct.toFixed(0)}%
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 h-3 w-full rounded-full bg-zinc-100" />
          )}

          {/* Filter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {kindEntries.length === 0 ? (
              <span className="text-xs italic text-muted-foreground/80">
                No open clusters across the synced pages.
              </span>
            ) : (
              kindEntries.map(({ key, n }) => {
                const meta = KIND_META[key];
                const isActive = activeKind === key;
                const isDimmed = activeKind != null && !isActive;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onToggleKind(key)}
                    onMouseEnter={() => setHoveredKind(key)}
                    onMouseLeave={() => setHoveredKind(null)}
                    onFocus={() => setHoveredKind(key)}
                    onBlur={() => setHoveredKind(null)}
                    aria-pressed={isActive}
                    aria-controls="seo-pages-list"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                      meta.tone.chip,
                      isDimmed && "opacity-40 hover:opacity-70",
                      isActive && "ring-2 ring-zinc-900 ring-offset-1 shadow-sm",
                    )}
                  >
                    <meta.Icon className="h-3 w-3" />
                    <span className="tabular-nums">{n}</span>
                    <span className="opacity-90">{meta.shortLabel.toLowerCase()}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Inline glossary — explains the hovered/active chip in plain
              English. Min-height keeps the chip row from jumping when the
              text appears/disappears. */}
          {kindEntries.length > 0 && (
            <div className="mt-2 min-h-[2.4em] text-xs leading-snug">
              {explainKind ? (
                <>
                  <span className="font-medium text-foreground">
                    {KIND_META[explainKind].displayLabel}:
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {KIND_META[explainKind].description}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground/70 italic">
                  Each chip is one kind of edit needed across all open clusters — hover
                  to see what it means, click to filter the table.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: sync recency. A3: data-source list moved into the tooltip so
          the footer scans as a single "is the data fresh?" line. */}
      {lastSyncedAt && (
        <div className="relative flex items-center justify-between border-t bg-zinc-50/60 px-5 py-2 sm:px-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-help">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/60 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span>
                  Synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
                </span>
                <Info className="h-2.5 w-2.5 opacity-60" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              Data pulled from Storyblok (page metadata), Google Search Console (clicks /
              impressions), and DataForSEO (search volume + SERP snapshots).
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

// ─── Page row ──────────────────────────────────────────────────────────────

function PageRow({
  page: p,
  index,
}: {
  page: SeoPage;
  index: number;
}) {
  const dom = dominantKind(p);
  const dominantMeta = dom ? KIND_META[dom] : null;
  const stripe = dominantMeta?.tone.stripe ?? "bg-zinc-200";
  const glow = dominantMeta?.tone.glow ?? "from-zinc-100/70 via-zinc-50/40";
  const earnings = Math.round(Number(p.earnings_90d ?? 0));
  const avgPos = p.avg_position != null ? Number(p.avg_position) : null;
  const topKindMeta = p.top_kind ? getKindMeta(p.top_kind) : null;

  return (
    <Link
      href={`/seo${p.page}`}
      className={cn(
        "group/row relative block bg-card animate-in fade-in fill-mode-both duration-500",
        // A5: keyboard focus indicator on the row itself. The nested <a>
        // already has a focus state; the row didn't, so tab navigation went
        // blind across the table.
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900",
      )}
      style={{ animationDelay: `${index * 30}ms` }}
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
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(`https://www.hearingtracker.com${p.page}`, "_blank", "noopener");
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 -translate-x-1 rounded p-0.5 opacity-0 transition-all duration-200 group-hover/row:translate-x-0 group-hover/row:opacity-100 focus:opacity-100"
              title="Open page in new tab"
              aria-label={`Open ${p.page} in a new tab`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
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
            <TaskStatusBadge page={p} />
          </div>
        </div>

        {/* Cluster breakdown + top opportunity — col-span-4 */}
        <div className="col-span-12 sm:col-span-4 min-w-0">
          <KindBreakdownBar p={p} />
          {p.top_query && topKindMeta && (
            <div className="mt-2 flex items-start gap-1.5 min-w-0">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider shrink-0 pt-[3px]">
                Top
              </span>
              <span className="min-w-0 text-xs leading-snug">
                <span className="text-foreground font-medium">{p.top_query}</span>
                {p.top_member_count != null && p.top_member_count > 1 && (
                  <span className="text-muted-foreground"> · {p.top_member_count} queries</span>
                )}
                <span className="text-muted-foreground"> · {topKindMeta.actionVerb}</span>
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
                    Average Google ranking across this page&apos;s open clusters.
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
                Raw extra clicks/mo before SERP caps. Cluster cards discount this where AIO,
                canonical ownership, or rank caps apply.
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
              no traffic gap
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function pageTaskStatus(p: SeoPage): SeoOppStatus | null {
  if (
    p.task_status === "open" ||
    p.task_status === "in_progress" ||
    p.task_status === "done" ||
    p.task_status === "dismissed"
  ) {
    return p.task_status;
  }
  return Number(p.open_clusters ?? p.open_opportunities ?? 0) > 0 ? "open" : null;
}

function pageTaskStatusCount(p: SeoPage, status: SeoOppStatus): number {
  if (status === "open") {
    return Number(p.task_open_count ?? p.open_clusters ?? p.open_opportunities ?? 0);
  }
  if (status === "in_progress") return Number(p.task_in_progress_count ?? 0);
  if (status === "done") return Number(p.task_done_count ?? 0);
  return Number(p.task_dismissed_count ?? 0);
}

function TaskStatusBadge({ page }: { page: SeoPage }) {
  const status = pageTaskStatus(page);
  if (!status) return null;
  const meta = STATUS_META[status];
  const count = pageTaskStatusCount(page, status);

  return (
    <>
      <span aria-hidden className="opacity-40">·</span>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
          meta.className,
        )}
      >
        {count > 0 ? `${count} ` : ""}
        {meta.label.toLowerCase()}
      </span>
    </>
  );
}

// ─── Kind breakdown bar ────────────────────────────────────────────────────

function KindBreakdownBar({ p }: { p: SeoPage }) {
  // Fallback for kinds not yet in KIND_COUNT_FIELDS (consolidate / cede /
  // ai_overview_loss): if the per-kind columns sum to zero but the page has
  // a top cluster classified as one of those kinds, surface it as a single
  // segment so the row isn't self-contradictory ("no open clusters" shown
  // next to a TOP line referencing one).
  let segments = nonZeroKindCounts(p);
  const openClusters = Number(p.open_clusters ?? 0);
  if (segments.length === 0 && p.top_kind && openClusters > 0) {
    segments = [{ key: p.top_kind, count: openClusters }];
  }

  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) {
    return (
      <div className="text-muted-foreground/80 text-xs italic">no open clusters</div>
    );
  }

  return (
    // A4: bar is now h-2 (was h-1.5) for better visibility, and each segment
    // is a focusable <button> so keyboard users can tab through the breakdown.
    // Click stops propagation so it doesn't open the row's drawer accidentally.
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      {segments.map((s) => {
        const meta = KIND_META[s.key];
        return (
          <Tooltip key={s.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={cn(
                  "h-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-inset",
                  meta.tone.stripe,
                )}
                style={{ width: `${(s.count / total) * 100}%` }}
                aria-label={`${s.count} ${meta.displayLabel}`}
              />
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="font-medium">{meta.displayLabel}</span> · {s.count}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
