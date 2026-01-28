"use client";

import { CampaignCard } from "./campaign-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { CampaignSummary } from "../types";

interface CampaignGridProps {
  campaigns: CampaignSummary[];
  onEdit: (campaign: CampaignSummary) => void;
  onDelete: (campaign: CampaignSummary) => void;
  onCopyLink?: (campaign: CampaignSummary) => void;
  onCreateNew: () => void;
}

export function CampaignGrid({
  campaigns,
  onEdit,
  onDelete,
  onCopyLink,
  onCreateNew,
}: CampaignGridProps) {
  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon="folder"
        title="No campaigns"
        description="Create your first campaign to organize your content strategy."
        action={{
          label: "Create campaign",
          onClick: onCreateNew,
        }}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.campaign_id}
          campaign={campaign}
          onEdit={() => onEdit(campaign)}
          onDelete={() => onDelete(campaign)}
          onCopyLink={onCopyLink ? () => onCopyLink(campaign) : undefined}
        />
      ))}
    </div>
  );
}
