"use client";

// Phase 1C synthesis layer — surfaces cross-page findings the per-cluster
// classifier cannot see. Findings split into two buckets relative to the
// current page:
//   • "On this page" — the page is scope_page (e.g. fully_ceded_page)
//   • "Targets this page" — the page is target_page (e.g. orphan_target
//     suggesting we extend this page to claim a topic)

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getSynthesisKindMeta, type SynthesisKindMeta } from "./kind-meta";
import type { SeoSynthesisFinding } from "../types";

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

export function SiteWideContextCallout({
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
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
        <Sparkles className="h-3.5 w-3.5" />
        Site-wide context
      </div>
      <p className="mt-1 text-xs text-foreground/80 leading-snug">
        Cross-page findings the per-cluster classifier cannot see on its own.
      </p>

      <Tabs
        value={active.kind}
        onValueChange={setActiveKind}
        className="mt-3 gap-3"
      >
        <TabsList className="bg-white/70 ring-1 ring-inset ring-slate-200 h-auto flex-wrap gap-1 p-1">
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
              <span className="text-xs font-medium text-foreground truncate">
                {f.scope_query ?? f.scope_page ?? ""}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
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
