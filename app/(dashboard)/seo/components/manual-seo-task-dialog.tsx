"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateManualSeoQueueItem } from "@/hooks/queries";
import type {
  SeoManualQueueInput,
  SeoManualQueuePriority,
  SeoManualQueueTaskType,
} from "../types";

const TASK_TYPE_LABELS: Record<SeoManualQueueTaskType, string> = {
  article_update: "Article update",
  update_event: "Update event",
  manual_article: "Manual article",
  reopen_monitor: "Reopen monitor item",
};

const PRIORITY_LABELS: Record<SeoManualQueuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const INITIAL_FORM: SeoManualQueueInput = {
  task_type: "article_update",
  page: "",
  target_title: "",
  summary: "",
  evidence: "",
  source_url: "",
  event_date: "",
  priority: "medium",
};

export function ManualSeoTaskDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SeoManualQueueInput>(INITIAL_FORM);
  const mutation = useCreateManualSeoQueueItem();

  const canSubmit =
    form.summary.trim().length > 0 &&
    ((form.page ?? "").trim().length > 0 ||
      (form.target_title ?? "").trim().length > 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || mutation.isPending) return;
    try {
      await mutation.mutateAsync(form);
      toast.success("Manual SEO task added");
      setForm(INITIAL_FORM);
      setOpen(false);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <Button size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add manual task
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add manual SEO task</DialogTitle>
              <DialogDescription>
                Queue an article update, event, or human override that the automated sync
                should not infer on its own.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="seo-task-type">Task type</Label>
                <Select
                  value={form.task_type}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      task_type: value as SeoManualQueueTaskType,
                    }))
                  }
                >
                  <SelectTrigger id="seo-task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TASK_TYPE_LABELS) as SeoManualQueueTaskType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {TASK_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-priority">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      priority: value as SeoManualQueuePriority,
                    }))
                  }
                >
                  <SelectTrigger id="seo-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABELS) as SeoManualQueuePriority[]).map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-page">Page path</Label>
                <Input
                  id="seo-page"
                  placeholder="/hearing-aids/example"
                  value={form.page ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, page: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-title">Article or draft title</Label>
                <Input
                  id="seo-title"
                  placeholder="Article title if no page path exists"
                  value={form.target_title ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, target_title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-event-date">Event date</Label>
                <Input
                  id="seo-event-date"
                  type="date"
                  value={form.event_date ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, event_date: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-source-url">Source URL</Label>
                <Input
                  id="seo-source-url"
                  type="url"
                  placeholder="https://..."
                  value={form.source_url ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, source_url: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="seo-summary">Summary</Label>
                <Textarea
                  id="seo-summary"
                  rows={3}
                  placeholder="What should the editor or writer do?"
                  value={form.summary}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, summary: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="seo-evidence">Evidence and notes</Label>
                <Textarea
                  id="seo-evidence"
                  rows={4}
                  placeholder="Fact-checking needs, testing data, user feedback, formatting notes, or source context"
                  value={form.evidence ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, evidence: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || mutation.isPending}>
                {mutation.isPending ? "Adding..." : "Add task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
