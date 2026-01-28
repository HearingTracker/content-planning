"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryStates, parseAsString, parseAsInteger } from "nuqs";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StrategyTabs } from "./components/strategy-tabs";
import { CampaignGrid } from "./components/campaigns/campaign-grid";
import { CampaignFormDialog } from "./components/campaigns/campaign-form-dialog";
import { IdeaList } from "./components/ideas/idea-list";
import { IdeaFormDialog } from "./components/ideas/idea-form-dialog";
import { BriefTable } from "./components/briefs/brief-table";
import { BriefFormDialog } from "./components/briefs/brief-form-dialog";
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useQuickCreateCampaign,
  useIdeas,
  useCreateIdea,
  useUpdateIdea,
  useDeleteIdea,
  useVoteOnIdea,
  useConvertIdeaToBrief,
  useBriefs,
  useCreateBrief,
  useUpdateBrief,
  useDeleteBrief,
  useStrategyFilterOptions,
  useCurrentUser,
  useCanDelete,
} from "@/hooks/queries";
import type {
  CampaignSummary,
  CampaignInput,
  ContentIdea,
  ContentIdeaInput,
  ContentBrief,
  ContentBriefInput,
  StrategyTab,
} from "./components/types";

const tabParsers = {
  tab: parseAsString.withDefault("campaigns"),
  brief: parseAsInteger,
  idea: parseAsInteger,
  campaign: parseAsInteger,
};

