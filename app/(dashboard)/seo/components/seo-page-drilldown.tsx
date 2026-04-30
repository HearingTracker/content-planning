"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpRight, CheckCircle2, ExternalLink, Info, Plus, Sparkles, Type } from "lucide-react";
import { useSeoOpportunities } from "@/hooks/queries";
import { StatusSelect } from "./status-select";
import { cn } from "@/lib/utils";
import type { SeoOpportunity, SeoOppKind, SeoPage } from "../types";

type KindMeta = {
  label: string;
  shortLabel: string;
  Icon: typeof Plus;
  stripe: string;
  badge: string;
  iconWrap: string;
  summary: (query: string, opp: SeoOpportunity) => string;
  steps: (query: string, opp: SeoOpportunity) => string[] | null;
};

const KIND_META: Record<SeoOppKind, KindMeta> = {
  primary: {
    label: "Already optimized",
    shortLabel: "Optimized",
    Icon: CheckCircle2,
    stripe: "before:bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200",
    iconWrap: "bg-emerald-100 text-emerald-700",
    summary: (q) =>
      `"${q}" is already in this page's title or main heading. No copy change needed — just monitor performance.`,
    steps: () => null,
  },
  supporting: {
    label: "Promote to a heading",
    shortLabel: "Promote",
    Icon: Type,
    stripe: "before:bg-blue-500",
    badge: "bg-blue-100 text-blue-900 ring-1 ring-inset ring-blue-200",
    iconWrap: "bg-blue-100 text-blue-700",
    summary: (q) =>
      `Your page already mentions "${q}" in the body, but search engines treat headings as topic signals — making it an H2 tells Google this is a focus area.`,
    steps: (q, o) => {
      const lines: string[] = [];
      lines.push(`Add or rename an H2 to include "${q}" verbatim.`);
      if (o.novel_tokens) {
        lines.push(`Make sure the heading contains: ${o.novel_tokens}.`);
      }
      lines.push(`Expand the section beneath that heading with 2–3 paragraphs covering the topic.`);
      return lines;
    },
  },
  secondary: {
    label: "Add a new section",
    shortLabel: "New section",
    Icon: Plus,
    stripe: "before:bg-amber-500",
    badge: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200",
    iconWrap: "bg-amber-100 text-amber-700",
    summary: (q, o) =>
      o.phrase_in_body > 0
        ? `Your page barely mentions "${q}" (${o.phrase_in_body}× in body) — but Google is still ranking it. A dedicated section will capture this traffic instead of leaking it.`
        : `Your page ranks for "${q}" without actually covering it. Add a section about it before a competitor takes the spot.`,
    steps: (q, o) => {
      const lines: string[] = [];
      lines.push(`Add a new H2 section titled around "${q}".`);
      if (o.novel_tokens) {
        lines.push(`Make sure these words appear naturally in the section: ${o.novel_tokens}.`);
      }
      lines.push(`Aim for 150–300 words of original, useful content — not a paraphrase.`);
      return lines;
    },
  },
};

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
    { primary: 0, supporting: 0, secondary: 0 } as Record<SeoOppKind, number>,
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
                <Stat
                  label="Source"
                  value={page.meta_source ?? "unknown"}
                  mono
                />
              </div>

              {(opps?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-muted-foreground text-[11px] uppercase tracking-wider">
                    At a glance
                  </span>
                  {counts.secondary > 0 && (
                    <CountChip n={counts.secondary} label="add section" tone="amber" />
                  )}
                  {counts.supporting > 0 && (
                    <CountChip n={counts.supporting} label="promote heading" tone="blue" />
                  )}
                  {counts.primary > 0 && (
                    <CountChip n={counts.primary} label="optimized" tone="emerald" />
                  )}
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
                  <p className="text-foreground text-sm">No open opportunities for this page.</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Try lowering the cron min-impressions threshold or wait for the next sync.
                  </p>
                </div>
              )}
              {opps?.map((o, i) => (
                <OpportunityCard key={o.id} opp={o} delay={i * 40} />
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
      <div className={cn("text-foreground mt-0.5 text-base font-semibold tabular-nums", mono && "font-mono text-sm font-medium tracking-tight")}>
        {value}
      </div>
    </div>
  );
}

function CountChip({ n, label, tone }: { n: number; label: string; tone: "amber" | "blue" | "emerald" }) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-100 text-amber-900 ring-amber-200"
      : tone === "blue"
        ? "bg-blue-100 text-blue-900 ring-blue-200"
        : "bg-emerald-100 text-emerald-900 ring-emerald-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        toneClass,
      )}
    >
      <span className="tabular-nums">{n}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function OpportunityCard({ opp: o, delay }: { opp: SeoOpportunity; delay: number }) {
  const meta = KIND_META[o.kind];
  const { Icon } = meta;
  const steps = meta.steps(o.query, o);

  const expectedClicks =
    o.impressions != null && o.expected_ctr_pct != null
      ? Math.round((o.impressions * o.expected_ctr_pct) / 100)
      : null;
  const missedClicks =
    expectedClicks != null && o.clicks != null ? Math.max(0, expectedClicks - o.clicks) : null;

  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-background shadow-sm",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
        meta.stripe,
      )}
    >
      {/* Action header */}
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md", meta.iconWrap)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  meta.badge,
                )}
              >
                {meta.label}
              </span>
              <PositionPill position={o.position} />
              <DifficultyBar kd={o.kd} />
            </div>
            <h3 className="text-foreground mt-2 text-lg font-semibold leading-tight tracking-tight">
              {o.query}
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
              Internal priority score blending revenue, impressions, position gap, and keyword
              difficulty. Higher = work on this first.
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Plain-language summary */}
      <p className="text-foreground/90 px-5 text-[13px] leading-relaxed">
        {meta.summary(o.query, o)}
      </p>

      {/* Metrics row */}
      <div className="mx-5 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Impressions / mo"
          value={o.impressions != null ? o.impressions.toLocaleString() : "—"}
          help="How many times this page appeared in Google results for this query in the last 28 days."
        />
        <Metric
          label="Clicks / mo"
          value={o.clicks != null ? o.clicks.toLocaleString() : "—"}
          help="How many people actually clicked through from search to this page."
        />
        <Metric
          label="CTR"
          value={`${(o.ctr_pct ?? 0).toFixed(2)}%`}
          delta={
            o.expected_ctr_pct != null
              ? {
                  expected: `${o.expected_ctr_pct.toFixed(1)}% expected`,
                  good: (o.ctr_pct ?? 0) >= o.expected_ctr_pct,
                }
              : null
          }
          help="Click-through rate. Compared against the average CTR for your current ranking position — lower than expected usually means a weak title or snippet."
        />
        <Metric
          label="Search vol."
          value={o.volume != null ? o.volume.toLocaleString() : "—"}
          help="Total monthly searches for this query, per Ahrefs — the size of the prize."
        />
      </div>

      {/* Missed clicks insight */}
      {missedClicks != null && missedClicks > 5 && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-md border border-dashed border-amber-300/60 bg-amber-50/60 px-3 py-2 text-[12px] leading-snug">
          <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-amber-900/90">
            Even at your current rank, you&apos;re missing about{" "}
            <span className="font-semibold tabular-nums">{missedClicks.toLocaleString()}</span>{" "}
            clicks/mo vs the typical CTR for position{" "}
            <span className="tabular-nums">{o.position?.toFixed(0) ?? "—"}</span>. A stronger title
            or snippet alone could close most of that gap.
          </span>
        </div>
      )}

      {/* What to do */}
      {steps && steps.length > 0 && (
        <div className="mx-5 mt-4 rounded-md bg-zinc-50 px-4 py-3 ring-1 ring-inset ring-zinc-200/70">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700">
            <ArrowUpRight className="h-3 w-3" />
            What to do
          </div>
          <ol className="mt-2 space-y-1.5 text-[12.5px] text-foreground/90">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 leading-snug">
                <span className="text-muted-foreground tabular-nums shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer */}
      <footer className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 px-5 py-2.5 text-[11px]">
        {o.parent_topic && (
          <span>
            topic <span className="text-foreground">{o.parent_topic}</span>
          </span>
        )}
        {o.intents && (
          <span className="font-mono opacity-80">{o.intents.replace(/\|/g, " · ")}</span>
        )}
        {o.in_heading && o.kind === "supporting" && (
          <span className="text-emerald-700">already in a heading</span>
        )}
      </footer>
    </article>
  );
}

function PositionPill({ position }: { position: number | null }) {
  if (position == null) return null;
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
        Average Google ranking for this query over the last 28 days. Top-3 → high CTR; 4–10 →
        page-1 but easy to miss; 11+ → page 2.
      </TooltipContent>
    </Tooltip>
  );
}

function DifficultyBar({ kd }: { kd: number | null }) {
  if (kd == null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] cursor-help">
            KD —
          </span>
        </TooltipTrigger>
        <TooltipContent>Ahrefs Keyword Difficulty unavailable.</TooltipContent>
      </Tooltip>
    );
  }
  const segments = 5;
  const filled = Math.max(1, Math.min(segments, Math.ceil((kd / 100) * segments)));
  const tone =
    kd <= 20
      ? "bg-emerald-500"
      : kd <= 50
        ? "bg-amber-500"
        : "bg-rose-500";
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
          <span className="text-muted-foreground text-[10px] tabular-nums">KD {kd}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Ahrefs Keyword Difficulty (0–100). Roughly: ≤20 easy, 21–50 moderate, 51+ hard. Estimates
        how many backlinks you&apos;d need to rank in the top 10.
      </TooltipContent>
    </Tooltip>
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
