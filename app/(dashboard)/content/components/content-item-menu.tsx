"use client";

import { Edit, Users, Calendar, MessageSquare, Trash2, Eye, Paperclip } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContentItem } from "./types";

export interface ContentItemMenuActions {
  onView?: () => void;
  onEditDetails: () => void;
  onEditAssignments?: () => void;
  onEditDates?: () => void;
  onViewAttachments?: () => void;
  onViewComments?: () => void;
  onDelete?: () => void;
}

interface ContentItemMenuProps {
  item: ContentItem;
  children: React.ReactNode;
  actions: ContentItemMenuActions;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  /** If true, shows the simplified menu (View, Edit, Delete only) */
  simplified?: boolean;
}

/**
 * Shared dropdown menu for content items.
 * Used by both Kanban cards and List view rows.
 */
export function ContentItemMenu({
  item,
  children,
  actions,
  open,
  onOpenChange,
  align = "end",
  simplified = false,
}: ContentItemMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        {actions.onView && (
          <DropdownMenuItem onClick={actions.onView}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={actions.onEditDetails}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Details
        </DropdownMenuItem>
        {!simplified && actions.onEditAssignments && (
          <DropdownMenuItem onClick={actions.onEditAssignments}>
            <Users className="mr-2 h-4 w-4" />
            Edit Assignments
          </DropdownMenuItem>
        )}
        {!simplified && actions.onEditDates && (
          <DropdownMenuItem onClick={actions.onEditDates}>
            <Calendar className="mr-2 h-4 w-4" />
            Edit Dates
          </DropdownMenuItem>
        )}
        {!simplified && actions.onViewAttachments && (
          <DropdownMenuItem onClick={actions.onViewAttachments}>
            <Paperclip className="mr-2 h-4 w-4" />
            Attachments & Links
          </DropdownMenuItem>
        )}
        {!simplified && actions.onViewComments && (
          <DropdownMenuItem onClick={actions.onViewComments}>
            <MessageSquare className="mr-2 h-4 w-4" />
            View Comments
          </DropdownMenuItem>
        )}
        {actions.onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={actions.onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Helper to create menu actions from item-based callbacks.
 * Useful when you have callbacks that take the item as a parameter.
 */
export function createMenuActions(
  item: ContentItem,
  callbacks: {
    onView?: (item: ContentItem) => void;
    onEdit: (item: ContentItem) => void;
    onEditAssignments?: (item: ContentItem) => void;
    onEditDates?: (item: ContentItem) => void;
    onViewAttachments?: (item: ContentItem) => void;
    onViewComments?: (item: ContentItem) => void;
    onDelete?: (item: ContentItem) => void;
  }
): ContentItemMenuActions {
  return {
    onView: callbacks.onView ? () => callbacks.onView!(item) : undefined,
    onEditDetails: () => callbacks.onEdit(item),
    onEditAssignments: callbacks.onEditAssignments
      ? () => callbacks.onEditAssignments!(item)
      : undefined,
    onEditDates: callbacks.onEditDates
      ? () => callbacks.onEditDates!(item)
      : undefined,
    onViewAttachments: callbacks.onViewAttachments
      ? () => callbacks.onViewAttachments!(item)
      : undefined,
    onViewComments: callbacks.onViewComments
      ? () => callbacks.onViewComments!(item)
      : undefined,
    onDelete: callbacks.onDelete
      ? () => callbacks.onDelete!(item)
      : undefined,
  };
}
