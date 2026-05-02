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
import { AlertTriangle, CornerUpRight, ExternalLink, Info, Sparkles } from "lucide-react";
import { Fragment, useState } from "react";
import { useSeoOpportunities, useSynthesisFindingsForPage } from "@/hooks/queries";
import { StatusSelect } from "./status-select";
import { getKindMeta, getSynthesisKindMeta } from "./kind-meta";
import { cn } from "@/lib/utils";
import type { SeoOpportunity, SeoPage, SeoSynthesisFinding } from "../types";

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
  const { data: synthesis } = useSynthesisFindingsForPage(page?.page ?? null);

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
              {page && (synthesis?.length ?? 0) > 0 && (
                <SiteWideContextCallout
                  currentPage={page.page}
                  findings={synthesis ?? []}
                />
              )}
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
                <ClusterCard
                  key={o.id}
                  opp={o}
                  delay={i * 40}
                  currentPage={page.page}
                  siteFindings={synthesis ?? []}
                />
              ))}
            </div>
          </TooltipProvider>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Site-wide context callout (Phase 1C synthesis layer) ─────────────────
// Surfaces cross-page findings the per-cluster classifier cannot see.
// Findings split into two buckets relative to the current page:
//   • "On this page" — the page is scope_page (e.g. fully_ceded_page)
//   • "Targets this page" — the page is target_page (e.g. orphan_target
//     suggesting we extend this page to claim a topic)

function SiteWideContextCallout({
  currentPage,
  findings,
}: {
  currentPage: string;
  findings: SeoSynthesisFinding[];
}) {
  const onPage = findings.filter((f) => f.scope_page === currentPage);
  const targets = findings.filter(
    (f) => f.scope_page !== currentPage && f.target_page === currentPage,
  );

  return (
    <div className="rounded-lg border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-white to-white px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-700/90">
        <Sparkles className="h-3.5 w-3.5" />
        Site-wide context
      </div>
      <p className="mt-1 text-[12px] text-foreground/80 leading-snug">
        Cross-page findings the per-cluster classifier cannot see on its own.
      </p>

      {onPage.length > 0 && (
        <SynthesisGroup
          title="On this page"
          findings={onPage}
          renderDetail={(f) => detailForOnPage(f)}
        />
      )}
      {targets.length > 0 && (
        <SynthesisGroup
          title="Targets this page"
          findings={targets}
          renderDetail={(f) => detailForTarget(f)}
        />
      )}
    </div>
  );
}

