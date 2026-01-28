"use client";

import { LinksEditor } from "../../links-editor";
import type { ContentLink, ContentLinkInput } from "../../types";

interface LinksTabProps {
  contentItemId: number | null;
  links: ContentLink[];
  onLinksChange: (links: ContentLink[]) => void;
  pendingLinks?: ContentLinkInput[];
  onPendingLinksChange?: (links: ContentLinkInput[]) => void;
}

export function LinksTab({
  contentItemId,
  links,
  onLinksChange,
  pendingLinks,
  onPendingLinksChange,
}: LinksTabProps) {
  return (
    <LinksEditor
      contentItemId={contentItemId}
      links={links}
      onLinksChange={onLinksChange}
      pendingLinks={pendingLinks}
      onPendingLinksChange={onPendingLinksChange}
    />
  );
}
