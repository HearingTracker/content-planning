"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./kanban-card";
import type { ContentItem, WorkflowStatus } from "./types";

interface KanbanColumnProps {
  status: WorkflowStatus;
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
  onEditAssignments?: (item: ContentItem) => void;
  onEditDates?: (item: ContentItem) => void;
  onViewAttachments?: (item: ContentItem) => void;
  onViewComments?: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
}

export function KanbanColumn({
  status,
  items,
  onItemClick,
  onEditAssignments,
  onEditDates,
  onViewAttachments,
  onViewComments,
  onDelete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status.id}`,
    data: { status },
  });

  const urgentCount = items.filter((i) => i.priority === "urgent").length;
  const overdueCount = items.filter(
    (i) =>
      i.due_date &&
      new Date(i.due_date) < new Date() &&
      !i.workflow_status?.is_terminal
  ).length;

  return (
    <div className="flex flex-col bg-muted/50 rounded-lg min-w-[280px] w-[280px]">
      {/* Column Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <h3 className="font-medium text-sm">{status.name}</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {items.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {urgentCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {urgentCount} urgent
              </Badge>
            )}
            {overdueCount > 0 && (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-xs border-destructive text-destructive"
              >
                {overdueCount} overdue
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className={cn(
            "p-2 min-h-[200px] space-y-2 transition-colors",
            isOver && "bg-primary/5"
          )}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
                onEditAssignments={onEditAssignments ? () => onEditAssignments(item) : undefined}
                onEditDates={onEditDates ? () => onEditDates(item) : undefined}
                onViewAttachments={onViewAttachments ? () => onViewAttachments(item) : undefined}
                onViewComments={onViewComments ? () => onViewComments(item) : undefined}
                onDelete={onDelete ? () => onDelete(item) : undefined}
              />
            ))}
          </SortableContext>

          {items.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              No items
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
