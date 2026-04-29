"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentItem } from "./types";
import { updateContentItem } from "../actions";

interface QuickEditDatesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentItem;
  onSuccess?: () => void;
}

export function QuickEditDates({
  open,
  onOpenChange,
  item,
  onSuccess,
}: QuickEditDatesProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dueDate, setDueDate] = useState<string>(item.due_date || "");
  const [scheduledDate, setScheduledDate] = useState<string>(
    item.scheduled_date || ""
  );
  const [scheduledTime, setScheduledTime] = useState<string>(
    item.scheduled_time || ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await updateContentItem(item.id, {
        due_date: dueDate || null,
        scheduled_date: scheduledDate || null,
        scheduled_time: scheduledTime || null,
      });

      if (result.success) {
        onSuccess?.();
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Dates</DialogTitle>
            <DialogDescription>
              Update dates for &ldquo;{item.title}&rdquo;
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="scheduled_date">Scheduled Date</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="scheduled_time">Scheduled Time</Label>
              <Input
                id="scheduled_time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
