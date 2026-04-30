"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getSeoPages,
  getSeoOpportunities,
  updateOpportunityStatus,
  assignOpportunity,
  updateOpportunityNotes,
  refreshNow,
} from "@/app/(dashboard)/seo/actions";
import type { SeoOppStatus } from "@/app/(dashboard)/seo/types";

export function useSeoPages() {
  return useQuery({
    queryKey: queryKeys.seo.pages(),
    queryFn: getSeoPages,
  });
}

export function useSeoOpportunities(page: string | null) {
  return useQuery({
    queryKey: page ? queryKeys.seo.opportunities(page) : ["seo", "opportunities", "none"],
    queryFn: () => (page ? getSeoOpportunities(page) : Promise.resolve([])),
    enabled: !!page,
  });
}

export function useUpdateOpportunityStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: SeoOppStatus }) =>
      updateOpportunityStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.all });
    },
  });
}

export function useAssignOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: string | null }) =>
      assignOpportunity(id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.all });
    },
  });
}

export function useUpdateOpportunityNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string | null }) =>
      updateOpportunityNotes(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.all });
    },
  });
}

export function useRefreshSeoNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => refreshNow(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.all });
    },
  });
}
