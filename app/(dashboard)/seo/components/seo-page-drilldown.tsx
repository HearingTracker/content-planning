"use client";

// Per-page drawer rendering one card per cluster. The coverage classifier
// (Phase 1B) fills in kind/recommendation/confidence per cluster; pre-classified
// rows still render with kind='needs_review' and a neutral guidance footer
// prompting an admin re-sync.

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, ExternalLink, Info, Sparkles } from "lucide-react";
import { Fragment, useState } from "react";
import { useSeoOpportunities } from "@/hooks/queries";
import { StatusSelect } from "./status-select";
import { getKindMeta } from "./kind-meta";
import { cn } from "@/lib/utils";
import type { SeoOpportunity, SeoPage } from "../types";

export function SeoPageDrilldown({
  page,
  open,
  onOpenChange,
}: {
  page: SeoPage | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { data: opps, isLoading } = useSeoOpportunities(page?.page ?? null);

  const counts = (opps ?? []).reduce(
    (acc, o) => {
      acc[o.kind] = (acc[o.kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto bg-zinc-50/60 p-0 [&>button:last-of-type]:top-5 [&>button:last-of-type]:right-5"
      >
        {page && (
          <TooltipProvider delayDuration={150}>
            <SheetHeader className="bg-background border-b px-6 pt-6 pb-5 gap-3">
              <div className="flex items-start gap-3 pr-10">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="font-mono text-base text-foreground tracking-tight">
                    <a
                      href={`https://www.hearingtracker.com${page.page}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:underline decoration-1 underline-offset-4"
                    >
                      {page.page}
                      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                    </a>
                  </SheetTitle>
                  <SheetDescription className="text-foreground/80 mt-1 text-[13px] leading-snug">
                    {page.page_title || "(no title)"}
                  </SheetDescription>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border">
                <Stat
                  label="Earnings · 90d"
                  value={`$${Math.round(page.earnings_90d).toLocaleString()}`}
                />
                <Stat label="Conversions · 90d" value={String(page.conversions_90d)} />
                <Stat label="Source" value={page.meta_source ?? "unknown"} mono />
              </div>

              {(opps?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    At a glance
                  </span>
                  {Object.entries(counts).map(([key, n]) => {
                    const meta = getKindMeta(key);
                    return (
                      <span
                        key={key}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          meta.tone.chip,
                        )}
                      >
                        <span className="tabular-nums">{n}</span>
                        <span className="opacity-90">{meta.shortLabel.toLowerCase()}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </SheetHeader>

            <div className="space-y-3 px-4 py-5 sm:px-6">
              {isLoading && (
                <>
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </>
              )}
              {!isLoading && (opps?.length ?? 0) === 0 && (
                <div className="rounded-md border border-dashed bg-background py-10 text-center">
                  <p className="text-foreground text-sm">
                    No open clusters for this page.
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Try lowering the cron min-impressions threshold or wait for the next sync.
                  </p>
                </div>
              )}
              {opps?.map((o, i) => (
                <ClusterCard key={o.id} opp={o} delay={i * 40} />
              ))}
            </div>
          </TooltipProvider>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-background px-3 py-2.5">
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      <div
        className={cn(
          "text-foreground mt-0.5 text-base font-semibold tabular-nums",
          mono && "font-mono text-sm font-medium tracking-tight",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Cluster card ──────────────────────────────────────────────────────────

function ClusterCard({ opp: o, delay }: { opp: SeoOpportunity; delay: number }) {
  const meta = getKindMeta(o.kind);
  const { Icon } = meta;

  const avgPos = o.avg_position != null ? Number(o.avg_position) : null;
  const totalImp = Number(o.total_impressions ?? 0);
  const weightedCtr = o.weighted_ctr_pct != null ? Number(o.weighted_ctr_pct) : null;
  const expectedCtr = o.expected_ctr_pct != null ? Number(o.expected_ctr_pct) : null;
  const totalVol = Number(o.total_volume ?? 0);
  const missedClicks = Number(o.total_missed_clicks ?? 0);

  const isPending = o.kind === "needs_review";

  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-background shadow-sm",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", meta.tone.stripe)} aria-hidden />

      {/* Header: action label + cluster headline + status */}
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              meta.tone.iconWrap,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  meta.tone.chip,
                )}
              >
                {meta.displayLabel}
              </span>
              {avgPos != null && <PositionPill position={avgPos} />}
              {(o.min_kd != null || o.max_kd != null) && (
                <KdRange min={o.min_kd} max={o.max_kd} />
              )}
              {o.is_branded && o.brand && <BrandTag brand={o.brand} />}
            </div>
            <h3 className="text-foreground mt-2 text-lg font-semibold leading-tight tracking-tight">
              {o.cluster_label}
            </h3>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <StatusSelect id={o.id} value={o.status} />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] tabular-nums cursor-help">
                score {o.score}
                <Info className="h-3 w-3 opacity-60" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              Internal priority score blending impressions, position gap, keyword difficulty,
              and revenue. Higher = work on this first.
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Member queries — anchors pinned, rest collapsed past a soft cap. */}
      {o.member_queries.length > 0 && (
        <QueryChipsBlock
          queries={o.member_queries}
          anchors={o.anchor_queries}
        />
      )}

      {/* LLM recommendation (1B) when present, else neutral kind blurb. */}
      {o.recommendation ? (
        <div className="px-5">
          <p className="text-foreground/90 text-[13px] leading-relaxed">
            <RecommendationText text={o.recommendation} />
          </p>
          {o.confidence != null && o.confidence < 0.6 && (
            <p className="text-amber-700 mt-1 inline-flex items-center gap-1 text-[11px]">
              <AlertTriangle className="h-3 w-3" />
              Low confidence ({Math.round(o.confidence * 100)}%) — review before acting.
            </p>
          )}
        </div>
      ) : (
        <p className="text-foreground/90 px-5 text-[13px] leading-relaxed">{meta.description}</p>
      )}

      {/* Cannibalization callout */}
      {o.cannibal_pages.length > 0 && (
        <CannibalBlock pages={o.cannibal_pages} />
      )}

      {/* Aggregate metrics */}
      <div className="mx-5 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Impressions / mo"
          value={totalImp.toLocaleString()}
          help="Total monthly impressions across all queries in this cluster, from Google Search Console."
        />
        <Metric
          label="Search vol."
          value={totalVol > 0 ? totalVol.toLocaleString() : "—"}
          help="Total monthly search volume across the cluster, per Ahrefs."
        />
        <Metric
          label="CTR"
          value={weightedCtr != null ? `${weightedCtr.toFixed(2)}%` : "—"}
          delta={
            expectedCtr != null && weightedCtr != null
              ? {
                  expected: `${expectedCtr.toFixed(1)}% expected`,
                  good: weightedCtr >= expectedCtr,
                }
              : null
          }
          help="Weighted click-through rate across the cluster, vs the typical CTR for the queries' average ranking position."
        />
        <Metric
          label="Avg rank"
          value={avgPos != null ? `#${avgPos.toFixed(1)}` : "—"}
          help="Mean Google ranking position across the cluster's queries (last 28 days)."
        />
      </div>

      {/* Missed clicks insight when significant */}
      {missedClicks > 5 && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-md border border-dashed border-amber-300/60 bg-amber-50/60 px-3 py-2 text-[12px] leading-snug">
          <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-amber-900/90">
            Roughly{" "}
            <span className="font-semibold tabular-nums">{missedClicks.toLocaleString()}</span>{" "}
            extra clicks/mo are within reach if this cluster hit the typical CTR for its current
            ranking.
          </span>
        </div>
      )}

      {/* Pending-guidance footer — only when 1B classification hasn't run yet. */}
      {isPending && (
        <div className="mx-5 mt-4 rounded-md bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200/70">
          <p className="text-slate-700 text-[12px] leading-relaxed">
            Reader-intent guidance for this cluster has not been generated yet. The metrics
            above show the size of the opportunity; the recommended action will appear once
            the coverage classifier runs.
          </p>
        </div>
      )}

      {/* Footer: meta */}
      <footer className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 px-5 py-2.5 text-[11px]">
        {o.canonical_query && (
          <span>
            top query <span className="text-foreground">&ldquo;{o.canonical_query}&rdquo;</span>
          </span>
        )}
        {o.ahrefs_intent_prior && (
          <span className="font-mono opacity-80">{o.ahrefs_intent_prior}</span>
        )}
        {o.match_decision === "review" && (
          <span className="text-amber-700">match flagged for review</span>
        )}
      </footer>
    </article>
  );
}

// ─── Small UI bits ──────────────────────────────────────────────────────────

function PositionPill({ position }: { position: number }) {
  const tone =
    position <= 3
      ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
      : position <= 10
        ? "bg-amber-100 text-amber-900 ring-amber-200"
        : "bg-rose-100 text-rose-900 ring-rose-200";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ring-1 ring-inset cursor-help",
            tone,
          )}
        >
          rank #{position.toFixed(1)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Average Google ranking across this cluster&apos;s queries. Top-3 → high CTR; 4–10 →
        page-1 but easy to miss; 11+ → page 2.
      </TooltipContent>
    </Tooltip>
  );
}

function KdRange({ min, max }: { min: number | null; max: number | null }) {
  const value = min === max || max == null ? `${min ?? "—"}` : `${min ?? "—"}–${max}`;
  const worst = max ?? min ?? 0;
  const tone =
    worst <= 20
      ? "bg-emerald-500"
      : worst <= 50
        ? "bg-amber-500"
        : "bg-rose-500";
  const segments = 5;
  const filled = Math.max(1, Math.min(segments, Math.ceil((worst / 100) * segments)));
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 cursor-help">
          <span className="flex gap-[2px]">
            {Array.from({ length: segments }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-1.5 rounded-[1px]",
                  i < filled ? tone : "bg-zinc-200",
                )}
              />
            ))}
          </span>
          <span className="text-muted-foreground text-[10px] tabular-nums">KD {value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Ahrefs Keyword Difficulty range across the cluster (0–100). ≤20 easy, 21–50 moderate,
        51+ hard. The bar reflects the cluster&apos;s hardest member.
      </TooltipContent>
    </Tooltip>
  );
}

