"use client";

import { useState } from "react";
import { ExternalLink, X, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import type { ContentFilterOptions, ContentItemInput, CampaignSummary } from "../../types";

interface DetailsTabProps {
  formData: ContentItemInput;
  onChange: (updates: Partial<ContentItemInput>) => void;
  filterOptions: ContentFilterOptions;
  localCampaigns: CampaignSummary[];
  onCreateCampaign: (name: string) => Promise<string | null>;
}

export function DetailsTab({
  formData,
  onChange,
  filterOptions,
  localCampaigns,
  onCreateCampaign,
}: DetailsTabProps) {
  const [isEditingStoryblokUrl, setIsEditingStoryblokUrl] = useState(false);
  const [tempStoryblokUrl, setTempStoryblokUrl] = useState("");

  const handleStartEditingUrl = () => {
    setTempStoryblokUrl(formData.storyblok_url || "");
    setIsEditingStoryblokUrl(true);
  };

  const handleSaveUrl = () => {
    onChange({ storyblok_url: tempStoryblokUrl || null });
    setIsEditingStoryblokUrl(false);
  };

  const handleCancelEditUrl = () => {
    setTempStoryblokUrl("");
    setIsEditingStoryblokUrl(false);
  };

  return (
    <div className="space-y-4 p-1">
      {/* Title */}
      <div className="grid gap-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Enter content title"
          required
        />
      </div>

      {/* Row: Content Type + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="content_type">Content Type</Label>
          <Select
            value={formData.content_type_id?.toString() || "none"}
            onValueChange={(value) =>
              onChange({
                content_type_id: value === "none" ? null : Number(value),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {filterOptions.types.map((type) => (
                <SelectItem key={type.id} value={type.id.toString()}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.workflow_status_id?.toString() || "none"}
            onValueChange={(value) =>
              onChange({
                workflow_status_id: value === "none" ? null : Number(value),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default (Draft)</SelectItem>
              {filterOptions.statuses.map((status) => (
                <SelectItem key={status.id} value={status.id.toString()}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row: Campaign + Priority */}
      <div className="grid grid-cols-2 gap-4">
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
              onChange({
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

        <div className="grid gap-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={formData.priority || "medium"}
            onValueChange={(value) =>
              onChange({
                priority: value as ContentItemInput["priority"],
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          placeholder="Add any notes or context..."
          rows={3}
        />
      </div>

      {/* Storyblok URL */}
      <div className="grid gap-2">
        <Label htmlFor="storyblok_url">Storyblok URL</Label>
        {isEditingStoryblokUrl ? (
          <div className="p-3 rounded-lg border bg-background space-y-2">
            <Input
              id="storyblok_url"
              type="url"
              value={tempStoryblokUrl}
              onChange={(e) => setTempStoryblokUrl(e.target.value)}
              placeholder="https://app.storyblok.com/..."
              className="text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveUrl();
                if (e.key === "Escape") handleCancelEditUrl();
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEditUrl}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveUrl}
              >
                Save
              </Button>
            </div>
          </div>
        ) : formData.storyblok_url ? (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 group">
            <LinkIcon className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <a
                href={formData.storyblok_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline flex items-center gap-1"
              >
                {formData.storyblok_url}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleStartEditingUrl}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onChange({ storyblok_url: null })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <Input
            id="storyblok_url"
            type="url"
            value=""
            onChange={(e) =>
              onChange({ storyblok_url: e.target.value || null })
            }
            placeholder="https://app.storyblok.com/..."
          />
        )}
      </div>
    </div>
  );
}
