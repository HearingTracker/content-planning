"use client";

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
import { createBriefColumns } from "./brief-columns";
import { EmptyState } from "@/components/shared/empty-state";
import type { ContentBrief } from "../types";

interface BriefTableProps {
  data: ContentBrief[];
  onEdit: (brief: ContentBrief) => void;
  onDelete?: (brief: ContentBrief) => void;
  onView: (brief: ContentBrief) => void;
  onCreateContent?: (brief: ContentBrief) => void;
  onCopyLink?: (brief: ContentBrief) => void;
  onCreateNew: () => void;
}

export function BriefTable({
  data,
  onEdit,
  onDelete,
  onView,
  onCreateContent,
  onCopyLink,
  onCreateNew,
}: BriefTableProps) {
  const columns = createBriefColumns({ onEdit, onDelete, onView, onCreateContent, onCopyLink });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <EmptyState
        icon="content"
        title="No briefs yet"
        description="Create content briefs to plan your articles in detail."
        action={{
          label: "Create brief",
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
              onClick={() => onView(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  onClick={(e) => {
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
    </div>
  );
}
