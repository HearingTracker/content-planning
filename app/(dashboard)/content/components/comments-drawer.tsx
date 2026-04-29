"use client";

import { useCallback, useRef } from "react";
import { Search, MessageSquare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryKeys } from "@/lib/query-keys";
import type { ContentItem, Comment, User } from "./types";
import {
  useComments,
  useDeleteComment,
  useUpdateComment,
} from "@/hooks/queries";
import { CommentMessage } from "./comment-message";
import { CommentInput } from "./comment-input";

interface CommentsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentItem;
  users: User[];
  currentUserId?: string;
}

export function CommentsDrawer({
  open,
  onOpenChange,
  item,
  users,
  currentUserId,
}: CommentsDrawerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const contentItemId = open ? item.id : null;

  const {
    data: comments = [],
    isLoading,
    search,
    setSearch,
  } = useComments(contentItemId);

  const deleteCommentMutation = useDeleteComment();
  const updateCommentMutation = useUpdateComment();

  const handleCommentAdded = useCallback(
    (comment: Comment) => {
      queryClient.setQueryData<Comment[]>(
        queryKeys.comments.list(item.id, undefined),
        (old) => (old ? [...old, comment] : [comment])
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      // Scroll to bottom
      setTimeout(() => {
        const scrollArea = scrollAreaRef.current?.querySelector(
          "[data-radix-scroll-area-viewport]"
        );
        if (scrollArea) {
          scrollArea.scrollTop = scrollArea.scrollHeight;
        }
      }, 100);
    },
    [item.id, queryClient]
  );

  const handleCommentDeleted = useCallback(
    async (commentId: number) => {
      await deleteCommentMutation.mutateAsync(commentId);
    },
    [deleteCommentMutation]
  );

  const handleCommentUpdated = useCallback(
    async (commentId: number, body: string) => {
      await updateCommentMutation.mutateAsync({ commentId, body });
    },
    [updateCommentMutation]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments
          </SheetTitle>
          <SheetDescription className="line-clamp-1">
            {item.title}
          </SheetDescription>

          {/* Search */}
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search comments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </SheetHeader>

        {/* Comments List */}
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="px-4 divide-y">
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
                <CommentMessage
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onDelete={handleCommentDeleted}
                  onUpdate={handleCommentUpdated}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <CommentInput
          contentItemId={item.id}
          users={users}
          onCommentAdded={handleCommentAdded}
        />
      </SheetContent>
    </Sheet>
  );
}
