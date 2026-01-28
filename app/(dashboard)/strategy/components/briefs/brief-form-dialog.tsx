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
import type { ContentBrief, ContentBriefInput, StrategyFilterOptions } from "../types";

interface CampaignOption {
  id: number;
  name: string;
  color: string;
}

interface BriefFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief: ContentBrief | null;
  filterOptions: StrategyFilterOptions;
  localCampaigns: CampaignOption[];
  onCreateCampaign: (name: string) => Promise<string | null>;
  onSubmit: (input: ContentBriefInput) => Promise<void>;
}

export function BriefFormDialog({
  open,
  onOpenChange,
  brief,
  filterOptions,
  localCampaigns,
  onCreateCampaign,
  onSubmit,
}: BriefFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [formData, setFormData] = useState<ContentBriefInput>({
    title: "",
    summary: null,
    source: null,
    target_audience: null,
    content_goals: null,
    tone_and_style: null,
    primary_keyword: null,
    secondary_keywords: [],
    search_intent: null,
    target_word_count: null,
    status: "draft",
    content_type_id: null,
    campaign_id: null,
    notes: null,
  });

  useEffect(() => {
    if (brief) {
      setFormData({
        title: brief.title,
        summary: brief.summary,
        source: brief.source,
        target_audience: brief.target_audience,
        content_goals: brief.content_goals,
        tone_and_style: brief.tone_and_style,
        primary_keyword: brief.primary_keyword,
        secondary_keywords: brief.secondary_keywords,
        search_intent: brief.search_intent,
        target_word_count: brief.target_word_count,
        status: brief.status,
        content_type_id: brief.content_type?.id || null,
        campaign_id: brief.campaign?.id || null,
        notes: brief.notes,
      });
      setKeywordsInput(brief.secondary_keywords.join(", "));
    } else {
      setFormData({
        title: "",
        summary: null,
        source: null,
        target_audience: null,
        content_goals: null,
        tone_and_style: null,
        primary_keyword: null,
        secondary_keywords: [],
        search_intent: null,
        target_word_count: null,
        status: "draft",
        content_type_id: null,
        campaign_id: null,
        notes: null,
      });
      setKeywordsInput("");
    }
  }, [brief, open]);

  const handleKeywordsChange = (value: string) => {
    setKeywordsInput(value);
    const keywords = value
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    setFormData({ ...formData, secondary_keywords: keywords });
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
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{brief ? "Edit Brief" : "Create Brief"}</DialogTitle>
            <DialogDescription>
              {brief
                ? "Update the content brief details."
                : "Create a detailed content brief for writers."}
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

              {/* Status + Word Count */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        status: value as ContentBriefInput["status"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="word_count">Target Word Count</Label>
                  <Input
                    id="word_count"
                    type="number"
                    value={formData.target_word_count || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        target_word_count: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    placeholder="e.g., 2000"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="grid gap-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={formData.summary || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      summary: e.target.value || null,
                    })
                  }
                  placeholder="Brief executive summary of what the content should achieve..."
                  rows={3}
                />
              </div>

              {/* Source (from idea) */}
              <div className="grid gap-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={formData.source || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      source: e.target.value || null,
                    })
                  }
                  placeholder="Where did this idea come from?"
                />
              </div>

              {/* SEO Section */}
              <div className="space-y-4 pt-2 border-t">
                <h4 className="text-sm font-medium">SEO & Keywords</h4>

                {/* Primary Keyword + Search Intent */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="primary_keyword">Primary Keyword</Label>
                    <Input
                      id="primary_keyword"
                      value={formData.primary_keyword || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          primary_keyword: e.target.value || null,
                        })
                      }
                      placeholder="e.g., hearing aid maintenance"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="search_intent">Search Intent</Label>
                    <Select
                      value={formData.search_intent || "none"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          search_intent: value === "none" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select intent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="informational">Informational</SelectItem>
                        <SelectItem value="transactional">Transactional</SelectItem>
                        <SelectItem value="navigational">Navigational</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Secondary Keywords */}
                <div className="grid gap-2">
                  <Label htmlFor="secondary_keywords">Secondary Keywords</Label>
                  <Input
                    id="secondary_keywords"
                    value={keywordsInput}
                    onChange={(e) => handleKeywordsChange(e.target.value)}
                    placeholder="cleaning tips, care guide, troubleshooting (comma-separated)"
                  />
                </div>
              </div>

              {/* Audience Section */}
              <div className="space-y-4 pt-2 border-t">
                <h4 className="text-sm font-medium">Audience & Goals</h4>

                <div className="grid gap-2">
                  <Label htmlFor="target_audience">Target Audience</Label>
                  <Textarea
                    id="target_audience"
                    value={formData.target_audience || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        target_audience: e.target.value || null,
                      })
                    }
                    placeholder="Describe the target reader..."
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="content_goals">Content Goals</Label>
                  <Textarea
                    id="content_goals"
                    value={formData.content_goals || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        content_goals: e.target.value || null,
                      })
                    }
                    placeholder="What should the reader learn or do after reading?"
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tone_and_style">Tone & Style</Label>
                  <Input
                    id="tone_and_style"
                    value={formData.tone_and_style || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tone_and_style: e.target.value || null,
                      })
                    }
                    placeholder="e.g., Friendly, authoritative, conversational"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="grid gap-2 pt-2 border-t">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value || null })
                  }
                  placeholder="Any other important notes for the writer..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="-mx-6 -mb-6 rounded-b-lg border-t bg-muted/50 p-4">
            <Button type="submit" disabled={isSubmitting || !formData.title}>
              {isSubmitting ? "Saving..." : brief ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
