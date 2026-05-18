"use client";

import { useState } from "react";
import { SeoPagesTable } from "./components/seo-pages-table";
import { SyncJobControl } from "./components/sync-job-control";
import { ManualSeoQueue } from "./components/manual-seo-queue";
import { ManualSeoTaskDialog } from "./components/manual-seo-task-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SeoPage() {
  // Manual-task dialog is controlled here so both the toolbar button (top-right)
  // and the queue's empty-state CTA can open it.
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          The site&apos;s top pages, with each page&apos;s queries grouped into reader-intent{" "}
          <span className="font-medium text-foreground">clusters</span> — sets of related
          queries you can fix together. We flag the clusters where small edits could recover
          the most missed clicks; click any page for its per-cluster breakdown.
        </p>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
            <Plus />
            Add manual task
          </Button>
          <ManualSeoTaskDialog
            open={taskDialogOpen}
            onOpenChange={setTaskDialogOpen}
            hideTrigger
          />
          <SyncJobControl />
        </div>
      </div>
      <ManualSeoQueue onAddTask={() => setTaskDialogOpen(true)} />
      <SeoPagesTable />
    </div>
  );
}
