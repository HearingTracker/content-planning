"use client";

import { useState } from "react";
import { Paperclip, Link as LinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContentItem, ContentAttachment, ContentLink, ContentLinkInput } from "./types";
import { AttachmentUpload } from "./attachment-upload";
import { LinksEditor } from "./links-editor";

interface AttachmentsLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentItem;
  onSuccess?: () => void;
}

export function AttachmentsLinksDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: AttachmentsLinksDialogProps) {
  const [attachments, setAttachments] = useState<ContentAttachment[]>(
    item?.attachments || []
  );
  const [links, setLinks] = useState<ContentLink[]>(item?.links || []);
  const [prevItemId, setPrevItemId] = useState<number | null>(item?.id ?? null);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open && item && (prevOpen !== open || prevItemId !== item.id)) {
    setPrevOpen(open);
    setPrevItemId(item.id);
    setAttachments(item.attachments || []);
    setLinks(item.links || []);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const handleAttachmentsChange = (newAttachments: ContentAttachment[]) => {
    setAttachments(newAttachments);
    onSuccess?.();
  };

  const handleLinksChange = (newLinks: ContentLink[]) => {
    setLinks(newLinks);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attachments & Links</DialogTitle>
          <DialogDescription className="line-clamp-1">
            {item.title}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="attachments" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attachments" className="gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments
              {attachments.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({attachments.length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Links
              {links.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({links.length})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attachments" className="mt-4">
            <AttachmentUpload
              contentItemId={item.id}
              attachments={attachments}
              onAttachmentsChange={handleAttachmentsChange}
            />
          </TabsContent>

          <TabsContent value="links" className="mt-4">
            <LinksEditor
              contentItemId={item.id}
              links={links}
              onLinksChange={handleLinksChange}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