function SynthesisGroup({
  title,
  findings,
  renderDetail,
}: {
  title: string;
  findings: SeoSynthesisFinding[];
  renderDetail: (f: SeoSynthesisFinding) => string;
}) {
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="mt-1.5 space-y-1.5">
        {findings.map((f) => {
          const meta = getSynthesisKindMeta(f.kind);
          if (!meta) return null;
          const { Icon } = meta;
          return (
            <li
              key={f.id}
              className="flex items-start gap-2 rounded-md bg-background/80 px-2.5 py-2 ring-1 ring-inset ring-zinc-200/70"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                  meta.tone.iconWrap,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      meta.tone.chip,
                    )}
                  >
                    {meta.shortLabel}
                  </span>
                  <span className="text-[12px] font-medium text-foreground truncate">
                    {f.scope_query ?? f.scope_page ?? ""}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug">
                  {renderDetail(f)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function detailForOnPage(f: SeoSynthesisFinding): string {
  const ev = f.evidence ?? {};
  if (f.kind === "fully_ceded_page") {
    const count = (ev as { ceded_anchor_count?: number }).ceded_anchor_count ?? 0;
    return `${count} anchor${count === 1 ? "" : "s"} on this page already won by other HearingTracker URLs.`;
  }
  if (f.kind === "freshness") {
    const signals = (ev as { signals?: string[] }).signals ?? [];
    if (signals.length === 0) return "Stale signals detected.";
    const labels = signals.map((s) => {
      if (s === "year_in_title") return "outdated year in title";
      if (s === "content_age") return "content > 365 days old";
      if (s === "rank_decline") return "rank dropping over 8 weeks";
      return s;
    });
    return `Stale: ${labels.join(", ")}.`;
  }
  if (f.kind === "internal_link_gap") {
    const qcount = (ev as { qualifying_query_count?: number }).qualifying_query_count ?? 0;
    return `Page ranks top-3 for ${qcount} high-volume quer${qcount === 1 ? "y" : "ies"} but no other HT page links to it. Pour link equity.`;
  }
  return getSynthesisKindMeta(f.kind)?.description ?? "";
}

function detailForTarget(f: SeoSynthesisFinding): string {
  const ev = f.evidence ?? {};
  const sv = (ev as { sv?: number }).sv ?? 0;
  const svLabel = sv > 0 ? `SV ${sv.toLocaleString()}/mo` : "search volume unknown";
  const authorityCapped = (ev as { is_authority_capped?: boolean }).is_authority_capped === true;
  const authorityNote = authorityCapped
    ? " Note: this query's SERP is authority-capped — on-page changes unlikely to move rank."
    : "";
  if (f.kind === "orphan_target") {
    const cluster = (ev as { adjacent_cluster_query?: string }).adjacent_cluster_query;
    return `${svLabel}; topically adjacent to "${cluster ?? "this page"}". No HT URL ranks in top 30.`;
  }
  if (f.kind === "undesignated_topic") {
    const competing = (ev as { competing_pages?: unknown[] }).competing_pages ?? [];
    return `${svLabel}; ${competing.length} HT pages compete in pos 11-30 with no HT in top 10. This page is the leading candidate.${authorityNote}`;
  }
  if (f.kind === "aio_no_citation") {
    return `${svLabel}; AI Overview present but no HT URL cited. Passage-level rewrite candidate.${authorityNote}`;
  }
  if (f.kind === "authority_capped_serp") {
    const count = (ev as { authority_domain_count?: number }).authority_domain_count ?? 0;
    const topN = (ev as { top_n_checked?: number }).top_n_checked ?? 5;
    return `${svLabel}; ${count}/${topN} top results from authority domains. Rank ceiling here is link authority, not on-page.`;
  }
  if (f.kind === "brand_cannibalization") {
    const brand = (ev as { brand?: string }).brand ?? "this brand";
    const competing = (ev as { competing_pages?: unknown[] }).competing_pages ?? [];
    return `Brand "${brand}"; ${svLabel}; ${competing.length} HT pages compete pos 11-30. This page is the brand-canonical winner.${authorityNote}`;
  }
  return getSynthesisKindMeta(f.kind)?.description ?? "";
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

// Anchor set for badge intersection. Prefer start_with (LLM-curated subset
// of anchors worth attacking now); when start_with is empty (LLM said
// "nothing to attack"), still surface findings on the deterministic anchors
// so the editor sees WHY the LLM excluded them.
function clusterAnchorQuerySet(o: SeoOpportunity): Set<string> {
  const source = o.start_with_queries.length > 0 ? o.start_with_queries : o.anchor_queries;
  return new Set(source);
}

// Site-wide findings whose scope_query overlaps with a cluster anchor.
// Restricted to the kinds whose mechanic conflicts with on-page rewrite
// recommendations: SERP-structural caps (authority), AIO suppression, or a
// different HT page being the canonical brand winner.
const ANCHOR_OVERLAP_KINDS = new Set<string>([
  "authority_capped_serp",
  "aio_no_citation",
  "brand_cannibalization",
]);

function ClusterCard({
  opp: o,
  delay,
  currentPage,
  siteFindings,
}: {
  opp: SeoOpportunity;
  delay: number;
  currentPage: string;
  siteFindings: SeoSynthesisFinding[];
}) {
  const meta = getKindMeta(o.kind);
  const { Icon } = meta;

  const anchorSet = clusterAnchorQuerySet(o);
  const anchorFindings = siteFindings.filter(
    (f) =>
      f.scope_query != null
      && anchorSet.has(f.scope_query)
      && ANCHOR_OVERLAP_KINDS.has(f.kind),
  );

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

      {/* Member queries — start_with anchors pinned & highlighted, rest
          collapsed past a soft cap. start_with is the LLM-curated subset
          that excludes already-covered + ceded anchors. */}
      {o.member_queries.length > 0 && (
        <QueryChipsBlock
          queries={o.member_queries}
          anchors={o.start_with_queries}
          externalCanonicals={o.external_canonicals}
          topicCoverage={o.topic_coverage_by_query}
        />
      )}

      {anchorFindings.length > 0 && (
        <ClusterFindingsBadgeRow
          findings={anchorFindings}
          currentPage={currentPage}
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

// Compact "heads up" row tying cluster anchors to site-wide synthesis
// findings. Sits above the cluster's recommendation prose so the editor
// reads the prose with the SERP-structural caveats already in mind. When
// the finding's canonical target is a different HT page, the chip shows
// "→ /that-page" — that's the cross-page mismatch the per-cluster
// classifier could not see when it wrote its prose.
function ClusterFindingsBadgeRow({
  findings,
  currentPage,
}: {
  findings: SeoSynthesisFinding[];
  currentPage: string;
}) {
  return (
    <div className="mx-5 mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
        Heads up
      </span>
      {findings.map((f) => {
        const meta = getSynthesisKindMeta(f.kind);
        if (!meta) return null;
        const { Icon } = meta;
        const elsewhereTarget =
          f.target_page && f.target_page !== currentPage ? f.target_page : null;
        return (
          <Tooltip key={f.id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] cursor-help",
                  meta.tone.chip,
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">
                  {meta.shortLabel}
                </span>
                <span className="opacity-90 truncate max-w-[14rem]">
                  &ldquo;{f.scope_query}&rdquo;
                </span>
                {elsewhereTarget && (
                  <span className="font-mono opacity-75 truncate max-w-[14rem]">
                    → {elsewhereTarget}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {meta.description}
              {elsewhereTarget
                ? ` Synthesis recommends ${elsewhereTarget} as the canonical target — don't double-target this anchor here.`
                : " See “Site-wide context” above for details."}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
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

const CANNIBAL_VISIBLE_CAP = 5;

/** Strip protocol+host so chip suffixes stay short. Falls back to the input on parse failure. */
function pathFromUrl(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

// Topic coverage tiers — same thresholds the v11+ classifier prompt uses
// when reasoning about whether a topic needs body additions.
type CoverageTier = "covered" | "marginal" | "missing" | "unknown";

function coverageTier(score: number | null | undefined): CoverageTier {
  if (score == null) return "unknown";
  if (score >= 0.55) return "covered";
  if (score >= 0.4) return "marginal";
  return "missing";
}

// Tier rank for sorting — needs-coverage first, covered last. `unknown`
// (no embedding score yet) sits between marginal and covered: probably
// fine, but worth showing in the visible band so the editor can sanity-
// check until the next sync fills the score in.
const TIER_RANK: Record<CoverageTier, number> = {
  missing: 0,
  marginal: 1,
  unknown: 2,
  covered: 3,
};

/**
 * Anchors first (in classifier priority order), then non-anchors sorted by
 * coverage tier ascending (missing → marginal → unknown → covered), with
 * within-tier ties broken by raw score ascending (most-missing first).
 */
function sortQueriesByPriority(
  all: string[],
  anchors: string[],
  topicCoverage: Record<string, number | null>,
): string[] {
  const anchorOrder = new Map(anchors.map((q, i) => [q, i] as const));
  return [...all].sort((a, b) => {
    const aAnchor = anchorOrder.get(a);
    const bAnchor = anchorOrder.get(b);
    if (aAnchor != null && bAnchor == null) return -1;
    if (aAnchor == null && bAnchor != null) return 1;
    if (aAnchor != null && bAnchor != null) return aAnchor - bAnchor;
    const aTier = TIER_RANK[coverageTier(topicCoverage[a])];
    const bTier = TIER_RANK[coverageTier(topicCoverage[b])];
    if (aTier !== bTier) return aTier - bTier;
    return (topicCoverage[a] ?? 0.5) - (topicCoverage[b] ?? 0.5);
  });
}

function QueryChipsBlock({
  queries,
  anchors,
  externalCanonicals,
  topicCoverage,
}: {
  queries: string[];
  anchors: string[];
  externalCanonicals: Record<string, { url: string; position: number | null }>;
  topicCoverage: Record<string, number | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortQueriesByPriority(queries, anchors, topicCoverage);
  // Visibility rule: anchors always visible (LLM-curated relevance),
  // non-anchors visible only when they need coverage. Well-covered
  // non-anchors collapse into "+N more" — they're useful as confirmation
  // the page covers the cluster, but they're not the editor's work.
  const anchorSet = new Set(anchors);
  const naturallyVisible = sorted.filter((q) => {
    if (anchorSet.has(q)) return true;
    return coverageTier(topicCoverage[q]) !== "covered";
  });
  const visibleCount = expanded ? sorted.length : naturallyVisible.length;
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
          const canonical = externalCanonicals[q];
          const score = topicCoverage[q];
          const tier = coverageTier(score);
          // Canonical-owned chips render in slate (deferred), even when they
          // appear in the deterministic anchor list — the v12 prompt excludes
          // them from start_with for exactly this reason. Visual cue: amber =
          // attack here, slate-w/-arrow = defer to canonical sibling. Coverage
          // dot (emerald/amber/rose) is a secondary signal layered on top.
          const tone = canonical
            ? "bg-slate-100 text-slate-700 ring-slate-300"
            : isAnchor
              ? "bg-amber-50 text-amber-900 ring-amber-200 font-medium"
              : "bg-zinc-100 text-zinc-700 ring-zinc-200";
          const dotTone =
            tier === "covered"
              ? "bg-emerald-500"
              : tier === "marginal"
                ? "bg-amber-500"
                : tier === "missing"
                  ? "bg-rose-500"
                  : null;
          return (
            <Tooltip key={q}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset cursor-help",
                    tone,
                  )}
                >
                  {dotTone && (
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotTone)} aria-hidden />
                  )}
                  {isAnchor && !canonical && <Sparkles className="h-2.5 w-2.5" />}
                  {canonical && <CornerUpRight className="h-2.5 w-2.5 opacity-70" />}
                  <span>{q}</span>
                  {canonical && (
                    <span className="font-mono text-[10px] opacity-70 truncate max-w-[14rem]">
                      {pathFromUrl(canonical.url)}
                    </span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {canonical ? (
                  <>
                    Canonical sibling already wins this query at #{canonical.position ?? "?"} on the live SERP.
                    Optimizing this page for &ldquo;{q}&rdquo; would cannibalize{" "}
                    <span className="font-mono">{pathFromUrl(canonical.url)}</span>.
                    {score != null && (
                      <span className="block mt-1 opacity-80">Topic coverage on this page: {Math.round(score * 100)}%.</span>
                    )}
                  </>
                ) : (
                  <>
                    {isAnchor
                      ? "Anchor query — high volume relative to difficulty and close to the top of striking distance."
                      : "Cluster member — included in aggregate metrics but not flagged as an anchor."}
                    {score != null && (
                      <span className="block mt-1 opacity-80">
                        Topic coverage: {Math.round(score * 100)}%
                        {tier === "covered" && " — page substantively covers this topic; adding body content is unlikely to help."}
                        {tier === "marginal" && " — page touches the topic; an extension may help."}
                        {tier === "missing" && " — topic genuinely missing from the page."}
                      </span>
                    )}
                  </>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            +{hidden} already covered
          </button>
        )}
        {expanded && naturallyVisible.length < sorted.length && (
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
