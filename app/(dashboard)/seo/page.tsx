"use client";

import { SeoPagesTable } from "./components/seo-pages-table";
import { SyncJobControl } from "./components/sync-job-control";

export default function SeoPage() {
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          The site&apos;s top pages, with each page&apos;s queries grouped into reader-intent{" "}
          <span className="font-medium text-foreground">clusters</span> — sets of related
          queries you can fix together. We flag the clusters where small edits could recover
          the most missed clicks; click any page for its per-cluster breakdown.
        </p>
        <SyncJobControl />
      </div>
      <SeoPagesTable />
    </div>
  );
}
