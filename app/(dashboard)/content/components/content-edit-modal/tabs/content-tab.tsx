"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { EditorJSData, ContentItemInput } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Dynamic import to avoid SSR issues with Editor.js
const EditorWrapper = dynamic(
  () => import("../../editor/editor-wrapper").then((mod) => mod.EditorWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[300px] border rounded-md bg-background p-4">
        <Skeleton className="h-6 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-2" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    ),
  }
);

interface ContentTabProps {
  formData: ContentItemInput;
  onChange: (updates: Partial<ContentItemInput>) => void;
  onBodyChange: (body: EditorJSData) => void;
}

export function ContentTab({ formData, onChange, onBodyChange }: ContentTabProps) {
  // Cards promoted from a brief carry these fields; ones created straight in
  // Content usually do not, so only expand when there is something to read.
  const [briefOpen, setBriefOpen] = useState(
    () => Boolean(formData.content_goals || formData.notes || formData.source)
  );

  return (
    <div className="h-full space-y-4">
      <Collapsible open={briefOpen} onOpenChange={setBriefOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium hover:bg-muted/60">
          Brief
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              briefOpen ? "rotate-180" : ""
            }`}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 rounded-b-md border border-t-0 p-3">
          <div className="grid gap-2">
            <Label htmlFor="content_goals">Content Goals</Label>
            <Textarea
              id="content_goals"
              value={formData.content_goals || ""}
              onChange={(e) => onChange({ content_goals: e.target.value || null })}
              placeholder="What should this content achieve?"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => onChange({ notes: e.target.value || null })}
              placeholder="Anything else the writer should know..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              value={formData.source || ""}
              onChange={(e) => onChange({ source: e.target.value || null })}
              placeholder="Where did this originate?"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <EditorWrapper
        data={formData.body || null}
        onChange={onBodyChange}
        placeholder="Start writing your content..."
      />
    </div>
  );
}
