"use client";

// Shared "Human checklist" grouping used by the cluster card on /seo and the
// SEO tab inside the content edit modal. The same visual treatment in both
// places means an editor opening the brief sees the exact same required /
// recommended pills they saw on the SEO board.

import { ListChecks } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SeoOpportunity } from "../types";

type ChecklistItem = SeoOpportunity["editor_gap_checklist"][number];

function checklistStatusTone(status: ChecklistItem["status"]): string {
  if (status === "required") return "bg-amber-100 text-amber-900 ring-amber-200";
  if (status === "recommended") return "bg-white text-zinc-700 ring-zinc-200";
  return "bg-zinc-100 text-zinc-500 ring-zinc-200";
}

export function HumanChecklistBreakdown({
  items,
}: {
  items: SeoOpportunity["editor_gap_checklist"];
}) {
  const required = items.filter((item) => item.status === "required");
  const recommended = items.filter((item) => item.status === "recommended");

  return (
    <div>
      <div className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        <ListChecks className="h-3 w-3" />
        Human checklist
      </div>
      <div className="space-y-2">
        {required.length > 0 && (
          <ChecklistGroup
            title="Required before assigning"
            items={required}
            prefix="Required"
          />
        )}
        {recommended.length > 0 && (
          <ChecklistGroup
            title="Recommended review"
            items={recommended}
            prefix="Check"
          />
        )}
      </div>
    </div>
  );
}

function ChecklistGroup({
  title,
  items,
  prefix,
}: {
  title: string;
  items: SeoOpportunity["editor_gap_checklist"];
  prefix: "Required" | "Check";
}) {
  return (
    <div>
      <div
        className={cn(
          "mb-1 text-[10px] font-semibold uppercase tracking-wider",
          prefix === "Required" ? "text-amber-800" : "text-zinc-500",
        )}
      >
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex cursor-help items-center rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset",
                  checklistStatusTone(item.status),
                )}
              >
                {prefix}: {item.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <span className="font-medium">
                {prefix === "Required" ? "Must be verified" : "Helpful to review"}
              </span>
              {item.reason ? `: ${item.reason}` : ""}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
