"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getIdeas,
  createIdea,
  updateIdea,
  deleteIdea,
  voteOnIdea,
  convertIdeaToBrief,
} from "@/app/(dashboard)/strategy/actions";
import type { ContentIdea, ContentIdeaInput } from "@/app/(dashboard)/strategy/components/types";

export function useIdeas() {
  return useQuery({
    queryKey: queryKeys.ideas.list(),
    queryFn: getIdeas,
  });
}

export function useCreateIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContentIdeaInput) => createIdea(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
    },
  });
}

export function useUpdateIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ContentIdeaInput> }) =>
      updateIdea(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
    },
  });
}

export function useDeleteIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteIdea(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.ideas.list() });
      const previous = queryClient.getQueryData<ContentIdea[]>(queryKeys.ideas.list());
      queryClient.setQueryData<ContentIdea[]>(
        queryKeys.ideas.list(),
        (old) => old?.filter((i) => i.id !== deletedId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.ideas.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
    },
  });
}

export function useVoteOnIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ideaId, vote }: { ideaId: number; vote: 1 | -1 }) =>
      voteOnIdea(ideaId, vote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
    },
  });
}

export function useConvertIdeaToBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ideaId: number) => convertIdeaToBrief(ideaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.briefs.all });
    },
  });
}
