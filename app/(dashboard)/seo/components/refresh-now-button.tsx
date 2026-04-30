"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUserRole } from "@/hooks/queries";
import { useRefreshSeoNow } from "@/hooks/queries";

export function RefreshNowButton() {
  const { data: role } = useCurrentUserRole();
  const mutation = useRefreshSeoNow();

  if (role !== "admin") return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() =>
        mutation.mutate(undefined, {
          onSuccess: (data) => toast.success(`Synced ${data.pages} pages, ${data.opportunities} opportunities`),
          onError: (err) => toast.error(`Refresh failed: ${(err as Error).message}`),
        })
      }
    >
      <RefreshCw className={`h-4 w-4 ${mutation.isPending ? "animate-spin" : ""}`} />
      {mutation.isPending ? "Syncing…" : "Refresh now"}
    </Button>
  );
}
