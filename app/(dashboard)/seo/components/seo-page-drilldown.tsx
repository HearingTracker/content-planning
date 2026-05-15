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
import {
  AlertTriangle,
  CheckCircle2,
  CornerUpRight,
  ExternalLink,
  Info,
  Link as LinkIcon,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useSeoOpportunities, useSynthesisFindingsForPage } from "@/hooks/queries";
import { StatusSelect } from "./status-select";
import { getKindMeta, getSynthesisKindMeta, type SynthesisKindMeta } from "./kind-meta";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
                  <SheetTitle className="text-foreground text-lg font-semibold leading-tight tracking-tight">
                    {page.page_title || "(no title)"}
                  </SheetTitle>
                  <SheetDescription asChild>
                    <a
                      href={`https://www.hearingtracker.com${page.page}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 font-mono text-[12px] hover:text-foreground hover:underline decoration-1 underline-offset-4"
                    >
                      {page.page}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </SheetDescription>
                </div>
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                <span>
                  <span className="text-foreground font-semibold tabular-nums">
                    ${Math.round(page.earnings_90d).toLocaleString()}
                  </span>{" "}
                  earnings
                </span>
                <span className="opacity-40">·</span>
                <span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {page.conversions_90d}
                  </span>{" "}
                  conversion{page.conversions_90d === 1 ? "" : "s"}
                </span>
                <span className="opacity-40">·</span>
                <span className="font-mono text-[11px]">{page.meta_source ?? "unknown"}</span>
                <span className="opacity-40">·</span>
                <span className="opacity-75">90d</span>
              </div>

              {(opps?.length ?? 0) > 1 && (
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

// Tone severity for ordering tabs — most-urgent (rose) first, slate last.
// Mirrors the visual reading order an editor scans top-down.
const TONE_RANK: Record<string, number> = {
  rose: 0,
  amber: 1,
  blue: 2,
  emerald: 3,
  slate: 4,
};

const SYNTHESIS_GROUP_VISIBLE_CAP = 5;

type SynthesisFindingWithPlacement = SeoSynthesisFinding & {
  placement: "on_page" | "target";
};

function SiteWideContextCallout({
  currentPage,
  findings,
}: {
  currentPage: string;
  findings: SeoSynthesisFinding[];
}) {
  const tagged = useMemo<SynthesisFindingWithPlacement[]>(() => {
    return findings
      .map((f): SynthesisFindingWithPlacement | null => {
        if (f.scope_page === currentPage) return { ...f, placement: "on_page" };
        if (f.target_page === currentPage) return { ...f, placement: "target" };
        return null;
      })
      .filter((f): f is SynthesisFindingWithPlacement => f !== null);
  }, [findings, currentPage]);

  // Group by kind — each tab is one kind. Sort tabs by tone severity (rose
  // → amber → blue → slate) so the editor's first read is the most urgent.
  const sortedGroups = useMemo(() => {
    const byKind = new Map<string, SynthesisFindingWithPlacement[]>();
    for (const f of tagged) {
      const list = byKind.get(f.kind) ?? [];
      list.push(f);
      byKind.set(f.kind, list);
    }
    return Array.from(byKind.entries())
      .map(([kind, items]) => ({ kind, items, meta: getSynthesisKindMeta(kind) }))
      .filter(
        (g): g is { kind: string; items: SynthesisFindingWithPlacement[]; meta: SynthesisKindMeta } =>
          g.meta !== null,
      )
      .sort((a, b) => {
        const aRank = toneRankForMeta(a.meta);
        const bRank = toneRankForMeta(b.meta);
        if (aRank !== bRank) return aRank - bRank;
        return b.items.length - a.items.length;
      });
  }, [tagged]);

  const [activeKind, setActiveKind] = useState<string | null>(
    sortedGroups[0]?.kind ?? null,
  );

  if (sortedGroups.length === 0) return null;

  // Guard against the active tab disappearing after a re-sync.
  const active = sortedGroups.find((g) => g.kind === activeKind) ?? sortedGroups[0];

  return (
    <div className="rounded-lg border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-white to-white px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-700/90">
        <Sparkles className="h-3.5 w-3.5" />
        Site-wide context
      </div>
      <p className="mt-1 text-[12px] text-foreground/80 leading-snug">
        Cross-page findings the per-cluster classifier cannot see on its own.
      </p>

      <Tabs
        value={active.kind}
        onValueChange={setActiveKind}
        className="mt-3 gap-3"
      >
        <TabsList className="bg-white/70 ring-1 ring-inset ring-indigo-100 h-auto flex-wrap gap-1 p-1">
          {sortedGroups.map(({ kind, meta, items }) => {
            const { Icon } = meta;
            return (
              <TabsTrigger
                key={kind}
                value={kind}
                className="data-[state=active]:bg-background h-7 px-2.5 text-[11px] font-medium gap-1.5"
              >
                <Icon className="h-3 w-3" />
                {meta.shortLabel}
                <span className="rounded bg-zinc-100 px-1 py-px text-[10px] tabular-nums text-zinc-700 ring-1 ring-inset ring-zinc-200">
                  {items.length}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {sortedGroups.map(({ kind, items, meta }) => (
          <TabsContent key={kind} value={kind} className="mt-0">
            <SynthesisKindList items={items} meta={meta} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// meta.tone is a class-string bundle, not a tone-name. Re-derive the tone
// name by sniffing the chip class so we can sort tabs by severity.
function toneRankForMeta(meta: SynthesisKindMeta): number {
  const chip = meta.tone.chip;
  if (chip.includes("rose")) return TONE_RANK.rose;
  if (chip.includes("amber")) return TONE_RANK.amber;
  if (chip.includes("blue")) return TONE_RANK.blue;
  if (chip.includes("emerald")) return TONE_RANK.emerald;
  return TONE_RANK.slate;
}

function SynthesisKindList({
  items,
  meta,
}: {
  items: SynthesisFindingWithPlacement[];
  meta: SynthesisKindMeta;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, SYNTHESIS_GROUP_VISIBLE_CAP);
  const hidden = items.length - visible.length;
  const { Icon } = meta;

  return (
    <ul className="space-y-1.5">
      {visible.map((f) => (
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
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {f.placement === "on_page" ? "On this page" : "Targets this page"}
              </span>
              <span className="text-[12px] font-medium text-foreground truncate">
                {f.scope_query ?? f.scope_page ?? ""}
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug">
              {f.placement === "on_page" ? detailForOnPage(f) : detailForTarget(f)}
            </p>
          </div>
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full bg-white px-2.5 py-1 text-[11px] text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            +{hidden} more
          </button>
        </li>
      )}
      {expanded && items.length > SYNTHESIS_GROUP_VISIBLE_CAP && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-full bg-white px-2.5 py-1 text-[11px] text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            show less
          </button>
        </li>
      )}
    </ul>
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
  const lift = computeLiftDisplay(o, missedClicks);
  const isNonEdit = o.actionability === "blocked" || o.actionability === "monitor";
  const routeTarget = isNonEdit
    ? anchorFindings.find((f) => f.target_page && f.target_page !== currentPage)?.target_page ?? null
    : null;
  const visibleAnchorFindings = routeTarget
    ? anchorFindings.filter((f) => f.target_page !== routeTarget)
    : anchorFindings;

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

      {/* Header — headline owns the row; kind/rank/KD ride below as a muted
          eyebrow so the editor reads the title first. Status select anchors
          the right rail; the priority score moved to the footer alongside
          other reference fields (it's reference info, not an action). */}
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
            <h3 className="text-foreground text-lg font-semibold leading-tight tracking-tight">
              {o.cluster_label}
            </h3>
            <div className="mt-1.5 flex items-center gap-x-2 gap-y-1 flex-wrap">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                {meta.displayLabel}
              </span>
              {avgPos != null && <PositionPill position={avgPos} />}
              {(o.min_kd != null || o.max_kd != null) && (
                <KdRange min={o.min_kd} max={o.max_kd} />
              )}
              {o.is_branded && o.brand && <BrandTag brand={o.brand} />}
              {o.page_content_type && <PageTypeTag type={o.page_content_type} />}
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <StatusSelect id={o.id} value={o.status} />
        </div>
      </header>

      <ActionabilityNotice
        actionability={o.actionability}
        guardrails={o.guardrails}
        confidence={o.confidence}
      />

      {/* Recommendation — surfaced near the top so the editor's first read is
          the actual instruction. Low-confidence warning sits beneath; the
          green "Ready to edit" banner above auto-suppresses when confidence is
          low so green-go and amber-stop don't stack on the same prose. */}
      {o.recommendation ? (
        <div className="px-5 py-3">
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
        <p className="text-foreground/90 px-5 py-3 text-[13px] leading-relaxed">{meta.description}</p>
      )}

      {routeTarget && <RoutingSuggestion targetPage={routeTarget} />}

      <RecommendationAuditPanel opp={o} isNonEdit={isNonEdit} />

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

      {/* Aggregate metrics — borderless strip; the cluster card already
          provides the container, so nested tile borders read as box-in-box. */}
      <div className="mx-5 mt-3 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        <Metric
          label="Impressions / mo"
          value={totalImp.toLocaleString()}
          help="Total monthly impressions across all queries in this cluster, from Google Search Console."
        />
        <Metric
          label="Search vol."
          value={totalVol > 0 ? totalVol.toLocaleString() : "—"}
          help="Total monthly search volume across the cluster, per DataForSEO."
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

      {/* Missed clicks insight — borderless prose so it reads as a footnote
          to the metrics strip directly above, not as a competing callout. */}
      {lift && (
        <div className="mx-5 mt-2 flex items-start gap-1.5 text-[12px] leading-snug">
          <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-amber-900/90">
            {lift.capped ? (
              <>
                Raw ceiling{" "}
                <span className="font-semibold tabular-nums">{lift.raw.toLocaleString()}</span>
                {" "}clicks/mo; about{" "}
                <span className="font-semibold tabular-nums">{lift.adjusted.toLocaleString()}</span>
                {" "}looks addressable after SERP caps.
              </>
            ) : (
              <>
                Roughly{" "}
                <span className="font-semibold tabular-nums">{lift.raw.toLocaleString()}</span>{" "}
                extra clicks/mo are within reach if this cluster hit the typical CTR for its current
                ranking.
              </>
            )}
          </span>
        </div>
      )}

      {visibleAnchorFindings.length > 0 && (
        <ClusterFindingsBadgeRow
          findings={visibleAnchorFindings}
          currentPage={currentPage}
        />
      )}

      {/* Cannibalization callout */}
      {o.cannibal_pages.length > 0 && (
        <CannibalBlock pages={o.cannibal_pages} />
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

      {/* Footer — reference fields plus right-aligned priority score. */}
      <footer className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 px-5 py-2.5 text-[11px]">
        {o.canonical_query && (
          <span>
            top query <span className="text-foreground">&ldquo;{o.canonical_query}&rdquo;</span>
          </span>
        )}
        {o.dataforseo_intent_prior && (
          <span className="font-mono opacity-80">{o.dataforseo_intent_prior}</span>
        )}
        {o.match_decision === "review" && (
          <span className="text-amber-700">match flagged for review</span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-auto inline-flex items-center gap-1 tabular-nums cursor-help">
              score {o.score}
              <Info className="h-3 w-3 opacity-60" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <PriorityTooltipContent opp={o} />
          </TooltipContent>
        </Tooltip>
      </footer>
    </article>
  );
}

function computeLiftDisplay(
  opp: SeoOpportunity,
  rawMissedClicks: number,
): { raw: number; adjusted: number; capped: boolean } | null {
  if (rawMissedClicks <= 5 || opp.actionability === "blocked" || opp.actionability === "monitor") {
    return null;
  }

  const signals = new Set(opp.recommendation_audit?.serp_change_trigger.signals ?? []);
  let factor = 1;
  if (signals.has("ctr_gap_structural_from_position")) factor *= 0.45;
  if (signals.has("aio_present_on_serp")) factor *= 0.8;
  if (signals.has("aio_present_without_this_page_as_serp_source")) factor *= 0.75;
  if (signals.has("external_canonical_page_in_top_10")) factor *= 0.8;
  if (signals.has("serp_verified_cannibalization")) factor *= 0.85;

  const capped = factor < 0.95;
  const adjusted = capped ? Math.max(1, Math.round(rawMissedClicks * factor)) : rawMissedClicks;
  return { raw: rawMissedClicks, adjusted, capped };
}

function RoutingSuggestion({ targetPage }: { targetPage: string }) {
  return (
    <div className="mx-5 mb-2 rounded-md bg-slate-50 px-3 py-2 text-[12px] leading-snug text-slate-800 ring-1 ring-inset ring-slate-200">
      Route this intent to{" "}
      <a
        href={`https://www.hearingtracker.com${targetPage}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono underline decoration-slate-300 underline-offset-2"
      >
        {targetPage}
      </a>
      .
    </div>
  );
}

