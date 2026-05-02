"use client";

// Per-kind tabs of open synthesis findings, sorted by score desc. Each tab
// contains the same table shape but different evidence columns; the kind-
// specific evidence formatter lives on each row's renderer below.

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSynthesisFindings } from "@/hooks/queries";
import {
  SYNTHESIS_KIND_META,
  getSynthesisKindMeta,
} from "../../components/kind-meta";
import type { SeoSynthesisFinding, SeoSynthesisKindKey } from "../../types";

const TAB_ORDER: SeoSynthesisKindKey[] = [
  "internal_link_gap",
  "fully_ceded_page",
  "brand_cannibalization",
  "undesignated_topic",
  "orphan_target",
  "aio_no_citation",
  "authority_capped_serp",
  "freshness",
];

export function SynthesisDashboard() {
  const [activeTab, setActiveTab] = useState<SeoSynthesisKindKey>(TAB_ORDER[0]);
  const { data: findings, isLoading } = useSynthesisFindings(activeTab, 200);

  const countsByKind = useCountsByKind();

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as SeoSynthesisKindKey)}
      className="space-y-4"
    >
      <TabsList className="bg-muted h-auto flex-wrap gap-1 p-1">
        {TAB_ORDER.map((kind) => {
          const meta = SYNTHESIS_KIND_META[kind];
          const count = countsByKind[kind] ?? 0;
          return (
            <TabsTrigger
              key={kind}
              value={kind}
              className="data-[state=active]:bg-background flex items-center gap-2 px-3 py-1.5"
            >
              <meta.Icon className="h-3.5 w-3.5" />
              <span>{meta.displayLabel}</span>
              <span
                className={cn(
                  "tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  count > 0 ? meta.tone.chip : "bg-zinc-100 text-zinc-500",
                )}
              >
                {count}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {TAB_ORDER.map((kind) => (
        <TabsContent key={kind} value={kind} className="m-0">
          <FindingsTable
            kind={kind}
            isLoading={kind === activeTab && isLoading}
            findings={kind === activeTab ? findings ?? [] : []}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// Quick per-kind count fetcher — runs parallel reads so the tab badges
// reflect open-finding totals without paginating each kind. Cheap because
// the table is bounded (hundreds of rows max).
function useCountsByKind(): Record<SeoSynthesisKindKey, number> {
  const fc = useSynthesisFindings("fully_ceded_page", 1000);
  const ud = useSynthesisFindings("undesignated_topic", 1000);
  const or = useSynthesisFindings("orphan_target", 1000);
  const ai = useSynthesisFindings("aio_no_citation", 1000);
  const au = useSynthesisFindings("authority_capped_serp", 1000);
  const br = useSynthesisFindings("brand_cannibalization", 1000);
  const fr = useSynthesisFindings("freshness", 1000);
  const il = useSynthesisFindings("internal_link_gap", 1000);
  return {
    fully_ceded_page: fc.data?.length ?? 0,
    undesignated_topic: ud.data?.length ?? 0,
    orphan_target: or.data?.length ?? 0,
    aio_no_citation: ai.data?.length ?? 0,
    authority_capped_serp: au.data?.length ?? 0,
    brand_cannibalization: br.data?.length ?? 0,
    freshness: fr.data?.length ?? 0,
    internal_link_gap: il.data?.length ?? 0,
  };
}

// ─── Findings table ────────────────────────────────────────────────────────

function FindingsTable({
  kind,
  isLoading,
  findings,
}: {
  kind: SeoSynthesisKindKey;
  isLoading: boolean;
  findings: SeoSynthesisFinding[];
}) {
  const meta = getSynthesisKindMeta(kind);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-background py-12 text-center">
        <p className="text-foreground text-sm">
          No open <strong>{meta?.displayLabel ?? kind}</strong> findings.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Run a sync to refresh — synthesis runs after the per-cluster classifier.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground border-b">
          <tr className="text-left text-[11px] uppercase tracking-wider">
            <th className="px-3 py-2 font-medium">Scope</th>
            <th className="px-3 py-2 font-medium">Target page</th>
            <th className="px-3 py-2 text-right font-medium tabular-nums">Score</th>
            <th className="px-3 py-2 font-medium">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FindingRow({ finding: f }: { finding: SeoSynthesisFinding }) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-3 py-2.5 align-top">
        <ScopeCell finding={f} />
      </td>
      <td className="px-3 py-2.5 align-top">
        {f.target_page ? <PageLink page={f.target_page} /> : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums align-top">
        {Math.round(f.score).toLocaleString()}
      </td>
      <td className="px-3 py-2.5 align-top">
        <EvidenceCell finding={f} />
      </td>
    </tr>
  );
}

function ScopeCell({ finding: f }: { finding: SeoSynthesisFinding }) {
  if (f.scope_page) {
    return <PageLink page={f.scope_page} />;
  }
  if (f.scope_query) {
    return <span className="font-medium">{f.scope_query}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

function PageLink({ page }: { page: string }) {
  return (
    <a
      href={`https://www.hearingtracker.com${page}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[12.5px] inline-flex items-center gap-1 hover:underline decoration-1 underline-offset-4"
    >
      {page}
      <ExternalLink className="h-3 w-3 opacity-50" />
    </a>
  );
}

function EvidenceCell({ finding: f }: { finding: SeoSynthesisFinding }) {
  const ev = (f.evidence ?? {}) as Record<string, unknown>;
  const sv = numField(ev, "sv");
  const kd = numField(ev, "kd");

  if (f.kind === "fully_ceded_page") {
    const count = numField(ev, "ceded_anchor_count") ?? 0;
    return (
      <span className="text-[12.5px] text-muted-foreground">
        {count} ceded anchor{count === 1 ? "" : "s"}
      </span>
    );
  }
  if (f.kind === "undesignated_topic") {
    const competing = (ev.competing_pages as Array<{ page: string; best_pos: number | null }> | undefined) ?? [];
    return (
      <span className="text-[12.5px] text-muted-foreground">
        SV {sv?.toLocaleString() ?? "?"}/mo, KD {kd ?? "?"}; {competing.length} HT pages compete pos 11–30
      </span>
    );
  }
  if (f.kind === "aio_no_citation") {
    const sources = numField(ev, "aio_source_count") ?? 0;
    return (
      <span className="text-[12.5px] text-muted-foreground">
        SV {sv?.toLocaleString() ?? "?"}/mo; AIO cites {sources} URL{sources === 1 ? "" : "s"}, none HT
      </span>
    );
  }
  if (f.kind === "orphan_target") {
    const cos = numField(ev, "adjacency_cosine");
    const cluster = stringField(ev, "adjacent_cluster_query");
    return (
      <span className="text-[12.5px] text-muted-foreground">
        SV {sv && sv > 0 ? `${sv.toLocaleString()}/mo` : "unknown"}; adjacency {cos?.toFixed(2) ?? "?"} to &ldquo;{cluster ?? "?"}&rdquo;
      </span>
    );
  }
  if (f.kind === "authority_capped_serp") {
    const count = numField(ev, "authority_domain_count") ?? 0;
    const topN = numField(ev, "top_n_checked") ?? 5;
    const htPos = numField(ev, "ht_best_position");
    return (
      <span className="text-[12.5px] text-muted-foreground">
        {count}/{topN} top results from authority domains; HT best pos {htPos ?? "—"}; SV {sv?.toLocaleString() ?? "?"}/mo
      </span>
    );
  }
  if (f.kind === "brand_cannibalization") {
    const brand = stringField(ev, "brand");
    const competing = (ev.competing_pages as Array<unknown> | undefined) ?? [];
    return (
      <span className="text-[12.5px] text-muted-foreground">
        Brand: {brand ?? "?"}; SV {sv?.toLocaleString() ?? "?"}/mo; {competing.length} HT pages compete pos 11–30
      </span>
    );
  }
  if (f.kind === "freshness") {
    const signals = (ev.signals as string[] | undefined) ?? [];
    return (
      <span className="text-[12.5px] text-muted-foreground">
        Signals: {signals.join(", ") || "none"}
      </span>
    );
  }
  if (f.kind === "internal_link_gap") {
    const inbound = numField(ev, "inbound_count") ?? 0;
    const qcount = numField(ev, "qualifying_query_count") ?? 0;
    return (
      <span className="text-[12.5px] text-muted-foreground">
        {inbound} inbound HT links; {qcount} qualifying top-rank quer{qcount === 1 ? "y" : "ies"}
      </span>
    );
  }
  return <span className="text-[12.5px] text-muted-foreground">—</span>;
}

function numField(o: Record<string, unknown>, k: string): number | null {
  const v = o[k];
  return typeof v === "number" ? v : null;
}
function stringField(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  return typeof v === "string" ? v : null;
}
