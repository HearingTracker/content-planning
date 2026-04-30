"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Sparkles } from "lucide-react";
import { useSeoOpportunities } from "@/hooks/queries";
import { KindBadge } from "./kind-badge";
import { KdPill } from "./kd-pill";
import { StatusSelect } from "./status-select";
import type { SeoPage } from "../types";

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        {page && (
          <>
            <SheetHeader>
              <SheetTitle className="text-lg">
                <a
                  href={`https://www.hearingtracker.com${page.page}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  {page.page} <ExternalLink className="h-4 w-4" />
                </a>
              </SheetTitle>
              <SheetDescription>
                {page.page_title || "(no title)"}
                <br />
                <span className="text-xs">
                  ${page.earnings_90d.toFixed(0)} / 90d · {page.conversions_90d} conversions ·
                  source: {page.meta_source ?? "unknown"}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-2">
              {isLoading && (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              )}
              {!isLoading && (opps?.length ?? 0) === 0 && (
                <p className="text-muted-foreground text-sm">
                  No open opportunities — try adjusting the cron min-impressions threshold or wait for the next sync.
                </p>
              )}
              {opps?.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{o.query}</span>
                        <KindBadge kind={o.kind} />
                        <KdPill kd={o.kd} />
                      </div>

                      <div className="text-muted-foreground mt-1 text-xs flex items-center gap-3 flex-wrap">
                        <span>pos {o.position?.toFixed(1) ?? "—"}</span>
                        <span>{o.impressions?.toLocaleString() ?? "—"} imp</span>
                        <span>{o.clicks?.toLocaleString() ?? "—"} clk</span>
                        <span>CTR {o.ctr_pct ?? 0}% (vs {o.expected_ctr_pct ?? 0}% expected)</span>
                        {o.volume != null && <span>· vol {o.volume.toLocaleString()}</span>}
                      </div>

                      {o.kind !== "primary" && (
                        <div className="text-muted-foreground mt-2 text-xs flex items-center gap-2">
                          <Sparkles className="h-3 w-3" />
                          {o.kind === "secondary"
                            ? <>Add this to the page — current body mentions: <span className="font-mono">{o.phrase_in_body}</span></>
                            : <>Mentioned in body{o.in_heading ? " (in heading)" : ""} — promote to a heading or title</>}
                          {o.novel_tokens && (
                            <span className="ml-1 italic">
                              missing tokens: {o.novel_tokens}
                            </span>
                          )}
                        </div>
                      )}

                      {o.parent_topic && (
                        <div className="text-muted-foreground mt-1 text-xs">
                          parent topic: <span className="text-foreground">{o.parent_topic}</span>
                          {o.intents && <> · {o.intents}</>}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <StatusSelect id={o.id} value={o.status} />
                      <span className="text-muted-foreground text-[10px]">score {o.score}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
