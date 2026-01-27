"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { Comment, User } from "../types";
import { useComments, useDeleteComment, useUpdateComment } from "@/hooks/queries";
import { CommentMessage } from "../comment-message";
import { CommentInput } from "../comment-input";

interface CommentsPanelProps {
  contentItemId: number | null;
  currentUserId?: string;
  users: User[];
  className?: string;
  highlightCommentId?: number | null;
}

export function CommentsPanel({
  contentItemId,
  currentUserId,
  users,
  className,
  highlightCommentId,
}: CommentsPanelProps) {
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // React Query hooks
  const { data: comments = [], isLoading, search, setSearch } = useComments(contentItemId);
  const deleteCommentMutation = useDeleteComment();
  const updateCommentMutation = useUpdateComment();

  // Scroll to and highlight comment when highlightCommentId changes
  useEffect(() => {
    if (highlightCommentId && comments.length > 0) {
      setHighlightedId(highlightCommentId);
      // Scroll to the comment
      setTimeout(() => {
        const commentElement = document.getElementById(`comment-${highlightCommentId}`);
        if (commentElement) {
          commentElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      // Remove highlight after 3 seconds
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightCommentId, comments.length]);

  const handleCommentAdded = useCallback((comment: Comment) => {
    // Add comment to cache for immediate display
    if (contentItemId) {
      queryClient.setQueryData<Comment[]>(
        queryKeys.comments.list(contentItemId, undefined),
        (old) => (old ? [...old, comment] : [comment])
      );
      // Invalidate to ensure consistency with server
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    }
    // Scroll to bottom when a new comment is added
    setTimeout(() => {
      const scrollArea = scrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }, 100);
  }, [contentItemId, queryClient]);

  const handleCommentDeleted = useCallback(async (commentId: number) => {
    await deleteCommentMutation.mutateAsync(commentId);
  }, [deleteCommentMutation]);

  const handleCommentUpdated = useCallback(async (commentId: number, body: string) => {
    await updateCommentMutation.mutateAsync({ commentId, body });
  }, [updateCommentMutation]);

  if (!contentItemId) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
          <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
          <p>Save the content item to enable comments</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4" />
          <span className="font-medium text-sm">Comments</span>
          {comments.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search comments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* Comments List */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
        <div className="px-3 divide-y">
          {isLoading && comments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {search
                ? "No comments match your search"
                : "No comments yet. Start the conversation!"}
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                id={`comment-${comment.id}`}
                className={highlightedId === comment.id ? "bg-yellow-100 dark:bg-yellow-900/30 -mx-3 px-3 transition-colors duration-500" : ""}
              >
                <CommentMessage
                  comment={comment}
                  currentUserId={currentUserId}
                  onDelete={handleCommentDeleted}
                  onUpdate={handleCommentUpdated}
                />
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <CommentInput
        contentItemId={contentItemId}
        users={users}
        onCommentAdded={handleCommentAdded}
      />
    </div>
  );
}
