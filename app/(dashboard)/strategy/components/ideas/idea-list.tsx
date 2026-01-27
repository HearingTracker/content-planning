"use client";

import { IdeaCard } from "./idea-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ContentIdea } from "../types";

interface IdeaListProps {
  ideas: ContentIdea[];
  userId: string | null;
  onEdit: (idea: ContentIdea) => void;
  onDelete?: (idea: ContentIdea) => void;
  onConvertToBrief?: (idea: ContentIdea) => void;
  onVote: (ideaId: number, vote: 1 | -1) => void;
  onCreateNew: () => void;
}

export function IdeaList({
  ideas,
  userId,
  onEdit,
  onDelete,
  onConvertToBrief,
  onVote,
  onCreateNew,
}: IdeaListProps) {
  if (ideas.length === 0) {
    return (
      <EmptyState
        icon="idea"
        title="No pitches yet"
        description="Start by submitting your first content pitch."
        action={{
          label: "Submit pitch",
          onClick: onCreateNew,
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          userId={userId}
          onEdit={() => onEdit(idea)}
          onDelete={onDelete ? () => onDelete(idea) : undefined}
          onConvertToBrief={onConvertToBrief ? () => onConvertToBrief(idea) : undefined}
          onVote={(vote) => onVote(idea.id, vote)}
        />
      ))}
    </div>
  );
}
