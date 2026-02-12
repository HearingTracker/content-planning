"use client";

import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Edit2, Trash2, Download, FileText, Image, Film, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import type { Comment, CommentAttachment } from "./types";
import { updateComment, deleteComment, getAttachmentUrl } from "../actions";
import { useCurrentUserRole } from "@/hooks/queries/use-current-user";

interface CommentMessageProps {
  comment: Comment;
  currentUserId?: string;
  onDelete: (commentId: number) => void;
  onUpdate: (commentId: number, body: string) => void;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Film;
  if (mimeType.includes("pdf") || mimeType.includes("document")) return FileText;
  return File;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Render comment body with highlighted @mentions
function renderBodyWithMentions(body: string): React.ReactNode {
  const mentionRegex = /@([\w.+-]+@[\w.-]+\.\w+|[\w.-]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(body)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    // Add the highlighted mention
    parts.push(
      <span
        key={match.index}
        className="text-primary font-medium bg-primary/10 rounded px-0.5"
      >
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return parts.length > 0 ? parts : body;
}

export function CommentMessage({
  comment,
  currentUserId,
  onDelete,
  onUpdate,
}: CommentMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editedBody, setEditedBody] = useState(comment.body);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = currentUserId === comment.author_id;
  const { data: role } = useCurrentUserRole();
  const isAdmin = role === "admin";
  const canDelete = isOwner || isAdmin;
  const hasActions = isOwner || canDelete;
  const displayName = comment.author_display_name || comment.author_email?.split("@")[0] || "Unknown";

  const handleSaveEdit = useCallback(async () => {
    if (!editedBody.trim() || editedBody === comment.body) {
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);
    const result = await updateComment(comment.id, editedBody);
    if (result.success) {
      onUpdate(comment.id, editedBody);
    }
    setIsSubmitting(false);
    setIsEditing(false);
  }, [comment.id, comment.body, editedBody, onUpdate]);

  const handleConfirmDelete = useCallback(async () => {
    setIsSubmitting(true);
    const result = await deleteComment(comment.id);
    if (result.success) {
      onDelete(comment.id);
    }
    setIsSubmitting(false);
    setIsConfirmingDelete(false);
  }, [comment.id, onDelete]);

  const handleDownloadAttachment = useCallback(
    async (attachment: CommentAttachment) => {
      const result = await getAttachmentUrl(attachment.storage_path);
      if (result.url) {
        window.open(result.url, "_blank");
      }
    },
    []
  );

  return (
    <div className="group flex gap-3 py-3">
      <UserAvatar name={displayName} avatarUrl={comment.author_avatar_url || undefined} size="sm" />

      <div className="flex-1 min-w-0">
        {/* Header + inline action icons */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), {
              addSuffix: true,
            })}
          </span>
          {comment.updated_at !== comment.created_at && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}

          {/* Hover actions — icon-only, tucked into the header row */}
          {hasActions && !isEditing && !isConfirmingDelete && (
            <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {isOwner && (
                <button
                  type="button"
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => setIsEditing(true)}
                  title="Edit comment"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => setIsConfirmingDelete(true)}
                  title="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Inline delete confirmation */}
        {isConfirmingDelete ? (
          <div className="mt-1.5 flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2">
            <Trash2 className="h-3.5 w-3.5 text-destructive shrink-0" />
            <span className="text-sm text-destructive/90">Delete this comment?</span>
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-6 px-2 text-xs"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        ) : isEditing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="min-h-[60px] text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSubmitting}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditedBody(comment.body);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm whitespace-pre-wrap">{renderBodyWithMentions(comment.body)}</p>
        )}

        {/* Attachments */}
        {comment.attachments && comment.attachments.length > 0 && !isConfirmingDelete && (
          <div className="mt-2 flex flex-wrap gap-2">
            {comment.attachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.mime_type);
              return (
                <button
                  key={attachment.id}
                  onClick={() => handleDownloadAttachment(attachment)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 hover:bg-muted text-xs"
                >
                  <FileIcon className="h-3 w-3" />
                  <span className="max-w-[120px] truncate">
                    {attachment.file_name}
                  </span>
                  {attachment.file_size && (
                    <span className="text-muted-foreground">
                      ({formatFileSize(attachment.file_size)})
                    </span>
                  )}
                  <Download className="h-3 w-3 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
