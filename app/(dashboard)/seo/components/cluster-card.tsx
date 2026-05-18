"use client";

// Single-cluster card used by the per-page SEO detail view at /seo/[...slug].
// The coverage classifier (Phase 1B) fills in kind/recommendation/confidence
// per cluster; pre-classified rows still render with kind='needs_review' and
// a neutral guidance footer prompting an admin re-sync.
//
// Typography scale (post-2026-05 polish pass): the file uses just four label
// sizes — 10/11/13/14 — plus shadcn body defaults (text-xs = 12, text-sm = 14,
// text-base = 16). Fractional sizes (text-[11px] etc.) have been normalized
// to the nearest of these so the type rhythm stays predictable.

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  CheckCircle2,
  CornerUpRight,
  ExternalLink,
  Info,
  Link as LinkIcon,
  ListChecks,
  MoreHorizontal,
  Send,
  Sparkles,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
  useConvertOpportunityToContentItem,
  useUpdateOpportunityStatus,
} from "@/hooks/queries";
import { getKindMeta, getSynthesisKindMeta } from "./kind-meta";
import { HumanChecklistBreakdown } from "./checklist-breakdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { SeoOpportunity, SeoSynthesisFinding } from "../types";

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

export function ClusterCard({
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
  const clusterCanonicalTarget = isNonEdit ? routeTargetFromExternalCanonicals(o) : null;
  const routeTarget = isNonEdit
    ? clusterCanonicalTarget
      ?? anchorFindings.find((f) => f.target_page && f.target_page !== currentPage)?.target_page
      ?? null
    : null;
  const visibleAnchorFindings = routeTarget
    ? anchorFindings.filter((f) => f.target_page !== routeTarget)
    : anchorFindings;

  const isPending = o.kind === "needs_review";

  // A10: when the green "Ready to edit" banner is suppressed (either
  // low-confidence or no guardrails), the editor would otherwise see no
  // actionability cue at all. A quiet emerald pill in the header re-surfaces
  // the signal without re-introducing the green/amber stacking problem.
  const showReadyPill =
    o.actionability === "ready"
    && (
      o.guardrails.length === 0
      || (o.confidence != null && o.confidence < 0.6)
    );

  return (
    // D2: stable anchor ID so the sticky cluster nav can scroll-into-view.
    <article
      id={`cluster-${o.id}`}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-background shadow-sm scroll-mt-20",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", meta.tone.stripe)} aria-hidden />

      {/* F1: header is now two lines so the headline stops competing with the
          inline pill stack. Line 1 = icon + title + (optional ready pill) +
          overflow menu. Line 2 = kind eyebrow + factual pills (rank, KD,
          brand, page type). F2: ConvertToEditorial + StatusSelect collapsed
          into a single DropdownMenu — status changes are the high-frequency
          action; the overflow trigger keeps them one click away without
          competing visually with the headline. */}
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
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-foreground text-lg font-semibold leading-tight tracking-tight truncate">
                {o.cluster_label}
              </h3>
              {showReadyPill && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  ready
                </span>
              )}
            </div>
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

        <ClusterOverflowMenu opp={o} />
      </header>

      <ActionabilityNotice
        actionability={o.actionability}
        guardrails={o.guardrails}
        confidence={o.confidence}
        hasRecommendation={!!o.recommendation}
      />

      {/* Recommendation — surfaced near the top so the editor's first read is
          the actual instruction. Low-confidence warning sits beneath; the
          green "Ready to edit" banner above auto-suppresses when confidence is
          low so green-go and amber-stop don't stack on the same prose. */}
      {o.recommendation ? (
        <div className="px-5 py-3">
          <RecommendationBlock text={o.recommendation} />
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

      {/* Realism strip — answers "can we even outrank this?" in one read so the
          editor doesn't dig through the audit only to dismiss. Drives off
          competitor_realism (prompt v19+) and the SERP top-organic snapshot. */}
      <RealismStrip opp={o} currentPage={currentPage} />

      {routeTarget && <RoutingSuggestion targetPage={routeTarget} />}

      {/* E1-E3: context tabs — three sibling <details> panels (SERP / FAQ /
          Why) consolidated into a single Tabs strip so the cluster card has
          one "context container" instead of three competing accordions. The
          default tab favors SERP reality first, then FAQ, then audit detail. */}
      <ClusterContextTabs opp={o} currentPage={currentPage} isNonEdit={isNonEdit} />

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

      {/* Aggregate metrics — single horizontal strip. Hairlines come from a
          1px grid gap revealing the parent's bg-border, so the strip reads
          as one piece of furniture rather than 4 individually-bordered tiles. */}
      <div className="mt-4 grid grid-cols-2 gap-px border-y border-zinc-100 bg-zinc-100 sm:grid-cols-4">
        <Metric
          label="Impressions / mo"
          value={totalImp.toLocaleString()}
          sub="28d · GSC"
          help="Total monthly impressions across all queries in this cluster, from Google Search Console."
        />
        <Metric
          label="Search vol."
          value={totalVol > 0 ? totalVol.toLocaleString() : "—"}
          sub="DataForSEO"
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
          sub="28d window"
          help="Mean Google ranking position across the cluster's queries (last 28 days)."
        />
      </div>

      {/* Missed clicks insight — borderless prose so it reads as a footnote
          to the metrics strip directly above, not as a competing callout. */}
      {lift && (
        <div className="mx-5 mt-2 flex items-start gap-1.5 text-xs leading-snug">
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
          <p className="text-slate-700 text-xs leading-relaxed">
            Reader-intent guidance for this cluster has not been generated yet. The metrics
            above show the size of the opportunity; the recommended action will appear once
            the coverage classifier runs.
          </p>
        </div>
      )}

      {/* Footer — quiet reference strip. The pager's "Cluster X of Y" already
          conveys priority, so the raw score is omitted; surface it only on
          demand via the tooltip on the priority hint icon. */}
      {(o.canonical_query || o.dataforseo_intent_prior || o.match_decision === "review") && (
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
              <span className="ml-auto inline-flex items-center gap-1 tabular-nums opacity-70 cursor-help">
                priority {o.score}
                <Info className="h-3 w-3 opacity-60" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <PriorityTooltipContent opp={o} />
            </TooltipContent>
          </Tooltip>
        </footer>
      )}
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

function routeTargetFromExternalCanonicals(opp: SeoOpportunity): string | null {
  const counts = new Map<string, number>();
  for (const canonical of Object.values(opp.external_canonicals)) {
    const path = pathFromCanonicalUrl(canonical.url);
    if (!path || path === opp.page) continue;
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const aDepth = a[0].split("/").filter(Boolean).length;
      const bDepth = b[0].split("/").filter(Boolean).length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a[0].length - b[0].length;
    })[0][0];
}

function pathFromCanonicalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url.startsWith("/") ? url.replace(/\/+$/, "") || "/" : null;
  }
}

