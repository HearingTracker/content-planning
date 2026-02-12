"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, X, File, Image, Film, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Comment, User } from "./types";
import { addComment } from "../actions";
import { MentionTextarea } from "./mention-textarea";

interface CommentInputProps {
  contentItemId: number;
  users: User[];
  onCommentAdded: (comment: Comment) => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Film;
  if (mimeType.includes("pdf") || mimeType.includes("document")) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CommentInput({
  contentItemId,
  users,
  onCommentAdded,
}: CommentInputProps) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!body.trim() && files.length === 0) return;

    setIsSubmitting(true);

    try {
      let formData: FormData | undefined;
      if (files.length > 0) {
        formData = new FormData();
        files.forEach((file) => formData!.append("files", file));
      }

      const result = await addComment(contentItemId, body.trim(), formData);

      if (result.success && result.comment) {
        onCommentAdded(result.comment);
        setBody("");
        setFiles([]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [contentItemId, body, files, onCommentAdded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
        e.target.value = "";
      }
    },
    []
  );

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="border-t bg-background p-3 flex-shrink-0">
      {/* File Previews */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, index) => {
            const FileIcon = getFileIcon(file.type);
            return (
              <div
                key={index}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 text-xs"
              >
                <FileIcon className="h-3 w-3" />
                <span className="max-w-[100px] truncate">{file.name}</span>
                <span className="text-muted-foreground">
                  ({formatFileSize(file.size)})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <MentionTextarea
            value={body}
            onChange={setBody}
            onKeyDown={handleKeyDown}
            users={users}
            placeholder="Write a comment... Use @ to mention someone"
            className="min-h-[40px] max-h-[120px] resize-none pr-10 text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-8 w-8 p-0 z-10"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || (!body.trim() && files.length === 0)}
          size="icon"
          className="h-9 w-9 shrink-0 self-start"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Enter to send, Shift+Enter for new line. Type @ to mention someone.
      </p>
    </div>
  );
}
