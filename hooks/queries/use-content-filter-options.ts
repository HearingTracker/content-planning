"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getFilterOptions } from "@/app/(dashboard)/content/actions";

export function useContentFilterOptions() {
  return useQuery({
    queryKey: queryKeys.content.filterOptions(),
    queryFn: getFilterOptions,
    staleTime: 5 * 60 * 1000, // Filter options don't change often
  });
}
