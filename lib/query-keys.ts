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
} as const;
