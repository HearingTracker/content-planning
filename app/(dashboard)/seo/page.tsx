"use client";

import { SeoPagesTable } from "./components/seo-pages-table";
import { RefreshNowButton } from "./components/refresh-now-button";

export default function SeoPage() {
  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm max-w-3xl">
          Pages making affiliate revenue that rank just outside the top 3 — with secondary
          (missing-from-page) and supporting (mentioned but not headlined) keywords ready
          to target. Click a page for the per-keyword breakdown.
        </p>
        <RefreshNowButton />
      </div>
      <SeoPagesTable />
    </div>
  );
}
