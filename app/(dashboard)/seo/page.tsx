"use client";

import { SeoPagesTable } from "./components/seo-pages-table";
import { SyncJobControl } from "./components/sync-job-control";

export default function SeoPage() {
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm max-w-3xl">
          Pages making affiliate revenue that rank just outside the top 3, grouped into
          intent-driven clusters. Click a page for the per-cluster breakdown.
        </p>
        <SyncJobControl />
      </div>
      <SeoPagesTable />
    </div>
  );
}
