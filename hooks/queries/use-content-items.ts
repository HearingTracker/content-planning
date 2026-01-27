"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getContentItems,
  createContentItem,
  updateContentItem,
  deleteContentItem,
  changeWorkflowStatus,
  reorderContentItems,
} from "@/app/(dashboard)/content/actions";
import type {
  ContentItem,
  ContentItemInput,
  ContentFilterOptions,
} from "@/app/(dashboard)/content/components/types";

export function useContentItems() {
  return useQuery({
    queryKey: queryKeys.content.lists(),
    queryFn: getContentItems,
  });
}

export function useCreateContentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContentItemInput) => createContentItem(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
    },
  });
}

export function useUpdateContentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ContentItemInput> }) =>
      updateContentItem(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
    },
  });
}

export function useDeleteContentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteContentItem(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.content.lists() });
      const previous = queryClient.getQueryData<ContentItem[]>(queryKeys.content.lists());
      queryClient.setQueryData<ContentItem[]>(
        queryKeys.content.lists(),
        (old) => old?.filter((item) => item.id !== deletedId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.content.lists(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
    },
  });
}

export function useChangeWorkflowStatus(filterOptions: ContentFilterOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, newStatusId }: { itemId: number; newStatusId: number }) =>
      changeWorkflowStatus(itemId, newStatusId),
    onMutate: async ({ itemId, newStatusId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.content.lists() });
      const previous = queryClient.getQueryData<ContentItem[]>(queryKeys.content.lists());

      // Find the new status object from filterOptions
      const newStatus = filterOptions.statuses.find((s) => s.id === newStatusId);

      if (newStatus) {
        queryClient.setQueryData<ContentItem[]>(
          queryKeys.content.lists(),
          (old) =>
            old?.map((item) =>
              item.id === itemId ? { ...item, workflow_status: newStatus } : item
            )
        );
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.content.lists(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
    },
  });
}

interface ReorderUpdate {
  id: number;
  display_order: number;
  workflow_status_id?: number;
}

export function useReorderContentItems(filterOptions: ContentFilterOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: ReorderUpdate[]) => reorderContentItems(updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.content.lists() });
      const previous = queryClient.getQueryData<ContentItem[]>(queryKeys.content.lists());

      // Apply optimistic updates
      queryClient.setQueryData<ContentItem[]>(
        queryKeys.content.lists(),
        (old) => {
          if (!old) return old;
          return old.map((item) => {
            const update = updates.find((u) => u.id === item.id);
            if (update) {
              const newStatus = update.workflow_status_id
                ? filterOptions.statuses.find((s) => s.id === update.workflow_status_id)
                : item.workflow_status;
              return {
                ...item,
                display_order: update.display_order,
                workflow_status: newStatus || item.workflow_status,
              };
            }
            return item;
          });
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.content.lists(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
    },
  });
}