function PageTypeTag({ type }: { type: NonNullable<SeoOpportunity["page_content_type"]> }) {
  const labels: Record<NonNullable<SeoOpportunity["page_content_type"]>, string> = {
    best_list: "Best list",
    brand_page: "Brand page",
    product_review: "Review",
    comparison_page: "Compare",
    price_or_buying_guide: "Price guide",
    general_guide: "Guide",
    generic_article: "Article",
    unknown: "Unknown type",
  };
  return (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
      {labels[type]}
    </span>
  );
}

// Compact "heads up" row tying cluster anchors to site-wide synthesis
// findings — surfaces SERP-structural caveats (authority caps, AIO
// suppression, brand cannibalization) the per-cluster classifier could
// not see when it wrote its prose. When the finding's canonical target
// is a different HT page, the chip shows "→ /that-page" so the editor
// sees the cross-page mismatch.
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

function ActionabilityNotice({
  actionability,
  guardrails,
  confidence,
}: {
  actionability: SeoOpportunity["actionability"];
  guardrails: string[];
  confidence: number | null;
}) {
  // Suppress the green "Ready to edit" reassurance when confidence is low —
  // stacking it above the amber low-confidence warning beneath the prose
  // sends contradicting signals on the same recommendation.
  if (actionability === "ready" && confidence != null && confidence < 0.6) return null;
  if (actionability === "ready" && guardrails.length === 0) return null;

  const config = {
    ready: {
      label: "Ready to edit",
      text: "Ready to brief on the highlighted anchors.",
      className: "border-emerald-200/70 bg-emerald-50/60 text-emerald-900",
    },
    review: {
      label: "Review gate",
      text: "Do not assign directly until an editor validates the recommendation.",
      className: "border-amber-200/70 bg-amber-50/70 text-amber-950",
    },
    monitor: {
      label: "Monitor only",
      text: "No article edit is recommended for this cluster.",
      className: "border-emerald-200/70 bg-emerald-50/60 text-emerald-900",
    },
    blocked: {
      label: "Do not target here",
      text: "This intent should be handled by another page.",
      className: "border-slate-200/80 bg-slate-50 text-slate-800",
    },
  }[actionability];

  const notes = guardrails
    .map((note) => {
      if (note.includes("canonical-owned")) return "Canonical-owned anchors are deferred";
      if (note.includes("AIO-loss")) return "AIO-source rewrites are available";
      if (note.includes("moderate confidence")) return "Concrete non-canonical task";
      return note;
    })
    .slice(0, 2);

  return (
    <div className={cn("mx-5 mt-3 rounded-md border px-3 py-2 text-[12px] leading-snug", config.className)}>
      <div className="font-medium">{config.label}</div>
      <div className="mt-0.5">
        {config.text}
        {notes.length > 0 && (
          <span className="opacity-85"> {notes.join("; ")}.</span>
        )}
      </div>
    </div>
  );
}

