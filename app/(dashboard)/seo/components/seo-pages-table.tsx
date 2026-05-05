"use client";

// SEO pages table — one editorial row per revenue page, summary header strip
// across the top. Cluster-aware: uses the new kind keys from
// cp_seo_opportunity_kinds via getKindMeta(). Stripe + hover tint on each
// row are tinted by the most-actionable kind currently open on that page.

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Info, Sparkles, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSeoPages } from "@/hooks/queries";
import { SeoPageDrilldown } from "./seo-page-drilldown";
import { getKindMeta, KIND_META } from "./kind-meta";
import { cn } from "@/lib/utils";
import type { SeoOppKindKey, SeoPage } from "../types";

// Per-page count fields, ordered by priority (most actionable first). The
// dominant-kind selection scans this list and picks the first non-zero one.
const KIND_COUNT_FIELDS: Array<{ key: SeoOppKindKey; field: keyof SeoPage }> = [
  { key: "wrong_page",       field: "open_wrong_page" },
  { key: "intent_gap",       field: "open_secondary" }, // legacy view column maps here
  { key: "coverage_partial", field: "open_supporting" }, // legacy view column maps here
  { key: "snippet_ctr",      field: "open_snippet_ctr" },
  { key: "freshness",        field: "open_freshness" },
  { key: "coverage_strong",  field: "open_primary" },   // legacy view column maps here
  { key: "needs_review",     field: "open_needs_review" },
];

function dominantKind(p: SeoPage): SeoOppKindKey | null {
  for (const { key, field } of KIND_COUNT_FIELDS) {
    if (Number(p[field] ?? 0) > 0) return key;
  }
  return null;
}

function nonZeroKindCounts(p: SeoPage): Array<{ key: SeoOppKindKey; count: number }> {
  return KIND_COUNT_FIELDS
    .map(({ key, field }) => ({ key, count: Number(p[field] ?? 0) }))
    .filter((s) => s.count > 0);
}

export function SeoPagesTable() {
  const { data: pages, isLoading, isError, error } = useSeoPages();
  const [active, setActive] = useState<SeoPage | null>(null);
  const [kindFilter, setKindFilter] = useState<SeoOppKindKey | null>(null);

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

  const filteredPages = useMemo(() => {
    if (!pages || !kindFilter) return pages;
    const field = KIND_COUNT_FIELDS.find((f) => f.key === kindFilter)?.field;
    if (!field) return pages;
    return pages.filter((p) => Number(p[field] ?? 0) > 0);
  }, [pages, kindFilter]);

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

  const visiblePages = filteredPages ?? pages;

  return (
    <TooltipProvider delayDuration={150}>
      {summary && (
        <OverviewHeader
          summary={summary}
          lastSyncedAt={lastSyncedAt}
          activeKind={kindFilter}
          onToggleKind={(k) => setKindFilter((prev) => (prev === k ? null : k))}
        />
      )}

      <div className="mt-3 overflow-hidden rounded-lg border bg-card divide-y">
        {visiblePages.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No pages match the{" "}
            <span className="font-medium text-foreground">
              {kindFilter ? KIND_META[kindFilter].displayLabel.toLowerCase() : ""}
            </span>{" "}
            filter.{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => setKindFilter(null)}
            >
              Show all pages
            </button>
          </div>
        ) : (
          visiblePages.map((p, i) => (
            <PageRow key={p.page} page={p} index={i} onOpen={setActive} />
          ))
        )}
      </div>

      <SeoPageDrilldown
        page={active}
        open={!!active}
        onOpenChange={(next) => !next && setActive(null)}
      />
    </TooltipProvider>
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

          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-2 max-w-md text-[12.5px] leading-snug text-muted-foreground cursor-help">
                Before SERP caps: if every open cluster reached the typical CTR for its current ranking
                position. <span className="underline decoration-dotted decoration-zinc-300 underline-offset-2">How is this calculated?</span>
              </p>
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
                  <span className="text-[10.5px] text-muted-foreground/80 tabular-nums">
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
              <span className="text-[11px] text-muted-foreground/80 hidden sm:inline">
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
              <span className="text-[12px] italic text-muted-foreground/80">
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
            <div className="mt-2 min-h-[2.4em] text-[12px] leading-snug">
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

      {/* Footer: sync recency */}
      {lastSyncedAt && (
        <div className="relative flex items-center justify-between border-t bg-zinc-50/60 px-5 py-2 sm:px-6">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span>
              Synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
            </span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Storyblok · GSC · DataForSEO
          </div>
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
  onOpen,
}: {
  page: SeoPage;
  index: number;
  onOpen: (p: SeoPage) => void;
}) {
  const dom = dominantKind(p);
  const dominantMeta = dom ? KIND_META[dom] : null;
  const stripe = dominantMeta?.tone.stripe ?? "bg-zinc-200";
  const glow = dominantMeta?.tone.glow ?? "from-zinc-100/70 via-zinc-50/40";
  const earnings = Math.round(Number(p.earnings_90d ?? 0));
  const avgPos = p.avg_position != null ? Number(p.avg_position) : null;
  const topKindMeta = p.top_kind ? getKindMeta(p.top_kind) : null;

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

        {/* Cluster breakdown + top opportunity — col-span-4 */}
        <div className="col-span-12 sm:col-span-4 min-w-0">
          <KindBreakdownBar p={p} />
          {p.top_query && topKindMeta && (
            <div className="mt-2 flex items-start gap-1.5 min-w-0">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wider shrink-0 pt-[3px]">
                Top
              </span>
              <span className="min-w-0 text-[12px] leading-snug">
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
    </div>
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
      <div className="text-muted-foreground/80 text-[12px] italic">no open clusters</div>
    );
  }

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      {segments.map((s) => {
        const meta = KIND_META[s.key];
        return (
          <Tooltip key={s.key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "h-full transition-opacity hover:opacity-80 cursor-help",
                  meta.tone.stripe,
                )}
                style={{ width: `${(s.count / total) * 100}%` }}
                aria-label={`${s.count} ${meta.shortLabel}`}
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
