export const queryKeys = {
  content: {
    all: ["content"] as const,
    lists: () => [...queryKeys.content.all, "list"] as const,
    filterOptions: () => [...queryKeys.content.all, "filterOptions"] as const,
    calendar: (start: string, end: string) =>
      [...queryKeys.content.all, "calendar", { start, end }] as const,
  },
  comments: {
    all: ["comments"] as const,
    list: (contentItemId: number, search?: string) =>
      [...queryKeys.comments.all, contentItemId, { search }] as const,
  },
  campaigns: {
    all: ["campaigns"] as const,
    list: () => [...queryKeys.campaigns.all, "list"] as const,
  },
  ideas: {
    all: ["ideas"] as const,
    list: () => [...queryKeys.ideas.all, "list"] as const,
  },
  briefs: {
    all: ["briefs"] as const,
    list: () => [...queryKeys.briefs.all, "list"] as const,
  },
  strategyFilterOptions: ["strategyFilterOptions"] as const,
  notifications: {
    all: ["notifications"] as const,
    list: (limit?: number) =>
      [...queryKeys.notifications.all, "list", { limit }] as const,
    unreadCount: () => [...queryKeys.notifications.all, "unreadCount"] as const,
  },
  seo: {
    all: ["seo"] as const,
    pages: () => [...queryKeys.seo.all, "pages"] as const,
    page: (page: string) => [...queryKeys.seo.all, "page", page] as const,
    manualQueue: () => [...queryKeys.seo.all, "manualQueue"] as const,
    opportunities: (page: string) =>
      [...queryKeys.seo.all, "opportunities", page] as const,
    opportunityById: (id: number) =>
      [...queryKeys.seo.all, "opportunity", id] as const,
    synthesisForPage: (page: string) =>
      [...queryKeys.seo.all, "synthesis", "page", page] as const,
    synthesisAll: (kind?: string) =>
      [...queryKeys.seo.all, "synthesis", "all", kind ?? "any"] as const,
    activeSyncJob: () => [...queryKeys.seo.all, "syncJob", "active"] as const,
    syncJob: (id: number) => [...queryKeys.seo.all, "syncJob", id] as const,
    latestSuccessfulSyncJob: () =>
      [...queryKeys.seo.all, "syncJob", "latestSuccessful"] as const,
  },
} as const;
