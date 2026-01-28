"use client";

import { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { useQueryStates, parseAsString, parseAsArrayOf, parseAsInteger } from "nuqs";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Plus, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ContentFiltersPanel } from "./components/content-filters";
import { ContentDataTable } from "./components/content-data-table";
import { ContentKanban } from "./components/content-kanban";
import { ContentCalendar } from "./components/content-calendar";
import { ContentEditModal } from "./components/content-edit-modal";
import { ViewToggle } from "./components/view-toggle";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { QuickEditAssignments } from "./components/quick-edit-assignments";
import { QuickEditDates } from "./components/quick-edit-dates";
import {
  useContentItems,
  useContentFilterOptions,
  useDeleteContentItem,
  useReorderContentItems,
  useCalendarItems,
  useCanDelete,
} from "@/hooks/queries";
import { promoteContent } from "../strategy/actions";
import type {
  ContentItem,
  ContentFilters,
  ContentView,
  CalendarItem,
  ContentItemInput,
} from "./components/types";

// URL state parsers
const filterParsers = {
  view: parseAsString.withDefault("kanban"),
  search: parseAsString.withDefault(""),
  statuses: parseAsArrayOf(parseAsString).withDefault([]),
  types: parseAsArrayOf(parseAsString).withDefault([]),
  campaigns: parseAsArrayOf(parseAsInteger).withDefault([]),
  assignees: parseAsArrayOf(parseAsString).withDefault([]),
  priorities: parseAsArrayOf(parseAsString).withDefault([]),
  item: parseAsInteger,
  comment: parseAsInteger,
  brief_id: parseAsInteger,
};

