"use client";

import { AttachmentUpload } from "../../attachment-upload";
import type { ContentAttachment } from "../../types";

interface AttachmentsTabProps {
  contentItemId: number | null;
  attachments: ContentAttachment[];
  onAttachmentsChange: (attachments: ContentAttachment[]) => void;
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
}

export function AttachmentsTab({
  contentItemId,
  attachments,
  onAttachmentsChange,
  pendingFiles,
  onPendingFilesChange,
}: AttachmentsTabProps) {
  return (
    <AttachmentUpload
      contentItemId={contentItemId}
      attachments={attachments}
      onAttachmentsChange={onAttachmentsChange}
      pendingFiles={pendingFiles}
      onPendingFilesChange={onPendingFilesChange}
    />
  );
}