export default function StrategyPage() {
  const [urlState, setUrlState] = useQueryStates(tabParsers, {
    history: "push",
  });

  // React Query hooks
  const { data: campaigns = [], isLoading: isCampaignsLoading } = useCampaigns();
  const { data: ideas = [], isLoading: isIdeasLoading } = useIdeas();
  const { data: briefs = [], isLoading: isBriefsLoading } = useBriefs();
  const { data: filterOptions = { contentTypes: [], campaigns: [] } } = useStrategyFilterOptions();
  const { data: user } = useCurrentUser();

  // Mutations
  const createCampaignMutation = useCreateCampaign();
  const updateCampaignMutation = useUpdateCampaign();
  const deleteCampaignMutation = useDeleteCampaign();
  const quickCreateCampaignMutation = useQuickCreateCampaign();
  const createIdeaMutation = useCreateIdea();
  const updateIdeaMutation = useUpdateIdea();
  const deleteIdeaMutation = useDeleteIdea();
  const voteOnIdeaMutation = useVoteOnIdea();
  const convertIdeaToBriefMutation = useConvertIdeaToBrief();
  const createBriefMutation = useCreateBrief();
  const updateBriefMutation = useUpdateBrief();
  const deleteBriefMutation = useDeleteBrief();

  const userId = user?.id || null;
  const isLoading = isCampaignsLoading || isIdeasLoading || isBriefsLoading;
  const canEdit = useCanDelete(); // editors and admins can delete/convert

  // Local campaigns for dropdowns (synced from filter options)
  const localCampaigns = useMemo(
    () => filterOptions.campaigns,
    [filterOptions.campaigns]
  );

  // Quick create campaign handler for inline creation in dropdowns
  const handleQuickCreateCampaign = useCallback(
    async (name: string): Promise<string | null> => {
      const result = await quickCreateCampaignMutation.mutateAsync(name);
      if (result.success && result.id) {
        return result.id.toString();
      }
      return null;
    },
    [quickCreateCampaignMutation]
  );

  // Dialog states
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignSummary | null>(null);
  const [deleteCampaignDialogOpen, setDeleteCampaignDialogOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<CampaignSummary | null>(null);

  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);
  const [deleteIdeaDialogOpen, setDeleteIdeaDialogOpen] = useState(false);
  const [deletingIdea, setDeletingIdea] = useState<ContentIdea | null>(null);

  const [briefDialogOpen, setBriefDialogOpen] = useState(false);
  const [editingBrief, setEditingBrief] = useState<ContentBrief | null>(null);
  const [deleteBriefDialogOpen, setDeleteBriefDialogOpen] = useState(false);
  const [deletingBrief, setDeletingBrief] = useState<ContentBrief | null>(null);

  const activeTab = urlState.tab as StrategyTab;

  // Deep link: auto-open brief from URL
  useEffect(() => {
    if (urlState.brief && briefs.length > 0 && !isBriefsLoading) {
      const briefToOpen = briefs.find((b) => b.id === urlState.brief);
      if (briefToOpen) {
        if (activeTab !== "briefs") {
          setUrlState({ tab: "briefs" });
        }
        setEditingBrief(briefToOpen);
        setBriefDialogOpen(true);
      }
    }
  }, [urlState.brief, briefs, isBriefsLoading]);

  // Deep link: auto-open idea from URL
  useEffect(() => {
    if (urlState.idea && ideas.length > 0 && !isIdeasLoading) {
      const ideaToOpen = ideas.find((i) => i.id === urlState.idea);
      if (ideaToOpen) {
        if (activeTab !== "ideas") {
          setUrlState({ tab: "ideas" });
        }
        setEditingIdea(ideaToOpen);
        setIdeaDialogOpen(true);
      }
    }
  }, [urlState.idea, ideas, isIdeasLoading]);

  // Deep link: auto-open campaign from URL
  useEffect(() => {
    if (urlState.campaign && campaigns.length > 0 && !isCampaignsLoading) {
      const campaignToOpen = campaigns.find((c) => c.campaign_id === urlState.campaign);
      if (campaignToOpen) {
        if (activeTab !== "campaigns") {
          setUrlState({ tab: "campaigns" });
        }
        setEditingCampaign(campaignToOpen);
        setCampaignDialogOpen(true);
      }
    }
  }, [urlState.campaign, campaigns, isCampaignsLoading]);

  // Tab counts
  const counts = useMemo(
    () => ({
      campaigns: campaigns.length,
      ideas: ideas.filter((i) => i.status !== "converted" && i.status !== "rejected")
        .length,
      briefs: briefs.filter((b) => b.status !== "completed").length,
    }),
    [campaigns, ideas, briefs]
  );

  // Copy link helper
  const copyItemLink = useCallback((path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      toast("Link copied");
    });
  }, []);

  // Campaign handlers
  const handleCreateCampaign = () => {
    setEditingCampaign(null);
    setCampaignDialogOpen(true);
  };

  const handleEditCampaign = (campaign: CampaignSummary) => {
    setEditingCampaign(campaign);
    setCampaignDialogOpen(true);
    setUrlState({ campaign: campaign.campaign_id });
  };

  const handleCampaignDialogOpenChange = useCallback(
    (open: boolean) => {
      setCampaignDialogOpen(open);
      if (!open && urlState.campaign) {
        setUrlState({ campaign: null });
      }
    },
    [urlState.campaign, setUrlState]
  );

  const handleDeleteCampaignClick = (campaign: CampaignSummary) => {
    setDeletingCampaign(campaign);
    setDeleteCampaignDialogOpen(true);
  };

  const handleCampaignSubmit = async (input: CampaignInput) => {
    if (editingCampaign) {
      await updateCampaignMutation.mutateAsync({ id: editingCampaign.campaign_id, input });
    } else {
      await createCampaignMutation.mutateAsync(input);
    }
  };

  const handleConfirmDeleteCampaign = async () => {
    if (deletingCampaign) {
      await deleteCampaignMutation.mutateAsync(deletingCampaign.campaign_id);
      setDeleteCampaignDialogOpen(false);
      setDeletingCampaign(null);
    }
  };

  const handleCopyCampaignLink = useCallback(
    (campaign: CampaignSummary) => {
      copyItemLink(`/strategy?tab=campaigns&campaign=${campaign.campaign_id}`);
    },
    [copyItemLink]
  );

  // Idea handlers
  const handleCreateIdea = () => {
    setEditingIdea(null);
    setIdeaDialogOpen(true);
  };

  const handleEditIdea = (idea: ContentIdea) => {
    setEditingIdea(idea);
    setIdeaDialogOpen(true);
    setUrlState({ idea: idea.id });
  };

  const handleIdeaDialogOpenChange = useCallback(
    (open: boolean) => {
      setIdeaDialogOpen(open);
      if (!open && urlState.idea) {
        setUrlState({ idea: null });
      }
    },
    [urlState.idea, setUrlState]
  );

  const handleDeleteIdeaClick = (idea: ContentIdea) => {
    setDeletingIdea(idea);
    setDeleteIdeaDialogOpen(true);
  };

  const handleIdeaSubmit = async (input: ContentIdeaInput) => {
    if (editingIdea) {
      await updateIdeaMutation.mutateAsync({ id: editingIdea.id, input });
    } else {
      await createIdeaMutation.mutateAsync(input);
    }
  };

  const handleConfirmDeleteIdea = async () => {
    if (deletingIdea) {
      await deleteIdeaMutation.mutateAsync(deletingIdea.id);
      setDeleteIdeaDialogOpen(false);
      setDeletingIdea(null);
    }
  };

  const handleVoteOnIdea = async (ideaId: number, vote: 1 | -1) => {
    await voteOnIdeaMutation.mutateAsync({ ideaId, vote });
  };

  const handleConvertIdeaToBrief = async (idea: ContentIdea) => {
    const result = await convertIdeaToBriefMutation.mutateAsync(idea.id);
    if (result.success) {
      setUrlState({ tab: "briefs" });
    }
  };

  const handleCopyIdeaLink = useCallback(
    (idea: ContentIdea) => {
      copyItemLink(`/strategy?tab=ideas&idea=${idea.id}`);
    },
    [copyItemLink]
  );

  // Brief handlers
  const handleCreateBrief = () => {
    setEditingBrief(null);
    setBriefDialogOpen(true);
  };

  const handleEditBrief = (brief: ContentBrief) => {
    setEditingBrief(brief);
    setBriefDialogOpen(true);
    setUrlState({ brief: brief.id });
  };

  const handleBriefDialogOpenChange = useCallback(
    (open: boolean) => {
      setBriefDialogOpen(open);
      if (!open && urlState.brief) {
        setUrlState({ brief: null });
      }
    },
    [urlState.brief, setUrlState]
  );

  const handleViewBrief = (brief: ContentBrief) => {
    handleEditBrief(brief);
  };

  const handleDeleteBriefClick = (brief: ContentBrief) => {
    setDeletingBrief(brief);
    setDeleteBriefDialogOpen(true);
  };

  const handleBriefSubmit = async (input: ContentBriefInput) => {
    if (editingBrief) {
      await updateBriefMutation.mutateAsync({ id: editingBrief.id, input });
    } else {
      await createBriefMutation.mutateAsync(input);
    }
  };

  const handleConfirmDeleteBrief = async () => {
    if (deletingBrief) {
      await deleteBriefMutation.mutateAsync(deletingBrief.id);
      setDeleteBriefDialogOpen(false);
      setDeletingBrief(null);
    }
  };

  const handleCreateContentFromBrief = (brief: ContentBrief) => {
    // Navigate to content page with brief pre-selected
    window.location.href = `/content?brief_id=${brief.id}`;
  };

  const handleCopyBriefLink = useCallback(
    (brief: ContentBrief) => {
      copyItemLink(`/strategy?tab=briefs&brief=${brief.id}`);
    },
    [copyItemLink]
  );

  // Get create button label
  const getCreateLabel = () => {
    switch (activeTab) {
      case "campaigns":
        return "New campaign";
      case "ideas":
        return "Submit pitch";
      case "briefs":
        return "New brief";
    }
  };

  const handleCreate = () => {
    switch (activeTab) {
      case "campaigns":
        handleCreateCampaign();
        break;
      case "ideas":
        handleCreateIdea();
        break;
      case "briefs":
        handleCreateBrief();
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Strategy
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan campaigns, collect pitches, and create content briefs
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          {getCreateLabel()}
        </Button>
      </div>

      {/* Tabs */}
      <StrategyTabs
        activeTab={activeTab}
        onTabChange={(tab) => setUrlState({ tab })}
        counts={counts}
      />

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : activeTab === "campaigns" ? (
        <CampaignGrid
          campaigns={campaigns}
          onEdit={handleEditCampaign}
          onDelete={handleDeleteCampaignClick}
          onCopyLink={handleCopyCampaignLink}
          onCreateNew={handleCreateCampaign}
        />
      ) : activeTab === "ideas" ? (
        <IdeaList
          ideas={ideas}
          userId={userId}
          onEdit={handleEditIdea}
          onDelete={canEdit ? handleDeleteIdeaClick : undefined}
          onConvertToBrief={canEdit ? handleConvertIdeaToBrief : undefined}
          onCopyLink={handleCopyIdeaLink}
          onVote={handleVoteOnIdea}
          onCreateNew={handleCreateIdea}
        />
      ) : (
        <BriefTable
          data={briefs}
          onEdit={handleEditBrief}
          onDelete={canEdit ? handleDeleteBriefClick : undefined}
          onView={handleViewBrief}
          onCreateContent={canEdit ? handleCreateContentFromBrief : undefined}
          onCopyLink={handleCopyBriefLink}
          onCreateNew={handleCreateBrief}
        />
      )}

      {/* Campaign Dialogs */}
      <CampaignFormDialog
        open={campaignDialogOpen}
        onOpenChange={handleCampaignDialogOpenChange}
        campaign={editingCampaign}
        onSubmit={handleCampaignSubmit}
      />
      <ConfirmDialog
        open={deleteCampaignDialogOpen}
        onOpenChange={setDeleteCampaignDialogOpen}
        title="Delete campaign"
        description={`Are you sure you want to delete "${deletingCampaign?.name}"? This will not delete associated content items.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteCampaign}
        variant="destructive"
      />

      {/* Idea Dialogs */}
      <IdeaFormDialog
        open={ideaDialogOpen}
        onOpenChange={handleIdeaDialogOpenChange}
        idea={editingIdea}
        filterOptions={filterOptions}
        localCampaigns={localCampaigns}
        onCreateCampaign={handleQuickCreateCampaign}
        onSubmit={handleIdeaSubmit}
      />
      <ConfirmDialog
        open={deleteIdeaDialogOpen}
        onOpenChange={setDeleteIdeaDialogOpen}
        title="Delete pitch"
        description={`Are you sure you want to delete "${deletingIdea?.title}"?`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteIdea}
        variant="destructive"
      />

      {/* Brief Dialogs */}
      <BriefFormDialog
        open={briefDialogOpen}
        onOpenChange={handleBriefDialogOpenChange}
        brief={editingBrief}
        filterOptions={filterOptions}
        localCampaigns={localCampaigns}
        onCreateCampaign={handleQuickCreateCampaign}
        onSubmit={handleBriefSubmit}
      />
      <ConfirmDialog
        open={deleteBriefDialogOpen}
        onOpenChange={setDeleteBriefDialogOpen}
        title="Delete brief"
        description={`Are you sure you want to delete "${deletingBrief?.title}"?`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteBrief}
        variant="destructive"
      />
    </div>
  );
}