const STANDALONE_CRITERION_LABELS: Record<string, string> = {
  not_navigational_gated: "Not navigational",
  supported_intent: "Info/commercial intent",
  meaningful_demand: "Meaningful demand",
  partial_subsection_coverage: "Partial subsection",
  dedicated_article_depth: "Article depth",
  no_existing_canonical: "No canonical owner",
};

function RecommendationAuditPanel({
  opp,
  isNonEdit,
}: {
  opp: SeoOpportunity;
  isNonEdit: boolean;
}) {
  const audit = opp.recommendation_audit;
  const standalone = opp.standalone_article;
  const links = isNonEdit
    ? []
    : opp.internal_link_recommendations.filter((link) => link.confidence >= 0.75);
  const checklist = isNonEdit
    ? []
    : opp.editor_gap_checklist.filter((item) => item.status !== "not_applicable");
  const aio = opp.aio_serp;
  const showStandalone = !isNonEdit && standalone;
  const showAio = !isNonEdit && aio?.aio_present_on_serp;
  const hasAudit =
    audit ||
    showStandalone ||
    links.length > 0 ||
    checklist.length > 0 ||
    showAio;
  if (!hasAudit) return null;

  const triggeredSignals = audit
    ? [
        audit.freshness_trigger.triggered ? "freshness" : null,
        audit.intent_trigger.triggered ? "intent" : null,
        audit.content_gap_trigger.triggered ? "content gap" : null,
        audit.serp_change_trigger.triggered ? "SERP" : null,
      ].filter((s): s is string => s != null)
    : [];

  return (
    <div className="mx-5 mt-1 space-y-3 rounded-md bg-zinc-50/80 px-3 py-3 ring-1 ring-inset ring-zinc-200/80">
      {showStandalone && (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Standalone article
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", standaloneStatusTone(standalone))}>
              {standaloneStatusLabel(standalone)}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
            {standalone.reason}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(standalone.criteria).map(([key, passed]) => (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] ring-1 ring-inset",
                  passed
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-white text-zinc-600 ring-zinc-200",
                )}
              >
                {passed ? (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                )}
                {STANDALONE_CRITERION_LABELS[key] ?? key.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            <LinkIcon className="h-3 w-3" />
            Internal links
          </div>
          <ul className="space-y-1.5">
            {links.slice(0, 3).map((link, index) => (
              <li key={`${link.source_page}-${link.target_page}-${index}`} className="text-[11.5px] leading-snug">
                <span className="font-medium text-zinc-800">
                  {directionLabel(link.direction)}
                </span>{" "}
                <a
                  href={`https://www.hearingtracker.com${link.source_page}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-zinc-700 underline decoration-zinc-300 underline-offset-2"
                >
                  {link.source_page}
                </a>{" "}
                <span className="text-muted-foreground">to</span>{" "}
                <a
                  href={`https://www.hearingtracker.com${link.target_page}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-zinc-700 underline decoration-zinc-300 underline-offset-2"
                >
                  {link.target_page}
                </a>{" "}
                <span className="text-muted-foreground">
                  as &ldquo;{link.suggested_anchor_text}&rdquo; · {Math.round(link.confidence * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showAio && (
        <div className="text-[11.5px] leading-snug text-muted-foreground">
          <span className="font-medium text-zinc-800">AIO SERP data:</span>{" "}
          present for {aio.aio_present_on_serp_queries.length} anchor
          {aio.aio_present_on_serp_queries.length === 1 ? "" : "s"};{" "}
          {aio.aio_citation_seen
            ? `HT source seen for ${aio.aio_citation_seen_queries.length}.`
            : "no HT source seen in the Google AIO source list."}
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <div className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            <ListChecks className="h-3 w-3" />
            Human checklist
          </div>
          <div className="flex flex-wrap gap-1.5">
            {checklist.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex cursor-help items-center rounded-full px-2 py-0.5 text-[10.5px] ring-1 ring-inset",
                      checklistStatusTone(item.status),
                    )}
                  >
                    {item.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <span className="font-medium capitalize">{item.status.replace("_", " ")}</span>
                  {item.reason ? `: ${item.reason}` : ""}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {audit && (
        <details className="group text-[11.5px] leading-snug text-muted-foreground">
          <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Signals
          </summary>
          <div className="mt-2 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-900 ring-1 ring-inset ring-zinc-200">
                {triggerLabel(audit.recommendation_trigger)}
              </span>
              {triggeredSignals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 ring-1 ring-inset ring-zinc-200"
                >
                  {signal}
                </span>
              ))}
            </div>
            <p>{audit.confidence_rationale}</p>
            {(audit.content_gap_trigger.missing_or_marginal_queries.length > 0 ||
              audit.serp_change_trigger.signals.length > 0) && (
              <p className="text-zinc-700">
                {audit.content_gap_trigger.missing_or_marginal_queries.length > 0 && (
                  <>
                    Gap:{" "}
                    {audit.content_gap_trigger.missing_or_marginal_queries.slice(0, 3).join(", ")}
                    {audit.serp_change_trigger.signals.length > 0 ? ". " : "."}
                  </>
                )}
                {audit.serp_change_trigger.signals.length > 0 && (
                  <>SERP: {audit.serp_change_trigger.signals.map(signalLabel).join(", ")}.</>
                )}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function standaloneStatusLabel(standalone: NonNullable<SeoOpportunity["standalone_article"]>): string {
  if (standalone.recommended) return "Recommended";
  if (standalone.criteria.not_navigational_gated === false) return "Blocked: navigational";
  if (standalone.criteria.meaningful_demand === false) return "Not enough demand";
  if (standalone.criteria.no_existing_canonical === false) return "Keep as page update";
  if (standalone.score >= 75) return "Near miss";
  return "Not recommended";
}

function standaloneStatusTone(standalone: NonNullable<SeoOpportunity["standalone_article"]>): string {
  if (standalone.recommended) return "bg-amber-100 text-amber-900 ring-amber-200";
  if (standalone.score >= 75) return "bg-white text-zinc-800 ring-zinc-300";
  return "bg-white text-zinc-700 ring-zinc-200";
}

function PriorityTooltipContent({ opp }: { opp: SeoOpportunity }) {
  const p = opp.prioritization;
  if (!p) {
    return (
      <>
        Internal priority score blending impressions, position gap, keyword difficulty,
        and revenue. Higher = work on this first.
      </>
    );
  }
  return (
    <div className="space-y-1">
      <div>
        Computed priority score {p.computed_score} using formula {p.formula_version}.
      </div>
      <div>
        Traffic {p.inputs.traffic_impression_opportunity}, business {p.inputs.business_value},
        trend {p.inputs.current_decline_or_volatility}, confidence {p.inputs.confidence}.
      </div>
      <div>
        Effort {p.effort_estimate}; manual priority{" "}
        {p.manual_priority_override ?? "none"}.
      </div>
    </div>
  );
}

function triggerLabel(trigger: string): string {
  const labels: Record<string, string> = {
    content_gap: "Content gap",
    standalone_article_candidate: "Standalone article",
    recoverable_ctr_gap: "CTR gap",
    aio_present_on_serp_without_ht_source: "AIO SERP source gap",
    cannibalization: "Cannibalization",
    external_canonical: "External canonical",
    navigational_intent_block: "Navigation block",
    wrong_page_or_navigation: "Wrong page",
    monitor: "Monitor",
    review_guardrail: "Review guardrail",
  };
  return labels[trigger] ?? trigger.replaceAll("_", " ");
}

function signalLabel(signal: string): string {
  const labels: Record<string, string> = {
    aio_present_on_serp: "AIO present on SERP",
    aio_present_without_this_page_as_serp_source: "AIO source gap",
    external_canonical_page_in_top_10: "canonical in top 10",
    serp_verified_cannibalization: "cannibalization",
    ctr_gap_structural_from_position: "structural CTR cap",
  };
  return labels[signal] ?? signal.replaceAll("_", " ");
}

function directionLabel(direction: SeoOpportunity["internal_link_recommendations"][number]["direction"]): string {
  if (direction === "to_current_page") return "Add link to current page:";
  if (direction === "both") return "Consider links both ways:";
  return "Add link from current page:";
}

function checklistStatusTone(status: SeoOpportunity["editor_gap_checklist"][number]["status"]): string {
  if (status === "required") return "bg-amber-100 text-amber-900 ring-amber-200";
  if (status === "recommended") return "bg-white text-zinc-700 ring-zinc-200";
  return "bg-zinc-100 text-zinc-500 ring-zinc-200";
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
        DataForSEO Keyword Difficulty range across the cluster (0–100). ≤20 easy, 21–50 moderate,
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

const QUERY_CHIPS_VISIBLE_CAP = 5;

/**
 * Cede chips (canonical-owned) first — those flag a sibling page already
 * winning the SERP, so they're the editor's most urgent look. Then anchors
 * in classifier priority order, then by coverage tier ascending (missing →
 * marginal → unknown → covered), with within-tier ties broken by raw score
 * ascending (most-missing first).
 */
function sortQueriesByPriority(
  all: string[],
  anchors: string[],
  externalCanonicals: Record<string, { url: string; position: number | null }>,
  topicCoverage: Record<string, number | null>,
): string[] {
  const anchorOrder = new Map(anchors.map((q, i) => [q, i] as const));
  return [...all].sort((a, b) => {
    const aCede = a in externalCanonicals;
    const bCede = b in externalCanonicals;
    if (aCede && !bCede) return -1;
    if (!aCede && bCede) return 1;
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
  const sorted = sortQueriesByPriority(queries, anchors, externalCanonicals, topicCoverage);
  const visible = expanded ? sorted : sorted.slice(0, QUERY_CHIPS_VISIBLE_CAP);
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
            +{hidden} more
          </button>
        )}
        {expanded && sorted.length > QUERY_CHIPS_VISIBLE_CAP && (
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
// the production site. A path must either (a) have a hyphen in its first
// segment — real slugs almost always do, e.g. /affordable-hearing-aids — or
// (b) have two or more segments, e.g. /hearing-aids/walmart. This excludes
// ambiguous /word matches (a stray "/seo" reference or "/10" in "8/10")
// without losing canonical single-segment slugs.
const PATH_RE = /\/[a-z0-9]+-[a-z0-9-]+(?:\/[a-z0-9][a-z0-9-]*)*|\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)+/g;

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
    <div>
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
      <div className="text-foreground mt-0.5 text-base font-semibold tabular-nums leading-tight">
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
