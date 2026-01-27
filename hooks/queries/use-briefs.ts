"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getBriefs,
  createBrief,
  updateBrief,
  deleteBrief,
} from "@/app/(dashboard)/strategy/actions";
import type { ContentBrief, ContentBriefInput } from "@/app/(dashboard)/strategy/components/types";

export function useBriefs() {
  return useQuery({
    queryKey: queryKeys.briefs.list(),
    queryFn: getBriefs,
  });
}

export function useCreateBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContentBriefInput) => createBrief(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.briefs.all });
    },
  });
}

export function useUpdateBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ContentBriefInput> }) =>
      updateBrief(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.briefs.all });
    },
  });
}

export function useDeleteBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteBrief(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.briefs.list() });
      const previous = queryClient.getQueryData<ContentBrief[]>(queryKeys.briefs.list());
      queryClient.setQueryData<ContentBrief[]>(
        queryKeys.briefs.list(),
        (old) => old?.filter((b) => b.id !== deletedId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.briefs.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.briefs.all });
    },
  });
}
