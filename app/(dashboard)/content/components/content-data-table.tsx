"use client";

import { useState, useCallback, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createColumns } from "./content-columns";
import { EmptyState } from "@/components/shared/empty-state";
import { ContentItemMenu, createMenuActions } from "./content-item-menu";
import type { ContentItem } from "./types";

interface ContentDataTableProps {
  data: ContentItem[];
  onEdit: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
  onView: (item: ContentItem) => void;
  onCreateNew: () => void;
  onEditAssignments?: (item: ContentItem) => void;
  onEditDates?: (item: ContentItem) => void;
  onViewAttachments?: (item: ContentItem) => void;
  onViewComments?: (item: ContentItem) => void;
}

export function ContentDataTable({
  data,
  onEdit,
  onDelete,
  onView,
  onCreateNew,
  onEditAssignments,
  onEditDates,
  onViewAttachments,
  onViewComments,
}: ContentDataTableProps) {
  const columns = createColumns({ onEdit, onDelete, onView, onEditAssignments, onEditDates, onViewAttachments, onViewComments });

  // Context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuItem, setContextMenuItem] = useState<ContentItem | null>(null);
  const skipNextClickRef = useRef(false);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: ContentItem) => {
    e.preventDefault();
    e.stopPropagation();
    skipNextClickRef.current = true;
    setContextMenuItem(item);
    setContextMenuOpen(true);
  }, []);

  const handleRowClick = useCallback((e: React.MouseEvent, item: ContentItem) => {
    if (skipNextClickRef.current) {
      skipNextClickRef.current = false;
      return;
    }
    onView(item);
  }, [onView]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <EmptyState
        icon="content"
        title="No content items"
        description="Get started by creating your first content item."
        action={{
          label: "Create content",
          onClick: onCreateNew,
        }}
      />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              className="cursor-pointer hover:bg-muted/50"
              onClick={(e) => handleRowClick(e, row.original)}
              onContextMenu={(e) => handleContextMenu(e, row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  onClick={(e) => {
                    // Prevent row click when clicking action buttons
                    if (cell.column.id === "actions") {
                      e.stopPropagation();
                    }
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Context menu - rendered at document level */}
      {contextMenuItem && (
        <ContentItemMenu
          item={contextMenuItem}
          actions={createMenuActions(contextMenuItem, {
            onView,
            onEdit,
            onEditAssignments,
            onEditDates,
            onViewAttachments,
            onViewComments,
            onDelete,
          })}
          open={contextMenuOpen}
          onOpenChange={setContextMenuOpen}
        >
          {/* Hidden trigger - menu is controlled via open prop */}
          <span className="hidden" />
        </ContentItemMenu>
      )}
    </div>
  );
}
