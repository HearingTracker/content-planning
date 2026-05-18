"use client";

// SEO tab for the content edit modal. Live-sources the linked SEO opportunity
// from cp_seo_opportunities so the brief surfaces the latest synthesis —
// recommendation, editor checklist, FAQ gaps, internal link recs — without
// snapshotting state at conversion time. When the cluster has been
// re-synthesized since the brief was linked, an amber staleness pill flags it.

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ExternalLink,
  Link as LinkIcon,
  RefreshCw,
} from "lucide-react";
import { useSeoOpportunity } from "@/hooks/queries";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { HumanChecklistBreakdown } from "@/app/(dashboard)/seo/components/checklist-breakdown";

interface SeoTabProps {
  opportunityId: number;
  /** Fallback "linked at" timestamp when no manual queue row exists for the
   * linkage (legacy content items that pre-date the manual_queue.linked_content_item_id
   * column). Pass the content item's created_at. */
  fallbackLinkedAt: string | null;
}

export function SeoTab({ opportunityId, fallbackLinkedAt }: SeoTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, isFetching, refetch } =
    useSeoOpportunity(opportunityId);

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.seo.opportunityById(opportunityId),
    });
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          Failed to load linked SEO opportunity
        </div>
        <p className="mt-1 text-xs text-rose-800">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4" />
          Linked SEO opportunity not found
        </div>
        <p className="mt-1 text-xs text-amber-800">
          The opportunity this brief was created from may have been archived or
          deleted. Opportunity id: {opportunityId}.
        </p>
      </div>
    );
  }

  const { opportunity: opp, synthesizedAt, linkedAt } = data;
  const effectiveLinkedAt = linkedAt ?? fallbackLinkedAt;
  const isStale =
    effectiveLinkedAt != null &&
    new Date(synthesizedAt).getTime() > new Date(effectiveLinkedAt).getTime();

  const uncoveredFaqs = opp.faq_gaps.filter((g) => !g.covered);

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="rounded-md border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Linked SEO opportunity
            </div>
            <div className="text-base font-semibold leading-tight">
              {opp.cluster_label}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {opp.page}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRefresh}
                  disabled={isFetching}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh from SEO</TooltipContent>
            </Tooltip>
            <Button asChild variant="outline" size="sm">
              <Link href={`/seo${opp.page}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                View on SEO board
              </Link>
            </Button>
          </div>
        </div>

        {isStale && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-3 inline-flex cursor-help items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200">
                <AlertCircle className="h-3 w-3" />
                Synthesis updated since this brief was linked
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <div>
                Linked: {new Date(effectiveLinkedAt!).toLocaleString()}
              </div>
              <div>
                Synthesized: {new Date(synthesizedAt).toLocaleString()}
              </div>
              <div className="mt-1 text-muted-foreground">
                The cluster row was rewritten after this brief was created.
                Re-check the recommendation and checklist below.
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Recommendation */}
      <Section title="Recommendation">
        {opp.recommendation ? (
          <p className="text-sm leading-relaxed text-zinc-800">
            {opp.recommendation}
          </p>
        ) : (
          <EmptyText>No coverage recommendation on this cluster yet.</EmptyText>
        )}
      </Section>

      {/* Editor checklist */}
      <Section title="Editor checklist">
        {opp.editor_gap_checklist.length > 0 ? (
          <HumanChecklistBreakdown items={opp.editor_gap_checklist} />
        ) : (
          <EmptyText>No checklist items — synthesis hasn&apos;t flagged any gaps.</EmptyText>
        )}
      </Section>

      {/* FAQ gaps (uncovered only) */}
      <Section title="FAQ gaps">
        {uncoveredFaqs.length > 0 ? (
          <ul className="space-y-1.5 text-sm text-zinc-800">
            {uncoveredFaqs.map((gap, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                <div className="min-w-0 flex-1">
                  {gap.question}
                  {gap.volume != null && (
                    <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                      {gap.volume.toLocaleString()}/mo
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyText>
            {opp.faq_gaps.length === 0
              ? "No FAQ candidates surfaced for this cluster."
              : "All surfaced FAQ candidates are already covered on the page."}
          </EmptyText>
        )}
      </Section>

      {/* Internal link recommendations */}
      <Section title="Internal link gaps">
        {opp.internal_link_recommendations.length > 0 ? (
          <ul className="space-y-2 text-sm text-zinc-800">
            {opp.internal_link_recommendations.map((link, i) => (
              <li
                key={i}
                className="rounded-md border bg-white p-2.5 text-xs leading-snug"
              >
                <div className="flex flex-wrap items-center gap-1">
                  <LinkIcon className="h-3 w-3 text-zinc-500" />
                  <span className="text-muted-foreground">
                    {directionLabel(link.direction)}
                  </span>
                  <span className="font-mono text-zinc-900">{link.target_page}</span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  Anchor:{" "}
                  <span className="font-medium text-zinc-800">
                    &ldquo;{link.suggested_anchor_text}&rdquo;
                  </span>
                  <span className="ml-2 tabular-nums">
                    · {Math.round(link.confidence * 100)}% confidence
                  </span>
                </div>
                {link.reason && (
                  <div className="mt-1 text-muted-foreground">{link.reason}</div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyText>No internal link gaps flagged for this cluster.</EmptyText>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-muted-foreground">{children}</p>;
}

function directionLabel(
  direction: "from_current_page" | "to_current_page" | "both",
): string {
  if (direction === "to_current_page") return "Add link to current page:";
  if (direction === "both") return "Consider links both ways:";
  return "Add link from current page:";
}