// F2: a single overflow menu keeps status changes and the editorial handoff in
// one place. Status is only workflow state; an opportunity is "on editorial"
// only when a linked content item exists.
const EDITORIAL_BLOCKED_KINDS = new Set<SeoOpportunity["kind"]>([
  "coverage_strong",
  "wrong_page",
  "cede",
  "needs_review",
]);

const STATUS_OPTIONS: Array<{ value: SeoOpportunity["status"]; label: string }> = [
  { value: "open",        label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done",        label: "Done" },
  { value: "dismissed",   label: "Dismissed" },
];

function ClusterOverflowMenu({ opp }: { opp: SeoOpportunity }) {
  const convertMutation = useConvertOpportunityToContentItem();
  const statusMutation = useUpdateOpportunityStatus();

  const linkedContentItemId = opp.linked_content_item_id;
  const hasEditorialItem = linkedContentItemId != null;
  const blockedReason = getEditorialBlockedReason(opp);
  const sendAvailable = !hasEditorialItem && blockedReason == null;
  const sendDisabled = !sendAvailable || convertMutation.isPending;

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === opp.status)?.label ?? opp.status;
  const statusTone = STATUS_TONE[opp.status];

  function openEditorialItem(contentItemId: number) {
    if (typeof window !== "undefined") {
      window.open(`/content?item=${contentItemId}`, "_blank", "noopener");
    }
  }

  function sendToEditorial() {
    if (sendDisabled) return;
    convertMutation.mutate(
      { oppId: opp.id },
      {
        onSuccess: (res: { success: boolean; contentItemId?: number; error?: string }) => {
          if (!res.success) {
            toast.error(res.error ?? "Failed to send to editorial");
            return;
          }
          toast.success("Sent to editorial", {
            description: res.contentItemId
              ? `Content item #${res.contentItemId} created.`
              : undefined,
            action: res.contentItemId
              ? {
                  label: "Open",
                  onClick: () => {
                    if (typeof window !== "undefined") {
                      window.open(`/content?item=${res.contentItemId}`, "_blank", "noopener");
                    }
                  },
                }
              : undefined,
          });
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Failed to send to editorial");
        },
      },
    );
  }

  return (
    <div className="shrink-0 flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
          statusTone,
        )}
      >
        {statusLabel}
      </span>
      {hasEditorialItem && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => openEditorialItem(linkedContentItemId)}
              className="hidden h-7 items-center gap-1.5 rounded-md bg-zinc-900 px-2 text-[11px] font-medium text-white hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Editorial
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            Open linked content item #{linkedContentItemId}.
          </TooltipContent>
        </Tooltip>
      )}
      {sendAvailable && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={convertMutation.isPending}
              onClick={sendToEditorial}
              className="hidden h-7 items-center gap-1.5 rounded-md bg-zinc-900 px-2 text-[11px] font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 sm:inline-flex"
            >
              <Send className="h-3.5 w-3.5" />
              {convertMutation.isPending ? "Sending" : "Editorial"}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            Create a linked content item and mark this opportunity in progress.
          </TooltipContent>
        </Tooltip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Cluster actions"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Status
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={opp.status}
            onValueChange={(next) => {
              if (next === opp.status) return;
              statusMutation.mutate(
                { id: opp.id, status: next as SeoOpportunity["status"] },
                { onError: (err) => toast.error(`Failed: ${(err as Error).message}`) },
              );
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hasEditorialItem && sendDisabled}
            onSelect={(e) => {
              if (hasEditorialItem) {
                openEditorialItem(linkedContentItemId);
                return;
              }
              if (sendDisabled) {
                e.preventDefault();
                return;
              }
              sendToEditorial();
            }}
            className="text-sm gap-2"
          >
            {hasEditorialItem ? (
              <ExternalLink className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {hasEditorialItem
              ? "Open editorial item"
              : convertMutation.isPending
                ? "Sending..."
                : blockedReason ?? (opp.status === "in_progress"
                  ? "Create editorial item"
                  : "Send to editorial")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getEditorialBlockedReason(opp: SeoOpportunity): string | null {
  if (opp.status === "done") return "Reopen before editorial";
  if (opp.kind === "needs_review" || opp.actionability === "review") {
    return "Needs review before editorial";
  }
  if (opp.kind === "coverage_strong" || opp.actionability === "monitor") {
    return "Monitor only";
  }
  if (opp.kind === "wrong_page" || opp.kind === "cede" || opp.actionability === "blocked") {
    return "Route elsewhere first";
  }
  if (EDITORIAL_BLOCKED_KINDS.has(opp.kind)) return "Not an editorial task";
  return null;
}

const STATUS_TONE: Record<SeoOpportunity["status"], string> = {
  open:        "bg-blue-50 text-blue-800 ring-blue-200",
  in_progress: "bg-amber-50 text-amber-800 ring-amber-200",
  done:        "bg-emerald-50 text-emerald-800 ring-emerald-200",
  dismissed:   "bg-zinc-50 text-zinc-600 ring-zinc-200",
};

function RoutingSuggestion({ targetPage }: { targetPage: string }) {
  return (
    <div className="mx-5 mb-2 rounded-md bg-slate-50 px-3 py-2 text-xs leading-snug text-slate-800 ring-1 ring-inset ring-slate-200">
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

// Realism strip — verdict pill + competitor mix + AIO badge. Drives off
// competitor_realism (prompt v19+); falls back gracefully when the field
// is null (older rows or fail-soft fallback) by inferring from authority
// share + AIO presence. Hover surfaces the model's reasoning sentence.
function RealismStrip({
  opp,
  currentPage,
}: {
  opp: SeoOpportunity;
  currentPage: string;
}) {
  // Count authority + forum tiers in the first captured organic results.
  const top5 = opp.serp_top_organic.slice(0, 5);
  const tiers = top5.map((r) => classifyAuthorityTier(r.domain));
  const authorityCount = tiers.filter((t) => t === "authority").length;
  const forumCount = tiers.filter((t) => t === "forum").length;
  const ownResult = top5.find((r) => urlMatchesPath(r.url, currentPage));
  const aioPresent = !!opp.aio_serp?.aio_present_on_serp;
  const aioCited = !!opp.aio_serp?.aio_citation_seen;

  // When we have no SERP snapshot AND no realism verdict, skip rendering —
  // the realism strip would be a guess and the audit panel already covers
  // AIO-only signals.
  if (top5.length === 0 && !opp.competitor_realism && !aioPresent) {
    return null;
  }

  const verdict = opp.competitor_realism?.verdict ?? null;
  const verdictMeta = verdictPillMeta(verdict, { authorityCount, top5Len: top5.length, aioPresent });

  return (
    <div className="mx-5 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px]">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold cursor-help ring-1 ring-inset",
              verdictMeta.tone,
            )}
          >
            <verdictMeta.Icon className="h-3 w-3" />
            {verdictMeta.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs leading-snug">
          {opp.competitor_realism?.reasoning
            ? opp.competitor_realism.reasoning
            : verdictMeta.fallbackTooltip}
        </TooltipContent>
      </Tooltip>

      {top5.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 ring-1 ring-inset ring-zinc-200 cursor-help">
              <span className="tabular-nums">{authorityCount}/{top5.length}</span>
              authority
              {forumCount > 0 && (
                <span className="text-zinc-500"> · {forumCount} forum</span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs leading-snug">
            Among the first {top5.length} captured organic results, {authorityCount} are curated authority
            domains (.gov / .edu / Mayo / NIH / Forbes / etc).
            {forumCount > 0 && ` ${forumCount} are forum / community domains.`}
            {" "}Open the competitor gap panel below to see them.
          </TooltipContent>
        </Tooltip>
      )}

      {aioPresent && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 ring-1 ring-inset cursor-help",
                aioCited
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-amber-50 text-amber-800 ring-amber-200",
              )}
            >
              <Sparkles className="h-3 w-3" />
              {aioCited ? "AIO cites HT" : "AIO present"}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs leading-snug">
            {aioCited
              ? "Google's AI Overview cites HearingTracker as a source — the AIO is helping, not hurting."
              : "Google's AI Overview answers above the organic results without citing HearingTracker. Top-3 organic CTR is suppressed; consider passage-level GEO rewrites."}
          </TooltipContent>
        </Tooltip>
      )}

      {ownResult && (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 className="h-3 w-3" />
          this page ranks #{ownResult.rank}
        </span>
      )}
    </div>
  );
}

type AuthorityTier = "authority" | "forum" | "competitor";
// Authority/forum classification mirrors lib/seo/authority.ts. Kept tiny
// here so the client bundle doesn't pull in the server-only module path.
const AUTHORITY_SUFFIXES = [
  "gov", "edu", "mayoclinic.org", "nih.gov", "hopkinsmedicine.org",
  "harvard.edu", "clevelandclinic.org", "webmd.com", "healthline.com",
  "medlineplus.gov", "consumerreports.org", "forbes.com", "nytimes.com",
  "wsj.com", "asha.org", "ncoa.org", "hearingloss.org",
];
const FORUM_SUFFIXES = ["reddit.com", "quora.com", "answers.com"];
function classifyAuthorityTier(domain: string): AuthorityTier {
  const d = domain.toLowerCase();
  if (AUTHORITY_SUFFIXES.some((s) => d === s || d.endsWith(`.${s}`))) return "authority";
  if (FORUM_SUFFIXES.some((s) => d === s || d.endsWith(`.${s}`))) return "forum";
  return "competitor";
}
function urlMatchesPath(url: string, path: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== "hearingtracker.com" && !host.endsWith(".hearingtracker.com")) {
      return false;
    }
    return parsed.pathname.replace(/\/+$/, "") === path.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

function serpResultPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

function verdictPillMeta(
  verdict: "winnable" | "snippet_only" | "unrealistic" | null,
  ctx: { authorityCount: number; top5Len: number; aioPresent: boolean },
): {
  label: string;
  tone: string;
  Icon: typeof CheckCircle2;
  fallbackTooltip: string;
  effective: "winnable" | "snippet_only" | "unrealistic";
} {
  // Use the model's verdict when available. Otherwise infer a coarse fallback:
  //   3+ authority in top 5 → unrealistic
  //   AIO present (any) → snippet_only
  //   else → winnable
  const inferred: "winnable" | "snippet_only" | "unrealistic" =
    ctx.top5Len > 0 && ctx.authorityCount >= 3
      ? "unrealistic"
      : ctx.aioPresent
        ? "snippet_only"
        : "winnable";
  const effective = verdict ?? inferred;
  if (effective === "winnable") {
    return {
      label: "Winnable",
      tone: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      Icon: CheckCircle2,
      fallbackTooltip:
        "No structural cap detected — the SERP looks open to a top-3 result with the right work.",
      effective,
    };
  }
  if (effective === "snippet_only") {
    return {
      label: "Snippet only",
      tone: "bg-amber-50 text-amber-900 ring-amber-200",
      Icon: AlertTriangle,
      fallbackTooltip:
        "Top-3 rank is unlikely, but CTR can still improve via snippet/meta rewrites or an AIO citation.",
      effective,
    };
  }
  return {
    label: "Unrealistic",
    tone: "bg-rose-50 text-rose-800 ring-rose-200",
    Icon: AlertTriangle,
    fallbackTooltip:
      "SERP is structurally owned by authority sites / AIO. On-page work here won't move rank — consider cede or AIO-citation-only.",
    effective,
  };
}

function competitorDecisionCopy(
  verdict: "winnable" | "snippet_only" | "unrealistic",
  ctx: { hasOwnResult: boolean; aioPresent: boolean },
): string {
  if (verdict === "winnable") {
    return ctx.hasOwnResult
      ? "Brief the specific on-page gap: this page is already present, so the work should improve the snippet, answer gaps, or topical coverage."
      : "This is a viable editorial target if the page can match the intent and format of the current winners.";
  }
  if (verdict === "snippet_only") {
    return ctx.aioPresent
      ? "Treat this as CTR and AIO-source work, not a full ranking push: title/meta and passage-level answers are the likely levers."
      : "A full rank jump is unlikely; prioritize snippet improvements and only add body content where a concrete gap exists.";
  }
  return "A dismissal or monitor state is defensible: the visible winners suggest authority, forum intent, or SERP features cap what an article edit can win.";
}

// ─── Context tabs — SERP / FAQ / Why this rec ────────────────────────────
// Tabs strip replacing three sibling <details> panels. Default active tab
// favors the most actionable signal so the editor's first click is rare.

function ClusterContextTabs({
  opp,
  currentPage,
  isNonEdit,
}: {
  opp: SeoOpportunity;
  currentPage: string;
  isNonEdit: boolean;
}) {
  const serpRows = opp.serp_top_organic.slice(0, 5);
  const missingFaq = opp.faq_gaps.filter((g) => !g.covered);
  const coveredFaq = opp.faq_gaps.filter((g) => g.covered);

  const auditAvailable = auditHasContent(opp, isNonEdit);

  const tabs: Array<{ key: "serp" | "faq" | "why"; label: string; count: number; available: boolean }> = [
    { key: "serp", label: "Competitor gap", count: serpRows.filter((r) => classifyAuthorityTier(r.domain) === "authority").length, available: serpRows.length > 0 },
    { key: "faq",  label: "FAQ gap",      count: missingFaq.length, available: opp.faq_gaps.length > 0 },
    { key: "why",  label: "Why this rec", count: countTriggeredSignals(opp), available: auditAvailable },
  ];

  const visible = tabs.filter((t) => t.available);
  if (visible.length === 0) return null;

  const renderPanel = (key: "serp" | "faq" | "why") => {
    if (key === "serp")
      return <SerpContextPanel opp={opp} rows={serpRows} currentPage={currentPage} />;
    if (key === "faq")
      return <FaqGapPanel missing={missingFaq} covered={coveredFaq} isNonEdit={isNonEdit} />;
    return <RecommendationAuditPanel opp={opp} isNonEdit={isNonEdit} />;
  };

  // Single-tab case: skip the TabsList — a lone "Why this rec" button next
  // to its own panel is dead weight. Render an inline label + the panel.
  if (visible.length === 1) {
    const only = visible[0];
    return (
      <div className="mx-5 mt-2 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {only.key === "why" ? <Info className="h-3 w-3 opacity-70" /> : <ListChecks className="h-3 w-3 opacity-70" />}
          {only.label}
          {only.count > 0 && (
            <span className="rounded bg-zinc-200/70 px-1 py-px text-[10px] tabular-nums text-zinc-700">
              {only.count}
            </span>
          )}
        </div>
        {renderPanel(only.key)}
      </div>
    );
  }

  // Default: external competitive reality first. The SERP panel is the fastest
  // way to tell whether this is an editorial task, a snippet task, or a
  // defensible dismissal; FAQ still stays one click away.
  const defaultKey = serpRows.length > 0
    ? "serp"
    : missingFaq.length > 0 && !isNonEdit
      ? "faq"
      : "why";
  const initial = visible.find((t) => t.key === defaultKey)?.key ?? visible[0].key;

  return (
    <Tabs defaultValue={initial} className="mx-5 mt-2 gap-2">
      <TabsList className="bg-zinc-50 ring-1 ring-inset ring-zinc-200 h-auto flex-wrap gap-1 p-1">
        {visible.map((t) => (
          <TabsTrigger
            key={t.key}
            value={t.key}
            className="data-[state=active]:bg-background h-7 px-2.5 text-[11px] font-medium gap-1.5"
          >
            {t.key === "serp" && <ListChecks className="h-3 w-3 opacity-70" />}
            {t.key === "faq"  && <ListChecks className="h-3 w-3 opacity-70" />}
            {t.key === "why"  && <Info       className="h-3 w-3 opacity-70" />}
            {t.label}
            {t.count > 0 && (
              <span className="rounded bg-zinc-200/70 px-1 py-px text-[10px] tabular-nums text-zinc-700">
                {t.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {visible.some((t) => t.key === "serp") && (
        <TabsContent value="serp" className="mt-0">{renderPanel("serp")}</TabsContent>
      )}
      {visible.some((t) => t.key === "faq") && (
        <TabsContent value="faq" className="mt-0">{renderPanel("faq")}</TabsContent>
      )}
      {visible.some((t) => t.key === "why") && (
        <TabsContent value="why" className="mt-0">{renderPanel("why")}</TabsContent>
      )}
    </Tabs>
  );
}

function auditHasContent(opp: SeoOpportunity, isNonEdit: boolean): boolean {
  const audit = opp.recommendation_audit;
  const standalone = opp.standalone_article;
  const links = isNonEdit ? [] : opp.internal_link_recommendations.filter((l) => l.confidence >= 0.75);
  const checklist = isNonEdit ? [] : opp.editor_gap_checklist.filter((i) => i.status !== "not_applicable");
  const aio = opp.aio_serp;
  const showStandalone = !isNonEdit && standalone;
  const showAio = !isNonEdit && aio?.aio_present_on_serp;
  return Boolean(audit || showStandalone || links.length > 0 || checklist.length > 0 || showAio);
}

function countTriggeredSignals(opp: SeoOpportunity): number {
  const a = opp.recommendation_audit;
  if (!a) return 0;
  return [
    a.freshness_trigger.triggered,
    a.intent_trigger.triggered,
    a.content_gap_trigger.triggered,
    a.serp_change_trigger.triggered,
  ].filter(Boolean).length;
}

function SerpContextPanel({
  opp,
  rows,
  currentPage,
}: {
  opp: SeoOpportunity;
  rows: SeoOpportunity["serp_top_organic"];
  currentPage: string;
}) {
  const tiers = rows.map((r) => classifyAuthorityTier(r.domain));
  const authorityCount = tiers.filter((t) => t === "authority").length;
  const forumCount = tiers.filter((t) => t === "forum").length;
  const competitorCount = tiers.filter((t) => t === "competitor").length;
  const ownResult = rows.find((r) => urlMatchesPath(r.url, currentPage));
  const aioPresent = !!opp.aio_serp?.aio_present_on_serp;
  const verdictMeta = verdictPillMeta(opp.competitor_realism?.verdict ?? null, {
    authorityCount,
    top5Len: rows.length,
    aioPresent,
  });

  return (
    <div className="rounded-md ring-1 ring-inset ring-zinc-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 pb-2">
        <span className="text-[11px] text-zinc-600">
          Top {rows.length} organic for &ldquo;{opp.canonical_query}&rdquo;
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
            verdictMeta.tone,
          )}
        >
          <verdictMeta.Icon className="h-3 w-3" />
          {verdictMeta.label}
        </span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-700 ring-1 ring-inset ring-zinc-200">
          {authorityCount} authority
        </span>
        {forumCount > 0 && (
          <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] tabular-nums text-orange-800 ring-1 ring-inset ring-orange-200">
            {forumCount} forum
          </span>
        )}
        {competitorCount > 0 && (
          <span className="rounded bg-zinc-50 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-700 ring-1 ring-inset ring-zinc-200">
            {competitorCount} competitor
          </span>
        )}
        {ownResult && (
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200">
            this page #{ownResult.rank}
          </span>
        )}
      </div>

      <div className="grid gap-3 py-3 text-xs leading-snug text-zinc-700 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Ranking path
          </div>
          <p className="mt-1">
            {competitorDecisionCopy(verdictMeta.effective, {
              hasOwnResult: !!ownResult,
              aioPresent,
            })}
          </p>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Gap read
          </div>
          <p className="mt-1">
            {opp.competitor_realism?.reasoning || verdictMeta.fallbackTooltip}
          </p>
        </div>
      </div>

      <ol className="space-y-1 text-[11px]">
        {rows.map((r) => {
          const tier = classifyAuthorityTier(r.domain);
          const isUs = urlMatchesPath(r.url, currentPage);
          return (
            <li key={`${r.rank}-${r.url}`} className="flex items-start gap-2">
              <span className="w-5 tabular-nums text-zinc-500">#{r.rank}</span>
              <span
                className={cn(
                  "shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
                  tier === "authority" && "bg-violet-50 text-violet-800 ring-violet-200",
                  tier === "forum" && "bg-orange-50 text-orange-800 ring-orange-200",
                  tier === "competitor" && "bg-zinc-50 text-zinc-700 ring-zinc-200",
                )}
              >
                {tier}
              </span>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "min-w-0 truncate text-xs hover:underline",
                  isUs ? "font-semibold text-emerald-900" : "text-zinc-800",
                )}
                title={r.url}
              >
                <span className="font-mono">{r.domain}</span>
                <span className="text-zinc-400"> · {serpResultPath(r.url)}</span>
              </a>
              {isUs && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> this page
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// FAQ-gap panel — PAA + question-keyword candidates the classifier judged.
// For monitor / blocked clusters the evidence stays available but is framed
// as context so it doesn't contradict "no article edit".
function FaqGapPanel({
  missing,
  covered,
  isNonEdit,
}: {
  missing: SeoOpportunity["faq_gaps"];
  covered: SeoOpportunity["faq_gaps"];
  isNonEdit: boolean;
}) {
  const hasMissing = missing.length > 0;
  const missingTitle = isNonEdit ? "Candidates" : "Add these";
  const missingEmptyHint = isNonEdit
    ? "No uncovered candidate questions."
    : "No uncovered questions — nice.";
  return (
    <div className="rounded-md ring-1 ring-inset ring-zinc-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Question candidates
        </span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 ring-1 ring-inset ring-zinc-200">
          SERP/PAA + keyword questions
        </span>
      </div>
      {isNonEdit && hasMissing && (
        <p className="mb-2 rounded bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-slate-600 ring-1 ring-inset ring-slate-200">
          Context only. The recommendation does not call for adding these questions to this page.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FaqGapColumn
          title={missingTitle}
          tone="missing"
          items={missing}
          emptyHint={missingEmptyHint}
        />
        <FaqGapColumn
          title="Already covered"
          tone="covered"
          items={covered}
          emptyHint="No covered candidates yet."
        />
      </div>
    </div>
  );
}

function FaqGapColumn({
  title,
  tone,
  items,
  emptyHint,
}: {
  title: string;
  tone: "missing" | "covered";
  items: SeoOpportunity["faq_gaps"];
  emptyHint: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          {title}
        </span>
        <span className="text-[10px] tabular-nums text-zinc-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] italic text-zinc-500">{emptyHint}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((g) => (
            <li
              key={g.question}
              className={cn(
                "flex items-start gap-2 rounded px-2 py-1 text-xs leading-snug ring-1 ring-inset",
                tone === "missing"
                  ? "bg-amber-50/60 text-amber-900 ring-amber-200/70"
                  : "bg-emerald-50/60 text-emerald-900 ring-emerald-200/70",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left hover:underline cursor-pointer"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    void navigator.clipboard.writeText(g.question).then(
                      () => toast.success("Copied"),
                      () => toast.error("Couldn't copy to clipboard"),
                    );
                  }
                }}
                title="Copy question"
              >
                {g.question}
              </button>
              {g.volume != null && g.volume > 0 && (
                <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                  {g.volume.toLocaleString()}/mo
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
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
  hasRecommendation,
}: {
  actionability: SeoOpportunity["actionability"];
  guardrails: string[];
  confidence: number | null;
  hasRecommendation: boolean;
}) {
  // Ready w/ low confidence: amber warning below the prose carries the
  // signal; an extra green "ready" banner would contradict it.
  if (actionability === "ready" && confidence != null && confidence < 0.6) return null;
  // Ready w/o guardrails: the inline pill in the header already covers this.
  if (actionability === "ready" && guardrails.length === 0) return null;
  // Blocked / monitor: the recommendation prose says the same thing as the
  // notice; surfacing both stacks redundant copy. The kind chip in the
  // header eyebrow ("Write elsewhere" / "Already covered") already names the
  // state. Skip the notice entirely when a recommendation exists.
  if ((actionability === "blocked" || actionability === "monitor") && hasRecommendation) {
    return null;
  }

  const config = {
    ready: {
      label: "Ready to edit",
      text: "Ready to brief on the highlighted anchors.",
      border: "border-emerald-500",
      text_tone: "text-emerald-900",
    },
    review: {
      label: "Review gate",
      text: "Do not assign directly until an editor validates the recommendation.",
      border: "border-amber-500",
      text_tone: "text-amber-900",
    },
    monitor: {
      label: "Monitor only",
      text: "No article edit is recommended for this cluster.",
      border: "border-emerald-500",
      text_tone: "text-emerald-900",
    },
    blocked: {
      label: "Do not target here",
      text: "This intent should be handled by another page.",
      border: "border-slate-400",
      text_tone: "text-slate-700",
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
    <div className={cn("mx-5 mt-3 border-l-2 pl-3 text-xs leading-snug", config.border)}>
      <span className={cn("font-semibold", config.text_tone)}>{config.label}.</span>{" "}
      <span className="text-muted-foreground">
        {config.text}
        {notes.length > 0 && ` ${notes.join("; ")}.`}
      </span>
    </div>
  );
}

const STANDALONE_CRITERION_LABELS: Record<string, string> = {
  not_navigational_gated: "Not user-path",
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
    // Margins are owned by the parent Tabs container; this panel only owns
    // its own padding + ring so it can sit inside a TabsContent without
    // double-margining away from the cluster card.
    <div className="space-y-3 rounded-md bg-white px-3 py-3 ring-1 ring-inset ring-zinc-200">
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
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {standalone.reason}
          </p>
          <StandaloneCriteriaBreakdown standalone={standalone} />
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
              <li key={`${link.source_page}-${link.target_page}-${index}`} className="text-xs leading-snug">
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
        <div className="text-xs leading-snug text-muted-foreground">
          <span className="font-medium text-zinc-800">AIO SERP data:</span>{" "}
          present for {aio.aio_present_on_serp_queries.length} anchor
          {aio.aio_present_on_serp_queries.length === 1 ? "" : "s"};{" "}
          {aio.aio_citation_seen
            ? `HT source seen for ${aio.aio_citation_seen_queries.length}.`
            : "no HT source seen in the Google AIO source list."}
        </div>
      )}

      {checklist.length > 0 && <HumanChecklistBreakdown items={checklist} />}

      {audit && (
        <div className="space-y-1.5 text-xs leading-snug text-muted-foreground">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Signals
          </div>
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
          <p>
            {isNonEdit
              ? "Diagnostic context only; these signals do not make this cluster an editorial task."
              : audit.confidence_rationale}
          </p>
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
      )}
    </div>
  );
}

function standaloneStatusLabel(standalone: NonNullable<SeoOpportunity["standalone_article"]>): string {
  if (standalone.recommended) return "Recommended";
  if (standalone.criteria.not_navigational_gated === false) return "Blocked: user-path";
  if (standalone.criteria.meaningful_demand === false) return "Not enough demand";
  if (standalone.criteria.no_existing_canonical === false) return "Keep as page update";
  if (standalone.score >= 75) return "Near miss";
  return "Not recommended";
}

function standaloneStatusTone(standalone: NonNullable<SeoOpportunity["standalone_article"]>): string {
  if (standalone.recommended) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (standalone.score >= 75) return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-white text-zinc-700 ring-zinc-200";
}

function StandaloneCriteriaBreakdown({
  standalone,
}: {
  standalone: NonNullable<SeoOpportunity["standalone_article"]>;
}) {
  const entries = Object.entries(standalone.criteria);
  const passed = entries.filter(([, value]) => value);
  const failed = entries.filter(([, value]) => !value);

  if (standalone.recommended) {
    return (
      <div className="mt-2">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          Passed criteria
        </div>
        <div className="flex flex-wrap gap-1.5">
          {passed.map(([key]) => (
            <StandaloneCriterionChip key={key} criterionKey={key} tone="passed" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {failed.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-800">
            <AlertTriangle className="h-3 w-3" />
            Blocking criteria
          </div>
          <div className="flex flex-wrap gap-1.5">
            {failed.map(([key]) => (
              <StandaloneCriterionChip key={key} criterionKey={key} tone="blocked" />
            ))}
          </div>
        </div>
      )}

      {passed.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Passed checks
          </div>
          <div className="flex flex-wrap gap-1.5">
            {passed.map(([key]) => (
              <StandaloneCriterionChip key={key} criterionKey={key} tone="muted-pass" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StandaloneCriterionChip({
  criterionKey,
  tone,
}: {
  criterionKey: string;
  tone: "blocked" | "passed" | "muted-pass";
}) {
  const label = STANDALONE_CRITERION_LABELS[criterionKey] ?? criterionKey.replaceAll("_", " ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset",
        tone === "blocked" && "bg-rose-50 text-rose-800 ring-rose-200",
        tone === "passed" && "bg-emerald-50 text-emerald-800 ring-emerald-200",
        tone === "muted-pass" && "bg-zinc-50 text-zinc-600 ring-zinc-200",
      )}
    >
      {tone === "blocked" ? (
        <AlertTriangle className="h-2.5 w-2.5" />
      ) : (
        <CheckCircle2 className={cn("h-2.5 w-2.5", tone === "muted-pass" && "text-zinc-400")} />
      )}
      {tone === "blocked" ? `Blocks: ${label}` : label}
    </span>
  );
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
    navigational_intent_block: "User-path block",
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
          // F3: coverage tier was previously encoded as a small colored dot.
          // Layering two color systems (bg-tone + dot-tone) on one chip made
          // the chip set hard to scan. Now: the chip BG carries role
          // (anchor/canonical/member) and a numeric suffix (e.g. "28%") carries
          // coverage when known. Tier ≠ unknown gets a suffix; canonical-owned
          // chips skip the suffix (the canonical path is already on the chip).
          const showCoverage =
            !canonical && tier !== "unknown" && typeof score === "number";
          return (
            <Tooltip key={q}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset cursor-help",
                    tone,
                  )}
                >
                  {isAnchor && !canonical && <Sparkles className="h-2.5 w-2.5" />}
                  {canonical && <CornerUpRight className="h-2.5 w-2.5 opacity-70" />}
                  <span>{q}</span>
                  {showCoverage && (
                    <span className="tabular-nums text-[10px] opacity-70">
                      {Math.round((score as number) * 100)}%
                    </span>
                  )}
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
    <div className="mx-5 mt-3 rounded-md border border-rose-200/70 bg-rose-50/60 px-3 py-2 text-xs leading-snug">
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

const ACTION_SENTENCE_RE = /^(add|assign|build|consolidate|create|de-target|expand|keep|monitor|move|prioritize|refresh|retarget|rewrite|route|send|update|use|write)\b/i;

function RecommendationBlock({ text }: { text: string }) {
  const { task, context } = splitRecommendation(text);
  return (
    <div className="space-y-2">
      <div className="border-l-2 border-zinc-900 pl-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Recommended task
        </div>
        <p className="mt-0.5 text-[13px] font-medium leading-relaxed text-foreground">
          <RecommendationText text={task} />
        </p>
      </div>
      {context && (
        <div className="pl-3 text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-zinc-700">Context: </span>
          <RecommendationText text={context} />
        </div>
      )}
    </div>
  );
}

function splitRecommendation(text: string): { task: string; context: string | null } {
  const trimmed = text.trim();
  const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [trimmed];
  const actionIndex = sentences.findIndex((sentence) =>
    ACTION_SENTENCE_RE.test(sentence.trim()),
  );
  const taskIndex = actionIndex >= 0 ? actionIndex : 0;
  const task = sentences[taskIndex] ?? trimmed;
  const context = sentences
    .filter((_, index) => index !== taskIndex)
    .join(" ")
    .trim();
  return {
    task,
    context: context.length > 0 ? context : null,
  };
}

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
            // A8: rose was overloaded — used for both "stop / blocked" tones
            // and for inline recommendation paths. Neutral foreground with a
            // soft underline lets rose carry only one meaning across the UI.
            className="font-mono text-xs text-foreground underline decoration-zinc-400 decoration-1 underline-offset-2 hover:decoration-foreground"
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
  sub,
}: {
  label: string;
  value: string;
  help: string;
  delta?: { expected: string; good: boolean } | null;
  /** Lightweight provenance / window marker (e.g. "28d · GSC"). Falls back to
   * an empty placeholder so all four metric cells share the same height. */
  sub?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help bg-background px-5 py-3">
          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
            {label}
          </div>
          <div className="text-foreground mt-1 text-lg font-semibold tabular-nums leading-tight">
            {value}
          </div>
          <div className="mt-0.5 min-h-[1em] text-[10px] tabular-nums leading-tight">
            {delta ? (
              <span className={cn(delta.good ? "text-emerald-700" : "text-rose-700")}>
                vs {delta.expected}
              </span>
            ) : sub ? (
              <span className="text-muted-foreground/80">{sub}</span>
            ) : null}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {help}
      </TooltipContent>
    </Tooltip>
  );
}