function BrandTag({ brand }: { brand: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-700 ring-1 ring-inset ring-zinc-200">
      {brand}
    </span>
  );
}

// ─── Chip blocks with "+N more" expansion ──────────────────────────────────

const QUERY_VISIBLE_CAP = 12;
const CANNIBAL_VISIBLE_CAP = 5;

/** Anchors first (in their priority order from the classifier), then the rest. */
function sortQueriesAnchorsFirst(all: string[], anchors: string[]): string[] {
  const anchorOrder = new Map(anchors.map((q, i) => [q, i] as const));
  const inAnchors = all.filter((q) => anchorOrder.has(q)).sort(
    (a, b) => (anchorOrder.get(a)! - anchorOrder.get(b)!),
  );
  const rest = all.filter((q) => !anchorOrder.has(q));
  return [...inAnchors, ...rest];
}

function QueryChipsBlock({ queries, anchors }: { queries: string[]; anchors: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortQueriesAnchorsFirst(queries, anchors);
  // Always show all anchors; cap the rest. If anchors alone exceed cap, show them all.
  const visibleCount = expanded
    ? sorted.length
    : Math.max(QUERY_VISIBLE_CAP, anchors.length);
  const visible = sorted.slice(0, visibleCount);
  const hidden = sorted.length - visible.length;

  return (
    <div className="px-5 pb-3">
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1.5">
        {queries.length} {queries.length === 1 ? "query" : "queries"} in this cluster
        {anchors.length > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal text-amber-700">
            <Sparkles className="h-3 w-3" /> start with the highlighted ones
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((q) => {
          const isAnchor = anchors.includes(q);
          return (
            <Tooltip key={q}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset cursor-help",
                    isAnchor
                      ? "bg-amber-50 text-amber-900 ring-amber-200 font-medium"
                      : "bg-zinc-100 text-zinc-700 ring-zinc-200",
                  )}
                >
                  {isAnchor && <Sparkles className="h-2.5 w-2.5" />}
                  {q}
                </span>
              </TooltipTrigger>
              {isAnchor && (
                <TooltipContent className="max-w-xs">
                  Anchor query — high volume relative to difficulty and close to the top of striking distance. Start the rewrite here.
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            +{hidden} more
          </button>
        )}
        {expanded && sorted.length > QUERY_VISIBLE_CAP && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            show less
          </button>
        )}
      </div>
    </div>
  );
}

function CannibalBlock({ pages }: { pages: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? pages : pages.slice(0, CANNIBAL_VISIBLE_CAP);
  const hidden = pages.length - visible.length;
  return (
    <div className="mx-5 mt-3 rounded-md border border-rose-200/70 bg-rose-50/60 px-3 py-2 text-[12px] leading-snug">
      <div className="text-rose-900/90 font-medium mb-1 inline-flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5" /> Also competing on
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((p) => (
          <a
            key={p}
            href={`https://www.hearingtracker.com${p}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-rose-900 ring-1 ring-inset ring-rose-200 hover:bg-white"
          >
            {p}
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-rose-900 ring-1 ring-inset ring-rose-200 hover:bg-rose-50"
          >
            +{hidden} more
          </button>
        )}
        {expanded && pages.length > CANNIBAL_VISIBLE_CAP && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-rose-900 ring-1 ring-inset ring-rose-200 hover:bg-rose-50"
          >
            show less
          </button>
        )}
      </div>
    </div>
  );
}

// Path-like substrings inside the recommendation prose become live links to
// the production site. Pattern: a leading slash + lowercase alphanumeric/hyphen
// segments separated by slashes (no trailing slash, no query string). We keep
// it conservative so commas, periods, and quotes adjacent to the path don't
// get swallowed.
const PATH_RE = /\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)+/g;

function RecommendationText({ text }: { text: string }) {
  const parts: Array<string | { kind: "path"; href: string }> = [];
  let lastIdx = 0;
  for (const match of text.matchAll(PATH_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIdx) parts.push(text.slice(lastIdx, idx));
    parts.push({ kind: "path", href: match[0] });
    lastIdx = idx + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <a
            key={i}
            href={`https://www.hearingtracker.com${part.href}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[12px] text-rose-800 underline decoration-rose-300 decoration-1 underline-offset-2 hover:decoration-rose-500"
          >
            {part.href}
          </a>
        ),
      )}
    </>
  );
}

function Metric({
  label,
  value,
  help,
  delta,
}: {
  label: string;
  value: string;
  help: string;
  delta?: { expected: string; good: boolean } | null;
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
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
      <div className="text-foreground mt-0.5 text-sm font-semibold tabular-nums leading-tight">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "text-[10px] tabular-nums leading-tight mt-0.5",
            delta.good ? "text-emerald-700" : "text-rose-700",
          )}
        >
          vs {delta.expected}
        </div>
      )}
    </div>
  );
}
