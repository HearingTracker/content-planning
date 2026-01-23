"use client";

import { MoreHorizontal, Pencil, Trash2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { VoteButton } from "./vote-button";
import type { ContentIdea } from "../types";

interface IdeaCardProps {
  idea: ContentIdea;
  userId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onConvertToBrief: () => void;
  onVote: (vote: 1 | -1) => void;
}

export function IdeaCard({
  idea,
  userId,
  onEdit,
  onDelete,
  onConvertToBrief,
  onVote,
}: IdeaCardProps) {
  const userVote = userId
    ? (idea.votes.find((v) => v.user_id === userId)?.vote as 1 | -1 | null) ?? null
    : null;

  const canConvert = idea.status === "approved";

  return (
    <Card className="py-0 transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Vote buttons */}
          <div className="flex flex-col items-center pt-1">
            <VoteButton
              voteCount={idea.vote_count}
              userVote={userVote}
              onVote={onVote}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium leading-tight">{idea.title}</h3>
                {idea.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {idea.description}
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
                  {canConvert && (
                    <DropdownMenuItem onClick={onConvertToBrief}>
                      <FileText className="mr-2 h-4 w-4" />
                      Convert to Brief
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusBadge status={idea.status} />
              <PriorityBadge priority={idea.priority} showIcon={false} />
              {idea.content_type && (
                <span className="text-xs text-muted-foreground">
                  {idea.content_type.name}
                </span>
              )}
              {idea.campaign && (
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: idea.campaign.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {idea.campaign.name}
                  </span>
                </div>
              )}
              {idea.estimated_effort && (
                <span className="text-xs text-muted-foreground">
                  {idea.estimated_effort} effort
                </span>
              )}
            </div>

            {/* Keywords */}
            {idea.potential_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {idea.potential_keywords.slice(0, 3).map((keyword, i) => (
                  <span
                    key={i}
                    className="text-xs bg-muted px-1.5 py-0.5 rounded"
                  >
                    {keyword}
                  </span>
                ))}
                {idea.potential_keywords.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{idea.potential_keywords.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
