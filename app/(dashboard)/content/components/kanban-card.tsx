"use client";

import { useState, useCallback, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Calendar, User, GripVertical, MoreHorizontal, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import type { ContentItem } from "./types";
import { ContentItemMenu, type ContentItemMenuActions } from "./content-item-menu";

interface KanbanCardProps {
  item: ContentItem;
  onClick: () => void;
  onEditAssignments?: () => void;
  onEditDates?: () => void;
  onViewAttachments?: () => void;
  onViewComments?: () => void;
  onCopyLink?: () => void;
  onDelete?: () => void;
}

export function KanbanCard({
  item,
  onClick,
  onEditAssignments,
  onEditDates,
  onViewAttachments,
  onViewComments,
  onCopyLink,
  onDelete,
}: KanbanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const skipNextClickRef = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue =
    item.due_date &&
    new Date(item.due_date) < new Date() &&
    !item.workflow_status?.is_terminal;

  const hasAttachmentsOrLinks =
    (item.attachments && item.attachments.length > 0) ||
    (item.links && item.links.length > 0);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    skipNextClickRef.current = true;
    setContextMenuOpen(true);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Skip if we just opened context menu or menu is open
    if (skipNextClickRef.current) {
      skipNextClickRef.current = false;
      return;
    }
    // Only trigger onClick for left-click and when menu is not open
    if (e.button !== 0 || menuOpen || contextMenuOpen) {
      return;
    }
    onClick();
  }, [onClick, menuOpen, contextMenuOpen]);

  const menuActions: ContentItemMenuActions = {
    onEditDetails: onClick,
    onEditAssignments: onEditAssignments,
    onEditDates: onEditDates,
    onViewAttachments: onViewAttachments,
    onViewComments: onViewComments,
    onCopyLink: onCopyLink,
    onDelete: onDelete || (() => {}),
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-kanban-card
      className={cn(
        "py-0 cursor-pointer transition-shadow hover:shadow-md group",
        isDragging && "opacity-50 shadow-lg",
        isOverdue && "border-destructive"
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <CardContent className="p-3">
        {/* Header row: Drag handle, Title, Menu - using CSS Grid for proper text containment */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
          {/* Drag handle - fixed width */}
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Title - takes remaining space, wraps properly */}
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <h4 className="font-medium text-sm leading-tight line-clamp-2 whitespace-normal hover:text-primary transition-colors">
              {item.title}
            </h4>
          </button>

          {/* Menu button - fixed width */}
          <ContentItemMenu
            item={item}
            actions={menuActions}
            open={menuOpen || contextMenuOpen}
            onOpenChange={(open) => {
              setMenuOpen(open);
              setContextMenuOpen(open);
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(true);
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </ContentItemMenu>
        </div>

        {/* Notes (if present) */}
        {item.notes && (
          <p className="text-xs text-muted-foreground mt-1.5 ml-6 line-clamp-2 break-words">
            {item.notes}
          </p>
        )}

        {/* Campaign */}
        {item.campaign && (
          <div className="flex items-center gap-1.5 mt-2 ml-6">
            <div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.campaign.color }}
            />
            <span className="text-xs text-muted-foreground truncate">
              {item.campaign.name}
            </span>
          </div>
        )}

        {/* Footer Row 1: Priority + Content Type */}
        <div className="flex items-center gap-1.5 mt-2 ml-6">
          <PriorityBadge
            priority={item.priority}
            showIcon={false}
            className="text-xs h-5 px-1.5"
          />
          {item.content_type && (
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              {item.content_type.name}
            </Badge>
          )}
        </div>

        {/* Footer Row 2: Date, Attachments + Author */}
        <div className="flex items-center justify-between gap-2 mt-2 ml-6">
          {/* Due date (clickable -> edit dates) */}
          {item.due_date ? (
            <button
              type="button"
              className={cn(
                "flex items-center gap-1 text-xs hover:underline",
                isOverdue
                  ? "text-destructive font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onEditDates?.();
              }}
              title="Edit dates"
            >
              <Calendar className="h-3 w-3" />
              {format(new Date(item.due_date), "MMM d")}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {/* Attachments icon (clickable -> view attachments) */}
            {hasAttachmentsOrLinks && (
              <button
                type="button"
                className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewAttachments?.();
                }}
                title="View attachments & links"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Author avatar (clickable -> edit assignments) */}
            <button
              type="button"
              className="hover:ring-2 hover:ring-primary hover:ring-offset-1 rounded-full transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onEditAssignments?.();
              }}
              title="Edit assignments"
            >
              {item.assignments.length > 0 ? (
                <UserAvatar
                  name={item.assignments[0].user.display_name || item.assignments[0].user.email}
                  avatarUrl={item.assignments[0].user.avatar_url}
                  size="sm"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
