"use client";

import { Calendar, ExternalLink, FileText, Newspaper, RefreshCw, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useManualSeoQueueItems,
  useUpdateManualSeoQueueItemStatus,
} from "@/hooks/queries";
import { cn } from "@/lib/utils";
import type {
  SeoManualQueueItem,
  SeoManualQueuePriority,
  SeoManualQueueTaskType,
  SeoOppStatus,
} from "../types";

const TASK_META: Record<
  SeoManualQueueTaskType,
  { label: string; Icon: typeof FileText; className: string }
> = {
  article_update: {
    label: "Article update",
    Icon: FileText,
    className: "bg-blue-100 text-blue-900 ring-blue-200",
  },
  update_event: {
    label: "Update event",
    Icon: Newspaper,
    className: "bg-amber-100 text-amber-900 ring-amber-200",
  },
  manual_article: {
    label: "Manual article",
    Icon: RefreshCw,
    className: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  },
  reopen_monitor: {
    label: "Reopen monitor",
    Icon: RotateCcw,
    className: "bg-slate-100 text-slate-800 ring-slate-200",
  },
};

const PRIORITY_META: Record<SeoManualQueuePriority, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-rose-100 text-rose-900 ring-rose-200" },
  high: { label: "High", className: "bg-amber-100 text-amber-900 ring-amber-200" },
  medium: { label: "Medium", className: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
  low: { label: "Low", className: "bg-slate-100 text-slate-600 ring-slate-200" },
};

const STATUS_LABELS: Record<SeoOppStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  dismissed: "Dismissed",
};

export function ManualSeoQueue() {
  const { data, isLoading } = useManualSeoQueueItems();
  const items = data ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-14 w-full" />
      </div>
    );
  }

  if (items.length === 0) return null;

  const visible = items.slice(0, 6);
  const hidden = items.length - visible.length;

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Manual SEO queue</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {items.length} editor-added task{items.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <ul className="divide-y">
        {visible.map((item) => (
          <ManualQueueRow key={item.id} item={item} />
        ))}
      </ul>

      {hidden > 0 && (
        <div className="bg-muted/30 px-4 py-2 text-[12px] text-muted-foreground">
          +{hidden} more manual task{hidden === 1 ? "" : "s"} in the queue
        </div>
      )}
    </section>
  );
}

function ManualQueueRow({ item }: { item: SeoManualQueueItem }) {
  const taskMeta = TASK_META[item.task_type];
  const priorityMeta = PRIORITY_META[item.priority];
  const { Icon } = taskMeta;

  return (
    <li className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              taskMeta.className,
            )}
          >
            <Icon className="h-3 w-3" />
            {taskMeta.label}
          </span>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              priorityMeta.className,
            )}
          >
            {priorityMeta.label}
          </span>
          {item.event_date && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {item.event_date}
            </span>
          )}
        </div>

        <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">
          {item.summary}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          {item.page ? (
            <a
              href={`https://www.hearingtracker.com${item.page}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono hover:text-foreground hover:underline"
            >
              {item.page}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ) : (
            <span className="font-medium text-foreground/80">{item.target_title}</span>
          )}
          {item.source_url && (
            <>
              <span className="opacity-50">/</span>
              <a
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
              >
                source
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            </>
          )}
          <span className="opacity-50">/</span>
          <span>
            added {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
        </div>

        {item.evidence && (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
            {item.evidence}
          </p>
        )}
      </div>

      <div className="flex items-start sm:justify-end">
        <ManualTaskStatusSelect id={item.id} value={item.status} />
      </div>
    </li>
  );
}

function ManualTaskStatusSelect({ id, value }: { id: number; value: SeoOppStatus }) {
  const mutation = useUpdateManualSeoQueueItemStatus();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        mutation.mutate(
          { id, status: next as SeoOppStatus },
          {
            onError: (err) => toast.error(`Failed: ${(err as Error).message}`),
          },
        );
      }}
      disabled={mutation.isPending}
    >
      <SelectTrigger className="h-7 w-[130px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_LABELS) as SeoOppStatus[]).map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
