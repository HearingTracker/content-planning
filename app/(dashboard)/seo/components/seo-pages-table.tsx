"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSeoPages } from "@/hooks/queries";
import { SeoPageDrilldown } from "./seo-page-drilldown";
import type { SeoPage } from "../types";

export function SeoPagesTable() {
  const { data: pages, isLoading, isError, error } = useSeoPages();
  const [active, setActive] = useState<SeoPage | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
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
          No pages synced yet. An admin can click &ldquo;Refresh Now&rdquo; to populate the table.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
              <th className="px-4 py-2 font-medium">Page</th>
              <th className="px-4 py-2 font-medium text-right">$ / 90d</th>
              <th className="px-4 py-2 font-medium text-right">Conv.</th>
              <th className="px-4 py-2 font-medium text-right">Open</th>
              <th className="px-4 py-2 font-medium">Synced</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.page} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 align-top">
                  <button
                    onClick={() => setActive(p)}
                    className="text-left hover:underline"
                  >
                    <div className="font-medium">{p.page}</div>
                    {p.page_title && (
                      <div className="text-muted-foreground text-xs truncate max-w-md">{p.page_title}</div>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 align-top text-right tabular-nums">
                  ${Number(p.earnings_90d).toFixed(0)}
                </td>
                <td className="px-4 py-3 align-top text-right tabular-nums">
                  {p.conversions_90d}
                </td>
                <td className="px-4 py-3 align-top text-right tabular-nums">
                  {p.open_opportunities}
                </td>
                <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(p.last_synced_at), { addSuffix: true })}
                </td>
                <td className="px-4 py-3 align-top">
                  <a
                    href={`https://www.hearingtracker.com${p.page}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SeoPageDrilldown
        page={active}
        open={!!active}
        onOpenChange={(next) => !next && setActive(null)}
      />
    </>
  );
}
