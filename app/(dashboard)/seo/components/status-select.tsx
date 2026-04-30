"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateOpportunityStatus } from "@/hooks/queries";
import { toast } from "sonner";
import type { SeoOppStatus } from "../types";

const LABELS: Record<SeoOppStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  dismissed: "Dismissed",
};

export function StatusSelect({ id, value }: { id: number; value: SeoOppStatus }) {
  const mutation = useUpdateOpportunityStatus();

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
        {(Object.keys(LABELS) as SeoOppStatus[]).map((s) => (
          <SelectItem key={s} value={s}>
            {LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
