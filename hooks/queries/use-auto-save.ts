"use client";

import { useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { updateContentItem } from "@/app/(dashboard)/content/actions";
import type { ContentItemInput } from "@/app/(dashboard)/content/components/types";

interface UseAutoSaveOptions {
  contentItemId: number | null;
  debounceMs?: number;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave({ contentItemId, debounceMs = 1000 }: UseAutoSaveOptions) {
  const queryClient = useQueryClient();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<Partial<ContentItemInput> | null>(null);
  const accumulatedChangesRef = useRef<Partial<ContentItemInput>>({});

  const mutation = useMutation({
    mutationFn: (input: Partial<ContentItemInput>) =>
      updateContentItem(contentItemId!, input),
    onSuccess: (result) => {
      if (result.success) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    },
    onError: () => {
      setSaveStatus("error");
    },
  });

  const scheduleAutoSave = useCallback(
    (updates: Partial<ContentItemInput>) => {
      if (!contentItemId) return;

      // Accumulate changes
      accumulatedChangesRef.current = {
        ...accumulatedChangesRef.current,
        ...updates,
      };
      pendingDataRef.current = accumulatedChangesRef.current;

      setSaveStatus("saving");

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const dataToSave = pendingDataRef.current;
        if (dataToSave && contentItemId) {
          mutation.mutate(dataToSave);
          pendingDataRef.current = null;
          accumulatedChangesRef.current = {};
        }
      }, debounceMs);
    },
    [contentItemId, debounceMs, mutation]
  );

  const flushAndInvalidate = useCallback(async () => {
    // Cancel any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If there's pending data, save it immediately
    const dataToSave = pendingDataRef.current;
    if (dataToSave && contentItemId) {
      pendingDataRef.current = null;
      accumulatedChangesRef.current = {};
      await mutation.mutateAsync(dataToSave);
    }

    // Invalidate the content list to refresh data
    await queryClient.invalidateQueries({ queryKey: queryKeys.content.lists() });
  }, [contentItemId, mutation, queryClient]);

  const cancelPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingDataRef.current = null;
    accumulatedChangesRef.current = {};
    setSaveStatus("idle");
  }, []);

  return {
    scheduleAutoSave,
    flushAndInvalidate,
    cancelPending,
    saveStatus,
    isSaving: mutation.isPending || saveStatus === "saving",
  };
}