export default function ContentPage() {
  const [urlState, setUrlState] = useQueryStates(filterParsers, {
    history: "push",
  });

  const [, startTransition] = useTransition();

  // React Query hooks
  const { data: items = [], isLoading, refetch: refetchItems } = useContentItems();
  const { data: filterOptions = { statuses: [], types: [], campaigns: [], users: [] } } = useContentFilterOptions();
  const deleteContentItemMutation = useDeleteContentItem();
  const reorderContentItemsMutation = useReorderContentItems(filterOptions);

  const view = urlState.view as ContentView;
  const canDelete = useCanDelete();

  // Calendar items - only fetch when in calendar view
  const today = new Date();
  const calendarStart = format(startOfMonth(today), "yyyy-MM-dd");
  const calendarEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const [calendarRange, setCalendarRange] = useState({ start: calendarStart, end: calendarEnd });
  const { data: calendarItems = [] } = useCalendarItems(
    calendarRange.start,
    calendarRange.end,
    view === "calendar"
  );

  // Dialog states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ContentItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Quick edit dialog states (shortcuts from table/kanban)
  const [assignmentsDialogOpen, setAssignmentsDialogOpen] = useState(false);
  const [assignmentsItem, setAssignmentsItem] = useState<ContentItem | null>(null);
  const [datesDialogOpen, setDatesDialogOpen] = useState(false);
  const [datesItem, setDatesItem] = useState<ContentItem | null>(null);

  // Initial data for creating from brief
  const [initialData, setInitialData] = useState<Partial<ContentItemInput> | null>(null);

  // Convert URL state to filters
  const filters: ContentFilters = useMemo(
    () => ({
      search: urlState.search,
      statuses: urlState.statuses,
      types: urlState.types,
      campaigns: urlState.campaigns,
      assignees: urlState.assignees,
      priorities: urlState.priorities as ContentFilters["priorities"],
    }),
    [urlState]
  );

  // Open modal from URL params (e.g., from notification link)
  useEffect(() => {
    if (urlState.item && items.length > 0 && !isLoading) {
      const itemToEdit = items.find((i) => i.id === urlState.item);
      if (itemToEdit) {
        setEditingItem(itemToEdit);
        setEditModalOpen(true);
      }
    }
  }, [urlState.item, items, isLoading]);

  // Promote brief to content stage when brief_id is in URL
  useEffect(() => {
    if (urlState.brief_id && !editModalOpen) {
      // In the unified model, we just promote the brief to content stage
      promoteContent(urlState.brief_id, "content").then((result) => {
        if (result.success) {
          // Refetch items to show the newly promoted content
          refetchItems();
          // Find and open the promoted item
          const promotedItem = items.find((i) => i.id === urlState.brief_id);
          if (promotedItem) {
            setEditingItem(promotedItem);
            setEditModalOpen(true);
          }
        }
        // Clear brief_id from URL
        setUrlState({ brief_id: null });
      });
    }
  }, [urlState.brief_id, editModalOpen, setUrlState, refetchItems, items]);

  // Clear URL params when modal closes
  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      setEditModalOpen(open);
      if (!open) {
        if (urlState.item) {
          setUrlState({ item: null, comment: null });
        }
        setInitialData(null);
      }
    },
    [urlState.item, setUrlState]
  );

  // Filter items client-side
  const filteredItems = useMemo(() => {
    let result = items;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(searchLower) ||
          item.content_type?.name.toLowerCase().includes(searchLower) ||
          item.campaign?.name.toLowerCase().includes(searchLower)
      );
    }

    if (filters.statuses.length > 0) {
      result = result.filter(
        (item) =>
          item.workflow_status &&
          filters.statuses.includes(item.workflow_status.slug)
      );
    }

    if (filters.types.length > 0) {
      result = result.filter(
        (item) =>
          item.content_type && filters.types.includes(item.content_type.slug)
      );
    }

    if (filters.campaigns.length > 0) {
      result = result.filter(
        (item) => item.campaign && filters.campaigns.includes(item.campaign.id)
      );
    }

    if (filters.assignees.length > 0) {
      result = result.filter((item) =>
        item.assignments.some((a) => filters.assignees.includes(a.user_id))
      );
    }

    if (filters.priorities.length > 0) {
      result = result.filter((item) =>
        filters.priorities.includes(item.priority)
      );
    }

    return result;
  }, [items, filters]);

  // Handlers
  const handleFiltersChange = useCallback(
    (newFilters: ContentFilters) => {
      startTransition(() => {
        setUrlState({
          search: newFilters.search,
          statuses: newFilters.statuses,
          types: newFilters.types,
          campaigns: newFilters.campaigns,
          assignees: newFilters.assignees,
          priorities: newFilters.priorities,
        });
      });
    },
    [setUrlState]
  );

  const handleViewChange = useCallback(
    (newView: ContentView) => {
      setUrlState({ view: newView });
    },
    [setUrlState]
  );

  const handleCreateNew = () => {
    setEditingItem(null);
    setEditModalOpen(true);
  };

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item);
    setEditModalOpen(true);
    setUrlState({ item: item.id });
  };

  const handleDelete = (item: ContentItem) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleView = (item: ContentItem) => {
    handleEdit(item);
  };

  const handleModalSave = async () => {
    // React Query will automatically invalidate and refetch
  };

  const handleConfirmDelete = async () => {
    if (deletingItem) {
      await deleteContentItemMutation.mutateAsync(deletingItem.id);
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  };

  const handleReorder = (updates: { id: number; display_order: number; workflow_status_id?: number }[]) => {
    reorderContentItemsMutation.mutate(updates);
  };

  const handleCalendarMonthChange = async (start: string, end: string) => {
    setCalendarRange({ start, end });
  };

  const handleCalendarItemClick = (item: CalendarItem) => {
    if (item.item_type === "content_item" || item.item_type === "content_due") {
      const contentItem = items.find((i) => i.id === item.item_id);
      if (contentItem) {
        handleEdit(contentItem);
      }
    }
  };

  // Quick edit handlers
  const handleEditAssignments = (item: ContentItem) => {
    setAssignmentsItem(item);
    setAssignmentsDialogOpen(true);
  };

  const handleEditDates = (item: ContentItem) => {
    setDatesItem(item);
    setDatesDialogOpen(true);
  };

  const handleViewComments = (item: ContentItem) => {
    // Open the edit modal - comments are available in the side panel
    setEditingItem(item);
    setEditModalOpen(true);
  };

  const handleViewAttachments = (item: ContentItem) => {
    // Open the edit modal - attachments are available in the tabs
    setEditingItem(item);
    setEditModalOpen(true);
  };

  const handleQuickEditSuccess = () => {
    refetchItems();
  };

  const handleCopyLink = useCallback((item: ContentItem) => {
    const url = `${window.location.origin}/content?item=${item.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast("Link copied");
    });
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    count += filters.statuses.length;
    count += filters.types.length;
    count += filters.campaigns.length;
    count += filters.assignees.length;
    count += filters.priorities.length;
    return count;
  }, [filters]);

  // Use flex layout for kanban view to constrain height
  const isKanban = view === "kanban";

  return (
    <div className={isKanban ? "flex flex-col h-[calc(100vh-5.5rem)] min-w-0 -mb-6" : "space-y-4 min-w-0"}>
      {/* Header */}
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${isKanban ? "mb-4" : ""}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Content
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your content pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle view={view} onViewChange={handleViewChange} />
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4" />
            New content
          </Button>
        </div>
      </div>

      {/* Filters (not shown in calendar view) */}
      {view !== "calendar" && (
        <Collapsible
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          className={`group/collapsible rounded-lg border bg-card ${isKanban ? "mb-4" : ""}`}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-4">
              <ContentFiltersPanel
                filters={filters}
                onFiltersChange={handleFiltersChange}
                filterOptions={filterOptions}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Results count */}
      {view !== "calendar" && (
        <div className={`text-sm text-muted-foreground ${isKanban ? "mb-4" : ""}`}>
          {isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            `${filteredItems.length} content items`
          )}
        </div>
      )}

      {/* Content View */}
      {isLoading ? (
        <div className={isKanban ? "flex-1 min-h-0" : ""}>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : view === "list" ? (
        <ContentDataTable
          data={filteredItems}
          onEdit={handleEdit}
          onDelete={canDelete ? handleDelete : undefined}
          onView={handleView}
          onCreateNew={handleCreateNew}
          onEditAssignments={handleEditAssignments}
          onEditDates={handleEditDates}
          onViewAttachments={handleViewAttachments}
          onViewComments={handleViewComments}
          onCopyLink={handleCopyLink}
        />
      ) : view === "kanban" ? (
        <div className="flex-1 min-h-0 flex">
          <ContentKanban
            items={filteredItems}
            statuses={filterOptions.statuses}
            onItemClick={handleView}
            onReorder={handleReorder}
            onEditAssignments={handleEditAssignments}
            onEditDates={handleEditDates}
            onViewAttachments={handleViewAttachments}
            onViewComments={handleViewComments}
            onCopyLink={handleCopyLink}
            onDelete={canDelete ? handleDelete : undefined}
          />
        </div>
      ) : (
        <ContentCalendar
          items={calendarItems}
          onMonthChange={handleCalendarMonthChange}
          onItemClick={handleCalendarItemClick}
        />
      )}

      {/* Edit Modal */}
      <ContentEditModal
        open={editModalOpen}
        onOpenChange={handleModalOpenChange}
        item={editingItem}
        filterOptions={filterOptions}
        onSave={handleModalSave}
        highlightCommentId={urlState.comment}
        initialData={initialData}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete content"
        description={`Are you sure you want to delete "${deletingItem?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />

      {/* Quick Edit Assignments Dialog */}
      {assignmentsItem && (
        <QuickEditAssignments
          open={assignmentsDialogOpen}
          onOpenChange={setAssignmentsDialogOpen}
          item={assignmentsItem}
          users={filterOptions.users}
          onSuccess={handleQuickEditSuccess}
        />
      )}

      {/* Quick Edit Dates Dialog */}
      {datesItem && (
        <QuickEditDates
          open={datesDialogOpen}
          onOpenChange={setDatesDialogOpen}
          item={datesItem}
          onSuccess={handleQuickEditSuccess}
        />
      )}

    </div>
  );
}
