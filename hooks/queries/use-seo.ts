"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getSeoPages,
  getSeoOpportunities,
  updateOpportunityStatus,
  assignOpportunity,
  updateOpportunityNotes,
  triggerSyncJob,
  getActiveSyncJob,
  getSyncJob,
} from "@/app/(dashboard)/seo/actions";
import type { SeoOppStatus, SeoSyncJob } from "@/app/(dashboard)/seo/types";

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

/**
 * Triggers a Phase 1A clustered sync job. Returns immediately with the job
 * id; pair with useActiveSyncJob / useSyncJob to poll progress and refresh
 * dashboard data on completion.
 */
export function useTriggerSyncJob() {
  return useMutation({
    mutationFn: () => triggerSyncJob(),
  });
}

/**
 * Polls cp_seo_sync_jobs for any pending or running job. Used by the
 * SyncJobControl entry point to detect "is a job in flight?" before letting
 * the admin trigger a new one.
 */
export function useActiveSyncJob(opts: { enabled?: boolean } = {}) {
  return useQuery<SeoSyncJob | null>({
    queryKey: queryKeys.seo.activeSyncJob(),
    queryFn: () => getActiveSyncJob(),
    enabled: opts.enabled ?? true,
    refetchInterval: (q) => (q.state.data ? 2000 : 10000),
  });
}

/**
 * Polls a specific sync job. Stops polling once the job terminates and
 * invalidates SEO queries so the dashboard picks up new clusters.
 */
export function useSyncJob(jobId: number | null) {
  const qc = useQueryClient();
  return useQuery<SeoSyncJob | null>({
    queryKey: queryKeys.seo.syncJob(jobId ?? -1),
    queryFn: async () => {
      if (jobId == null) return null;
      const job = await getSyncJob(jobId);
      // When the job finishes, invalidate the rest of the SEO cache so the
      // table + drawer pick up the new clusters automatically.
      if (job?.status === "completed" || job?.status === "failed") {
        qc.invalidateQueries({ queryKey: queryKeys.seo.pages() });
      }
      return job;
    },
    enabled: jobId != null,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (!status) return 2000;
      if (status === "pending" || status === "running") return 2000;
      return false; // terminal — stop polling
    },
  });
}
