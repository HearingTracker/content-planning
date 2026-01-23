"use client";

import { format } from "date-fns";
import { Calendar, FileText, Lightbulb, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import type { CampaignSummary } from "../types";

interface CampaignCardProps {
  campaign: CampaignSummary;
  onEdit: () => void;
  onDelete: () => void;
}

export function CampaignCard({ campaign, onEdit, onDelete }: CampaignCardProps) {
  const dateRange =
    campaign.start_date || campaign.end_date
      ? [
          campaign.start_date ? format(new Date(campaign.start_date), "MMM d") : "",
          campaign.end_date ? format(new Date(campaign.end_date), "MMM d, yyyy") : "",
        ]
          .filter(Boolean)
          .join(" - ")
      : null;

  return (
    <Card className="overflow-hidden pb-4 pt-0">
      {/* Color bar */}
      <div className="h-1" style={{ backgroundColor: campaign.color }} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold leading-tight truncate">{campaign.name}</h3>
            {campaign.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {campaign.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status and Dates */}
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={campaign.status} />
          {dateRange && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {dateRange}
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{campaign.completion_percentage}%</span>
          </div>
          <Progress value={campaign.completion_percentage} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-muted p-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{campaign.total_content_items}</p>
              <p className="text-xs text-muted-foreground">Content</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-muted p-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{campaign.total_ideas}</p>
              <p className="text-xs text-muted-foreground">Ideas</p>
            </div>
          </div>
        </div>

        {/* Content breakdown */}
        {campaign.total_content_items > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600 font-medium">
              {campaign.published_items} published
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-yellow-600">
              {campaign.in_progress_items} in progress
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {campaign.draft_items} drafts
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
