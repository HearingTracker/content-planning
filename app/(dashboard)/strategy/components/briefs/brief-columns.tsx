"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, FileText, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ContentBrief } from "../types";

interface ColumnActions {
  onEdit: (brief: ContentBrief) => void;
  onDelete?: (brief: ContentBrief) => void;
  onView: (brief: ContentBrief) => void;
  onCreateContent?: (brief: ContentBrief) => void;
  onCopyLink?: (brief: ContentBrief) => void;
}

export function createBriefColumns(
  actions: ColumnActions
): ColumnDef<ContentBrief>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const brief = row.original;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{brief.title}</span>
            {brief.content_type && (
              <span className="text-xs text-muted-foreground">
                {brief.content_type.name}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        return <StatusBadge status={row.original.status} />;
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
      accessorKey: "primary_keyword",
      header: "Keyword",
      cell: ({ row }) => {
        const keyword = row.original.primary_keyword;
        if (!keyword) return <span className="text-muted-foreground">-</span>;
        return <span className="text-sm">{keyword}</span>;
      },
    },
    {
      accessorKey: "target_word_count",
      header: "Words",
      cell: ({ row }) => {
        const count = row.original.target_word_count;
        if (!count) return <span className="text-muted-foreground">-</span>;
        return <span className="text-sm">{count.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "idea",
      header: "Source Pitch",
      cell: ({ row }) => {
        const idea = row.original.idea;
        if (!idea) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
            {idea.title}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const brief = row.original;
        const canCreateContent = !!actions.onCreateContent;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.onEdit(brief)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {canCreateContent && (
                <DropdownMenuItem onClick={() => actions.onCreateContent!(brief)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Create Content
                </DropdownMenuItem>
              )}
              {actions.onCopyLink && (
                <DropdownMenuItem onClick={() => actions.onCopyLink!(brief)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy Link
                </DropdownMenuItem>
              )}
              {actions.onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => actions.onDelete!(brief)}
                    variant="destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
