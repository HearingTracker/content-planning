"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, FileText, Settings, Users, Calendar, Paperclip, MessageSquare, Package, Link as LinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createCampaign } from "../../actions";
import { useAutoSave, useCreateContentItem } from "@/hooks/queries";
import type {
  ContentItem,
  ContentFilterOptions,
  ContentItemInput,
  EditorJSData,
  ContentAttachment,
  ContentLink,
  ContentLinkInput,
  CampaignSummary,
  ContentAssignment,
} from "../types";
import { ContentTab } from "./tabs/content-tab";
import { DetailsTab } from "./tabs/details-tab";
import { AssignmentsTab } from "./tabs/assignments-tab";
import { DatesTab } from "./tabs/dates-tab";
import { AttachmentsTab } from "./tabs/attachments-tab";
import { LinksTab } from "./tabs/links-tab";
import { ProductsTab } from "./tabs/products-tab";
import { CommentsPanel } from "./comments-panel";

interface ContentEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentItem | null;
  filterOptions: ContentFilterOptions;
  onSave: () => void;
  currentUserId?: string;
  highlightCommentId?: number | null;
  /** Initial data for pre-filling the form when creating from a brief */
  initialData?: Partial<ContentItemInput> | null;
}

export function ContentEditModal({
  open,
  onOpenChange,
  item,
  filterOptions,
  onSave,
  currentUserId,
  highlightCommentId,
  initialData,
}: ContentEditModalProps) {
  const [activeTab, setActiveTab] = useState("content");
  const [localCampaigns, setLocalCampaigns] = useState<CampaignSummary[]>(filterOptions.campaigns);
  const [contentItemId, setContentItemId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<ContentItemInput>({
    title: "",
    content_type_id: null,
    workflow_status_id: null,
    campaign_id: null,
    priority: "medium",
    due_date: null,
    scheduled_date: null,
    scheduled_time: null,
    notes: null,
    storyblok_url: null,
    body: null,
  });

  // Local state for attachments/links/assignments (for existing items)
  const [attachments, setAttachments] = useState<ContentAttachment[]>([]);
  const [links, setLinks] = useState<ContentLink[]>([]);
  const [assignments, setAssignments] = useState<ContentAssignment[]>([]);

  // Pending state for new items
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingLinks, setPendingLinks] = useState<ContentLinkInput[]>([]);

  // Auto-save hook for existing items
  const { scheduleAutoSave, flushAndInvalidate, saveStatus, cancelPending } = useAutoSave({
    contentItemId,
    debounceMs: 1000,
  });

  // Mutation hook for creating new items
  const createContentItemMutation = useCreateContentItem();

  // Sync campaigns with filterOptions
  useEffect(() => {
    setLocalCampaigns(filterOptions.campaigns);
  }, [filterOptions.campaigns]);

  // Initialize form when item changes
  useEffect(() => {
    if (open) {
      if (item) {
        setContentItemId(item.id);
        setFormData({
          title: item.title,
          content_type_id: item.content_type?.id || null,
          workflow_status_id: item.workflow_status?.id || null,
          campaign_id: item.campaign?.id || null,
          priority: item.priority,
          due_date: item.due_date,
          scheduled_date: item.scheduled_date,
          scheduled_time: item.scheduled_time,
          notes: item.notes,
          storyblok_url: item.storyblok_url,
          body: item.body,
        });
        setAttachments(item.attachments || []);
        setLinks(item.links || []);
        setAssignments(item.assignments || []);
        setPendingFiles([]);
        setPendingLinks([]);
      } else {
        setContentItemId(null);
        setFormData({
          title: initialData?.title || "",
          content_type_id: initialData?.content_type_id || null,
          workflow_status_id: initialData?.workflow_status_id || null,
          campaign_id: initialData?.campaign_id || null,
          priority: initialData?.priority || "medium",
          due_date: initialData?.due_date || null,
          scheduled_date: initialData?.scheduled_date || null,
          scheduled_time: initialData?.scheduled_time || null,
          notes: initialData?.notes || null,
          storyblok_url: initialData?.storyblok_url || null,
          body: initialData?.body || null,
        });
        setAttachments([]);
        setLinks([]);
        setAssignments([]);
        setPendingFiles([]);
        setPendingLinks([]);
      }
      setActiveTab("content");
    }
  }, [item, open, initialData]);

  // Handle form field changes with auto-save
  const handleFormChange = useCallback((updates: Partial<ContentItemInput>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Trigger auto-save for existing items
    if (contentItemId) {
      scheduleAutoSave(updates);
    }
  }, [contentItemId, scheduleAutoSave]);

  // Handle body (Editor.js) changes with slightly longer debounce
  const handleBodyChange = useCallback((body: EditorJSData) => {
    setFormData((prev) => ({ ...prev, body }));
    // Trigger auto-save for existing items
    if (contentItemId) {
      scheduleAutoSave({ body });
    }
  }, [contentItemId, scheduleAutoSave]);

  // Create campaign handler
  const handleCreateCampaign = async (name: string): Promise<string | null> => {
    const result = await createCampaign(name);
    if (result.success && result.id) {
      const newCampaign = {
        id: result.id,
        name,
        color: "#6366f1",
      };
      setLocalCampaigns((prev) =>
        [...prev, newCampaign].sort((a, b) => a.name.localeCompare(b.name))
      );
      return result.id.toString();
    }
    return null;
  };

  // Handle save for new items
  const handleSaveNew = async () => {
    if (!formData.title.trim() || createContentItemMutation.isPending) return;

    const result = await createContentItemMutation.mutateAsync(formData);
    if (result.success && result.id) {
      onSave();
      onOpenChange(false);
    }
  };

  // Handle modal close - flush pending changes and invalidate queries
  const handleOpenChange = useCallback(async (newOpen: boolean) => {
    if (!newOpen && contentItemId) {
      // Flush any pending auto-save changes before closing
      await flushAndInvalidate();
    }
    if (!newOpen) {
      cancelPending();
    }
    onOpenChange(newOpen);
  }, [contentItemId, flushAndInvalidate, cancelPending, onOpenChange]);

  const isNewItem = !item;
  const isBestList = item?.content_type?.slug === "best-list" ||
    filterOptions.types.find(t => t.id === formData.content_type_id)?.slug === "best-list";

  // Convert save status to display text
  const saveStatusDisplay = useMemo(() => {
    switch (saveStatus) {
      case "saving":
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        );
      case "saved":
        return <span className="text-xs text-green-600">Saved</span>;
      case "error":
        return <span className="text-xs text-red-600">Save failed</span>;
      default:
        return null;
    }
  }, [saveStatus]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col sm:max-w-6xl"
        showCloseButton={true}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 pr-12">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold truncate">
              {item?.title || "New Content"}
            </DialogTitle>
            {saveStatusDisplay}
          </div>
          <div className="flex items-center gap-2">
            {isNewItem && (
              <Button
                onClick={handleSaveNew}
                disabled={createContentItemMutation.isPending || !formData.title.trim()}
                size="sm"
              >
                {createContentItemMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left pane - Tabs */}
          <div className="flex-1 flex flex-col min-w-0 border-r md:border-r-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-col h-full"
            >
              <TabsList className={`grid w-full ${isBestList ? "grid-cols-7 md:grid-cols-7" : "grid-cols-6 md:grid-cols-6"} rounded-none border-b px-2 h-auto py-1 bg-transparent`}>
                <TabsTrigger
                  value="content"
                  className="gap-1.5 data-[state=active]:bg-muted rounded-md py-2"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Content</span>
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="gap-1.5 data-[state=active]:bg-muted rounded-md py-2"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Details</span>
                </TabsTrigger>
                {isBestList && (
                  <TabsTrigger
                    value="products"
                    className="gap-1.5 data-[state=active]:bg-muted rounded-md py-2"
                  >
                    <Package className="h-4 w-4" />
                    <span className="hidden sm:inline">Products</span>
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="assignments"
                  className="gap-1.5 data-[state=active]:bg-muted rounded-md py-2"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Team</span>
                </TabsTrigger>
                <TabsTrigger
                  value="dates"
                  className="gap-1.5 data-[state=active]:bg-muted rounded-md py-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Dates</span>
                </TabsTrigger>
                <TabsTrigger
                  value="attachments"
                  className="gap-1.5 data-[state=active]:bg-muted rounded-md py-2"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="hidden sm:inline">Files</span>
                </TabsTrigger>
                <TabsTrigger
                  value="links"
                  className="gap-1.5 data-[state=active]:bg-muted rounded-md py-2"
                >
                  <LinkIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Links</span>
                </TabsTrigger>
                {/* Mobile-only comments tab */}
                <TabsTrigger
                  value="comments"
                  className="gap-1.5 data-[state=active]:bg-muted rounded-md py-2 md:hidden"
                >
                  <MessageSquare className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto p-4">
                <TabsContent value="content" className="mt-0 h-full">
                  <ContentTab
                    body={formData.body || null}
                    onChange={handleBodyChange}
                  />
                </TabsContent>

                <TabsContent value="details" className="mt-0">
                  <DetailsTab
                    formData={formData}
                    onChange={handleFormChange}
                    filterOptions={filterOptions}
                    localCampaigns={localCampaigns}
                    onCreateCampaign={handleCreateCampaign}
                  />
                </TabsContent>

                {isBestList && (
                  <TabsContent value="products" className="mt-0">
                    <ProductsTab contentItemId={contentItemId} />
                  </TabsContent>
                )}

                <TabsContent value="assignments" className="mt-0">
                  <AssignmentsTab
                    contentItemId={contentItemId}
                    assignments={assignments}
                    users={filterOptions.users}
                    onAssignmentsChange={setAssignments}
                  />
                </TabsContent>

                <TabsContent value="dates" className="mt-0">
                  <DatesTab
                    formData={formData}
                    onChange={handleFormChange}
                  />
                </TabsContent>

                <TabsContent value="attachments" className="mt-0">
                  <AttachmentsTab
                    contentItemId={contentItemId}
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    pendingFiles={pendingFiles}
                    onPendingFilesChange={setPendingFiles}
                  />
                </TabsContent>

                <TabsContent value="links" className="mt-0">
                  <LinksTab
                    contentItemId={contentItemId}
                    links={links}
                    onLinksChange={setLinks}
                    pendingLinks={pendingLinks}
                    onPendingLinksChange={setPendingLinks}
                  />
                </TabsContent>

                {/* Mobile comments tab content */}
                <TabsContent value="comments" className="mt-0 md:hidden h-full">
                  <CommentsPanel
                    contentItemId={contentItemId}
                    currentUserId={currentUserId}
                    users={filterOptions.users}
                    className="h-full max-h-[calc(90vh-140px)]"
                    highlightCommentId={highlightCommentId}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Right pane - Comments (desktop only) */}
          <div className="hidden md:flex w-80 lg:w-96 border-l flex-col min-h-0 bg-muted/30">
            <CommentsPanel
              contentItemId={contentItemId}
              currentUserId={currentUserId}
              users={filterOptions.users}
              className="h-full"
              highlightCommentId={highlightCommentId}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
