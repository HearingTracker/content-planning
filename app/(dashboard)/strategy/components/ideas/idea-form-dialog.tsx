"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import type { ContentIdea, ContentIdeaInput, StrategyFilterOptions } from "../types";

interface CampaignOption {
  id: number;
  name: string;
  color: string;
}

interface IdeaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: ContentIdea | null;
  filterOptions: StrategyFilterOptions;
  localCampaigns: CampaignOption[];
  onCreateCampaign: (name: string) => Promise<string | null>;
  onSubmit: (input: ContentIdeaInput) => Promise<void>;
}

export function IdeaFormDialog({
  open,
  onOpenChange,
  idea,
  filterOptions,
  localCampaigns,
  onCreateCampaign,
  onSubmit,
}: IdeaFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [formData, setFormData] = useState<ContentIdeaInput>({
    title: "",
    description: null,
    source: null,
    potential_keywords: [],
    target_audience: null,
    estimated_effort: null,
    priority: "medium",
    status: "submitted",
    content_type_id: null,
    campaign_id: null,
    notes: null,
  });

  useEffect(() => {
    if (idea) {
      setFormData({
        title: idea.title,
        description: idea.description,
        source: idea.source,
        potential_keywords: idea.potential_keywords,
        target_audience: idea.target_audience,
        estimated_effort: idea.estimated_effort,
        priority: idea.priority,
        status: idea.status,
        content_type_id: idea.content_type?.id || null,
        campaign_id: idea.campaign?.id || null,
        notes: idea.notes,
      });
      setKeywordsInput(idea.potential_keywords.join(", "));
    } else {
      setFormData({
        title: "",
        description: null,
        source: null,
        potential_keywords: [],
        target_audience: null,
        estimated_effort: null,
        priority: "medium",
        status: "submitted",
        content_type_id: null,
        campaign_id: null,
        notes: null,
      });
      setKeywordsInput("");
    }
  }, [idea, open]);

  const handleKeywordsChange = (value: string) => {
    setKeywordsInput(value);
    const keywords = value
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    setFormData({ ...formData, potential_keywords: keywords });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{idea ? "Edit Pitch" : "Submit Pitch"}</DialogTitle>
            <DialogDescription>
              {idea
                ? "Update the content pitch."
                : "Submit a new content pitch for review."}
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-6 max-h-[60vh] overflow-y-auto px-6">
            <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Complete Guide to Hearing Aid Maintenance"
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value || null,
                  })
                }
                placeholder="Brief description of the content pitch..."
                rows={3}
              />
            </div>

            {/* Content Type + Campaign */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="content_type">Content Type</Label>
                <Select
                  value={formData.content_type_id?.toString() || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      content_type_id: value === "none" ? null : Number(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filterOptions.contentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="campaign">Campaign</Label>
                <Combobox
                  options={localCampaigns.map((campaign) => ({
                    value: campaign.id.toString(),
                    label: campaign.name,
                    color: campaign.color,
                  }))}
                  value={formData.campaign_id?.toString() || null}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      campaign_id: value ? Number(value) : null,
                    })
                  }
                  onCreate={onCreateCampaign}
                  placeholder="Select campaign"
                  searchPlaceholder="Search or create..."
                  emptyText="No campaigns found."
                  createText="Create campaign"
                />
              </div>
            </div>

            {/* Priority + Effort */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority || "medium"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      priority: value as ContentIdeaInput["priority"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="effort">Estimated Effort</Label>
                <Select
                  value={formData.estimated_effort || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      estimated_effort:
                        value === "none"
                          ? null
                          : (value as ContentIdeaInput["estimated_effort"]),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select effort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unknown</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status (only for editing) */}
            {idea && (
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      status: value as ContentIdeaInput["status"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Keywords */}
            <div className="grid gap-2">
              <Label htmlFor="keywords">Potential Keywords</Label>
              <Input
                id="keywords"
                value={keywordsInput}
                onChange={(e) => handleKeywordsChange(e.target.value)}
                placeholder="hearing aids, maintenance, tips (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">
                Enter keywords separated by commas
              </p>
            </div>

            {/* Target Audience */}
            <div className="grid gap-2">
              <Label htmlFor="target_audience">Target Audience</Label>
              <Input
                id="target_audience"
                value={formData.target_audience || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    target_audience: e.target.value || null,
                  })
                }
                placeholder="e.g., First-time hearing aid users"
              />
            </div>

            {/* Source */}
            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={formData.source || ""}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value || null })
                }
                placeholder="e.g., team, seo, customer feedback"
              />
            </div>
            </div>
          </div>

          <DialogFooter className="-mx-6 -mb-6 rounded-b-lg border-t bg-muted/50 p-4">
            <Button type="submit" disabled={isSubmitting || !formData.title}>
              {isSubmitting ? "Saving..." : idea ? "Save changes" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
