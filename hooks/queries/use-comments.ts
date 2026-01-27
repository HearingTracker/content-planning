"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getComments, addComment, deleteComment, updateComment } from "@/app/(dashboard)/content/actions";
import type { Comment } from "@/app/(dashboard)/content/components/types";

// Hook with built-in debounce for search
export function useComments(contentItemId: number | null, initialSearch = "") {
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: queryKeys.comments.list(contentItemId ?? 0, debouncedSearch || undefined),
    queryFn: () => getComments(contentItemId!, debouncedSearch || undefined),
    enabled: !!contentItemId,
  });

  return {
    ...query,
    search,
    setSearch,
  };
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contentItemId,
      body,
      attachmentFiles,
    }: {
      contentItemId: number;
      body: string;
      attachmentFiles?: FormData;
    }) => addComment(contentItemId, body, attachmentFiles),
    onSuccess: (result, { contentItemId }) => {
      if (result.success && result.comment) {
        // Optimistically add the comment to the cache
        queryClient.setQueryData<Comment[]>(
          queryKeys.comments.list(contentItemId, undefined),
          (old) => (old ? [...old, result.comment!] : [result.comment!])
        );
      }
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: number; body: string }) =>
      updateComment(commentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });
}
