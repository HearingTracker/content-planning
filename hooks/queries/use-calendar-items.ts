"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getCalendarItems } from "@/app/(dashboard)/content/actions";

export function useCalendarItems(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.content.calendar(start, end),
    queryFn: () => getCalendarItems(start, end),
    enabled: enabled && !!start && !!end,
  });
}
