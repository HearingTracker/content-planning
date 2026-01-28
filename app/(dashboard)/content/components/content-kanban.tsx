"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import type { ContentItem, WorkflowStatus } from "./types";

interface ContentKanbanProps {
  items: ContentItem[];
  statuses: WorkflowStatus[];
  onItemClick: (item: ContentItem) => void;
  onReorder: (updates: { id: number; display_order: number; workflow_status_id?: number }[]) => void;
  onEditAssignments?: (item: ContentItem) => void;
  onEditDates?: (item: ContentItem) => void;
  onViewAttachments?: (item: ContentItem) => void;
  onViewComments?: (item: ContentItem) => void;
  onCopyLink?: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
}

export function ContentKanban({
  items,
  statuses,
  onItemClick,
  onReorder,
  onEditAssignments,
  onEditDates,
  onViewAttachments,
  onViewComments,
  onCopyLink,
  onDelete,
}: ContentKanbanProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  // Track the original status when drag starts (before any handleDragOver updates)
  const [originalStatusId, setOriginalStatusId] = useState<number | null>(null);
  // Local state for optimistic updates during/after drag
  const [localItems, setLocalItems] = useState<ContentItem[] | null>(null);

  // Pan functionality
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan if clicking directly on the container or the columns wrapper, not on cards
    const target = e.target as HTMLElement;
    const isCard = target.closest('[data-kanban-card]');
    const isDragHandle = target.closest('[data-drag-handle]');

    if (isCard || isDragHandle || activeId) return;

    e.preventDefault();
    setIsPanning(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    if (containerRef.current) {
      setScrollPos({
        x: containerRef.current.scrollLeft,
        y: containerRef.current.scrollTop,
      });
    }
  }, [activeId]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning || !containerRef.current) return;

    const dx = e.clientX - startPos.x;

    containerRef.current.scrollLeft = scrollPos.x - dx;
  }, [isPanning, startPos, scrollPos]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Use local items during drag, otherwise use props
  const displayItems = localItems ?? items;

  // Group items by status and sort by display_order
  const itemsByStatus = useMemo(() => {
    const grouped: Record<number, ContentItem[]> = {};
    statuses.forEach((status) => {
      grouped[status.id] = [];
    });
    displayItems.forEach((item) => {
      const statusId = item.workflow_status?.id;
      if (statusId && grouped[statusId]) {
        grouped[statusId].push(item);
      }
    });
    // Sort each column by display_order
    Object.keys(grouped).forEach((statusId) => {
      grouped[Number(statusId)].sort((a, b) => a.display_order - b.display_order);
    });
    return grouped;
  }, [displayItems, statuses]);

  const activeItem = useMemo(
    () => (activeId ? displayItems.find((i) => i.id === activeId) : null),
    [activeId, displayItems]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const itemId = event.active.id as number;
    const item = items.find((i) => i.id === itemId);
    setActiveId(itemId);
    // Track original status before any drag operations
    setOriginalStatusId(item?.workflow_status?.id ?? null);
    // Initialize local state from props when drag starts
    setLocalItems(items);
  }, [items]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !localItems) return;

    const activeItemId = active.id as number;
    const overId = over.id as string | number;

    // Find the active item
    const activeItemData = localItems.find((i) => i.id === activeItemId);
    if (!activeItemData) return;

    // Determine the target status
    let targetStatusId: number | null = null;

    if (typeof overId === "string" && overId.startsWith("column-")) {
      targetStatusId = Number(overId.replace("column-", ""));
    } else {
      const overItem = localItems.find((i) => i.id === overId);
      if (overItem) {
        targetStatusId = overItem.workflow_status?.id ?? null;
      }
    }

    if (targetStatusId === null) return;

    const currentStatusId = activeItemData.workflow_status?.id;

    // If moving to a different column, update local state (just for visual feedback)
    if (currentStatusId !== targetStatusId) {
      const newStatus = statuses.find((s) => s.id === targetStatusId);
      if (!newStatus) return;

      setLocalItems((prev) => {
        if (!prev) return prev;

        return prev.map((item) => {
          if (item.id === activeItemId) {
            // Just update status, use high display_order to show at end during drag
            return {
              ...item,
              workflow_status: newStatus,
              display_order: 999999,
            };
          }
          return item;
        });
      });
    }
  }, [localItems, statuses]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !originalStatusId) {
      setLocalItems(null);
      setOriginalStatusId(null);
      return;
    }

    const activeItemId = active.id as number;
    const overId = over.id as string | number;

    // Find the active item from original items (not localItems which may have modified display_order)
    const activeItemData = items.find((i) => i.id === activeItemId);
    if (!activeItemData) {
      setLocalItems(null);
      setOriginalStatusId(null);
      return;
    }

    // Determine the target status and position
    let targetStatusId: number;
    let overItemId: number | null = null;

    if (typeof overId === "string" && overId.startsWith("column-")) {
      targetStatusId = Number(overId.replace("column-", ""));
    } else if (overId === activeItemId) {
      // Dropped on self - get target status from localItems (which handleDragOver updated)
      const localItem = localItems?.find((i) => i.id === activeItemId);
      if (!localItem || !localItem.workflow_status) {
        setLocalItems(null);
        setOriginalStatusId(null);
        return;
      }
      targetStatusId = localItem.workflow_status.id;
      // No overItemId since we're dropping on ourselves - insert at end of column
    } else {
      // Find the over item - check original items for accurate status
      const overItem = items.find((i) => i.id === overId);
      if (!overItem || !overItem.workflow_status) {
        setLocalItems(null);
        setOriginalStatusId(null);
        return;
      }
      targetStatusId = overItem.workflow_status.id;
      overItemId = overItem.id;
    }

    // Use original items for position calculation (not localItems)
    // Get items in the source column from original items
    const sourceColumnItems = items
      .filter((i) => i.workflow_status?.id === originalStatusId && i.id !== activeItemId)
      .sort((a, b) => a.display_order - b.display_order);

    // Get items in the target column from original items (excluding active item)
    const targetColumnItems = items
      .filter((i) => i.workflow_status?.id === targetStatusId && i.id !== activeItemId)
      .sort((a, b) => a.display_order - b.display_order);

    if (originalStatusId === targetStatusId) {
      // Reordering within the same column
      // Get all items in the column including active item
      const allColumnItems = items
        .filter((i) => i.workflow_status?.id === originalStatusId)
        .sort((a, b) => a.display_order - b.display_order);

      const oldIndex = allColumnItems.findIndex((i) => i.id === activeItemId);
      let newIndex = overItemId
        ? allColumnItems.findIndex((i) => i.id === overItemId)
        : allColumnItems.length - 1;

      if (oldIndex === -1 || oldIndex === newIndex) {
        setLocalItems(null);
        setOriginalStatusId(null);
        return;
      }

      const finalColumnItems = arrayMove(allColumnItems, oldIndex, newIndex);

      // Build updates
      const updates: { id: number; display_order: number }[] = [];
      const orderMap = new Map<number, number>();
      finalColumnItems.forEach((item, index) => {
        orderMap.set(item.id, index);
        if (item.display_order !== index) {
          updates.push({ id: item.id, display_order: index });
        }
      });

      if (updates.length > 0) {
        onReorder(updates);
        // Update localItems to reflect final state (prevents flash)
        setLocalItems(items.map((item) => {
          const newOrder = orderMap.get(item.id);
          if (newOrder !== undefined) {
            return { ...item, display_order: newOrder };
          }
          return item;
        }));
      } else {
        setLocalItems(null);
      }
      setOriginalStatusId(null);
      return;
    }

    // Moving to a different column
    const newStatus = statuses.find((s) => s.id === targetStatusId);
    if (!newStatus) {
      setLocalItems(null);
      setOriginalStatusId(null);
      return;
    }

    // Find insertion index in target column
    let insertIndex = overItemId
      ? targetColumnItems.findIndex((i) => i.id === overItemId)
      : targetColumnItems.length;

    if (insertIndex === -1) insertIndex = targetColumnItems.length;

    // Build the new target column order
    const newTargetColumnItems = [
      ...targetColumnItems.slice(0, insertIndex),
      activeItemData,
      ...targetColumnItems.slice(insertIndex),
    ];

    // Build updates for both columns
    const updates: { id: number; display_order: number; workflow_status_id?: number }[] = [];

    // Build order maps for updating localItems
    const sourceOrderMap = new Map<number, number>();
    const targetOrderMap = new Map<number, { order: number; status?: typeof newStatus }>();

    // Update source column items (re-index after removal)
    sourceColumnItems.forEach((item, index) => {
      sourceOrderMap.set(item.id, index);
      if (item.display_order !== index) {
        updates.push({ id: item.id, display_order: index });
      }
    });

    // Update target column items (including the moved item)
    newTargetColumnItems.forEach((item, index) => {
      if (item.id === activeItemId) {
        targetOrderMap.set(item.id, { order: index, status: newStatus });
        updates.push({
          id: item.id,
          display_order: index,
          workflow_status_id: targetStatusId,
        });
      } else {
        targetOrderMap.set(item.id, { order: index });
        if (item.display_order !== index) {
          updates.push({ id: item.id, display_order: index });
        }
      }
    });

    // Fire the mutation
    if (updates.length > 0) {
      onReorder(updates);
      // Update localItems to reflect final state (prevents flash)
      setLocalItems(items.map((item) => {
        const targetUpdate = targetOrderMap.get(item.id);
        if (targetUpdate) {
          return {
            ...item,
            display_order: targetUpdate.order,
            ...(targetUpdate.status && { workflow_status: targetUpdate.status }),
          };
        }
        const sourceOrder = sourceOrderMap.get(item.id);
        if (sourceOrder !== undefined) {
          return { ...item, display_order: sourceOrder };
        }
        return item;
      }));
    } else {
      setLocalItems(null);
    }
    setOriginalStatusId(null);
  }, [items, localItems, originalStatusId, statuses, onReorder]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOriginalStatusId(null);
    setLocalItems(null);
  }, []);

  // Sort statuses by display_order, filter out terminal statuses from main view
  const sortedStatuses = useMemo(
    () =>
      [...statuses]
        .filter((s) => !s.is_terminal)
        .sort((a, b) => a.display_order - b.display_order),
    [statuses]
  );

  // Include terminal statuses at the end
  const terminalStatuses = useMemo(
    () =>
      [...statuses]
        .filter((s) => s.is_terminal)
        .sort((a, b) => a.display_order - b.display_order),
    [statuses]
  );

  const allStatuses = [...sortedStatuses, ...terminalStatuses];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 overflow-x-auto overflow-y-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        style={{ userSelect: isPanning ? 'none' : 'auto' }}
      >
        <div className="flex gap-4 pt-4 px-4 h-full min-h-0">
          {allStatuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              items={itemsByStatus[status.id] || []}
              onItemClick={onItemClick}
              onEditAssignments={onEditAssignments}
              onEditDates={onEditDates}
              onViewAttachments={onViewAttachments}
              onViewComments={onViewComments}
              onCopyLink={onCopyLink}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className="w-[280px]">
            <KanbanCard item={activeItem} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
