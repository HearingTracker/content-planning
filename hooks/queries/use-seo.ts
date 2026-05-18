"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  convertOpportunityToContentItem,
  createManualSeoQueueItem,
  getManualSeoQueueItems,
  getSeoPage,
  getSeoPages,
  getSeoOpportunities,
  getSeoOpportunityById,
  updateManualSeoQueueItemStatus,
  updateOpportunityStatus,
  assignOpportunity,
  updateOpportunityNotes,
  triggerSyncJob,
  getActiveSyncJob,
  getSyncJob,
  getSynthesisFindingsForPage,
  getSynthesisFindings,
} from "@/app/(dashboard)/seo/actions";
import type {
  SeoManualQueueInput,
  SeoOppStatus,
  SeoSyncJob,
  SeoSynthesisKindKey,
} from "@/app/(dashboard)/seo/types";

export function useSeoPages() {
  return useQuery({
    queryKey: queryKeys.seo.pages(),
    queryFn: getSeoPages,
  });
}

/**
 * Single SEO page row by URL path (e.g. "/hearing-aids"). Backs the dedicated
 * /seo/[...slug] detail page so a deep link doesn't require pre-loading the
 * full pages list.
 */
export function useSeoPage(page: string | null) {
  return useQuery({
    queryKey: page ? queryKeys.seo.page(page) : ["seo", "page", "none"],
    queryFn: () => (page ? getSeoPage(page) : Promise.resolve(null)),
    enabled: !!page,
  });
}

export function useManualSeoQueueItems() {
  return useQuery({
    queryKey: queryKeys.seo.manualQueue(),
    queryFn: getManualSeoQueueItems,
  });
}

export function useCreateManualSeoQueueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SeoManualQueueInput) => createManualSeoQueueItem(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.all });
    },
  });
}

export function useUpdateManualSeoQueueItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: SeoOppStatus }) =>
      updateManualSeoQueueItemStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.all });
    },
  });
}

export function useSeoOpportunities(page: string | null) {
  return useQuery({
    queryKey: page ? queryKeys.seo.opportunities(page) : ["seo", "opportunities", "none"],
    queryFn: () => (page ? getSeoOpportunities(page) : Promise.resolve([])),
    enabled: !!page,
  });
}

/**
 * Single opportunity (with its cluster join) by id. Backs the SEO tab in the
 * content edit modal — the tab loads the latest synthesis live so the brief
 * can flag itself as stale when the cluster has been re-synthesized since
 * the content item was created.
 */
export function useSeoOpportunity(opportunityId: number | null | undefined) {
  return useQuery({
    queryKey:
      opportunityId != null
        ? queryKeys.seo.opportunityById(opportunityId)
        : ["seo", "opportunity", "none"],
    queryFn: () =>
      opportunityId != null
        ? getSeoOpportunityById(opportunityId)
        : Promise.resolve(null),
    enabled: opportunityId != null,
  });
}

/**
 * Phase 1C — site-wide synthesis findings tied to a single page (either as
 * scope or as recommended target). Backs the "Site-wide context" callout
 * in the per-page drilldown.
 */
export function useSynthesisFindingsForPage(page: string | null) {
  return useQuery({
    queryKey: page
      ? queryKeys.seo.synthesisForPage(page)
      : ["seo", "synthesis", "page", "none"],
    queryFn: () => (page ? getSynthesisFindingsForPage(page) : Promise.resolve([])),
    enabled: !!page,
  });
}

/**
 * All open synthesis findings, optionally filtered by kind. Backs the
 * /seo/site portfolio dashboard.
 */
export function useSynthesisFindings(kind?: SeoSynthesisKindKey, limit?: number) {
  return useQuery({
    queryKey: queryKeys.seo.synthesisAll(kind),
    queryFn: () => getSynthesisFindings({ kind, limit }),
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
 * Convert an SEO opportunity into a /content editorial item. Invalidates
 * both SEO and content query roots so the manual queue, the opportunity
 * status, and the editorial board all re-fetch.
 */
export function useConvertOpportunityToContentItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      oppId,
      assignedAuthorId,
    }: {
      oppId: number;
      assignedAuthorId?: string | null;
    }) => convertOpportunityToContentItem(oppId, { assignedAuthorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.all });
      qc.invalidateQueries({ queryKey: queryKeys.content.all });
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
