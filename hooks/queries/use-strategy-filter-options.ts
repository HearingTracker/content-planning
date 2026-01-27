"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getStrategyFilterOptions } from "@/app/(dashboard)/strategy/actions";

export function useStrategyFilterOptions() {
  return useQuery({
    queryKey: queryKeys.strategyFilterOptions,
    queryFn: getStrategyFilterOptions,
    staleTime: 5 * 60 * 1000, // Filter options don't change often
  });
}
