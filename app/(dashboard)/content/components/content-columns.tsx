"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ContentItemMenu, createMenuActions } from "./content-item-menu";
import type { ContentItem } from "./types";

interface ColumnActions {
  onEdit: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
  onView: (item: ContentItem) => void;
  onEditAssignments?: (item: ContentItem) => void;
  onEditDates?: (item: ContentItem) => void;
  onViewAttachments?: (item: ContentItem) => void;
  onViewComments?: (item: ContentItem) => void;
}

export function createColumns(actions: ColumnActions): ColumnDef<ContentItem>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{item.title}</span>
            {item.content_type && (
              <span className="text-xs text-muted-foreground">
                {item.content_type.name}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "workflow_status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.workflow_status;
        if (!status) return null;
        return <StatusBadge status={status.slug} color={status.color} />;
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        return <PriorityBadge priority={row.original.priority} />;
      },
    },
    {
      accessorKey: "campaign",
      header: "Campaign",
      cell: ({ row }) => {
        const campaign = row.original.campaign;
        if (!campaign) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: campaign.color }}
            />
            <span className="text-sm">{campaign.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "assignments",
      header: "Assigned",
      cell: ({ row }) => {
        const authors = row.original.assignments.filter((a) => a.role === "author");
        if (authors.length === 0) return <span className="text-muted-foreground">-</span>;
        const displayAuthor = authors[0];
        return (
          <div className="flex items-center gap-2">
            <UserAvatar
              name={displayAuthor.user.display_name || displayAuthor.user.email}
              avatarUrl={displayAuthor.user.avatar_url}
              size="sm"
            />
            <span className="text-sm truncate max-w-[120px]">
              {displayAuthor.user.display_name || displayAuthor.user.email}
              {authors.length > 1 && ` +${authors.length - 1}`}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => {
        const dueDate = row.original.due_date;
        if (!dueDate) return <span className="text-muted-foreground">-</span>;
        const date = new Date(dueDate);
        const isOverdue = date < new Date() && !row.original.workflow_status?.is_terminal;
        return (
          <span className={isOverdue ? "text-destructive font-medium" : ""}>
            {format(date, "MMM d, yyyy")}
          </span>
        );
      },
    },
    {
      accessorKey: "scheduled_date",
      header: "Scheduled",
      cell: ({ row }) => {
        const scheduledDate = row.original.scheduled_date;
        if (!scheduledDate) return <span className="text-muted-foreground">-</span>;
        return format(new Date(scheduledDate), "MMM d, yyyy");
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <ContentItemMenu
            item={item}
            actions={createMenuActions(item, {
              onView: actions.onView,
              onEdit: actions.onEdit,
              onEditAssignments: actions.onEditAssignments,
              onEditDates: actions.onEditDates,
              onViewAttachments: actions.onViewAttachments,
              onViewComments: actions.onViewComments,
              onDelete: actions.onDelete,
            })}
          >
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </ContentItemMenu>
        );
      },
    },
  ];
}
