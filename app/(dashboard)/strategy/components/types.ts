// Re-export unified types from content module
export {
  type Content,
  type ContentInput,
  type ContentStage,
  type IdeaStatus,
  type BriefStatus,
  type Priority,
  type EstimatedEffort,
  type IdeaVote,
  type BriefOutlineSection,
  type ContentType,
  type ContentAttachment,
  type ContentLink,
} from "../../content/components/types";

// ============================================================================
// Campaign Types
// ============================================================================

// Campaign from cp_campaigns
export interface Campaign {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  goals: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "planning" | "active" | "completed" | "cancelled";
  color: string;
  created_at: string;
  updated_at: string;
}

// Campaign summary from cp_campaign_summary view
export interface CampaignSummary {
  campaign_id: number;
  slug: string;
  name: string;
  description: string | null;
  status: "planning" | "active" | "completed" | "cancelled";
  color: string;
  start_date: string | null;
  end_date: string | null;
  release_name: string | null;
  total_content_items: number;
  published_items: number;
  draft_items: number;
  in_progress_items: number;
  scheduled_items: number;
  total_ideas: number;
  approved_ideas: number;
  total_briefs: number;
  calendar_events: number;
  completion_percentage: number;
}

// Campaign input for create/update
export interface CampaignInput {
  name: string;
  slug?: string;
  description?: string | null;
  goals?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: Campaign["status"];
  color?: string;
}

// ============================================================================
// Legacy Type Aliases (for backward compatibility)
// ============================================================================

// These types are now unified into Content
// Keeping these as aliases for components that still reference them

import type {
  Content,
  ContentInput,
  IdeaStatus,
  BriefStatus,
  IdeaVote,
  BriefOutlineSection,
  ContentType as ContentTypeBase,
} from "../../content/components/types";

// ContentIdea is now Content with stage='idea'
export interface ContentIdea {
  id: number;
  title: string;
  description: string | null;
  source: string | null;
  potential_keywords: string[];
  target_audience: string | null;
  estimated_effort: "low" | "medium" | "high" | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: IdeaStatus;
  content_type: ContentTypeBase | null;
  campaign: CampaignRef | null;
  vote_count: number;
  votes: IdeaVote[];
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ContentIdeaInput is now ContentInput with stage='idea'
export interface ContentIdeaInput {
  title: string;
  description?: string | null;
  source?: string | null;
  potential_keywords?: string[];
  target_audience?: string | null;
  estimated_effort?: "low" | "medium" | "high" | null;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: IdeaStatus;
  content_type_id?: number | null;
  campaign_id?: number | null;
  notes?: string | null;
}

// ContentBrief is now Content with stage='brief'
export interface ContentBrief {
  id: number;
  title: string;
  slug: string | null;
  summary: string | null;
  source: string | null;
  target_audience: string | null;
  content_goals: string | null;
  tone_and_style: string | null;
  primary_keyword: string | null;
  secondary_keywords: string[];
  search_intent: string | null;
  target_word_count: number | null;
  outline: BriefOutlineSection[];
  required_sections: string[];
  internal_links: string[];
  external_references: string[];
  status: BriefStatus;
  content_type: ContentTypeBase | null;
  campaign: CampaignRef | null;
  idea: IdeaRef | null;
  competitor_examples: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ContentBriefInput is now ContentInput with stage='brief'
export interface ContentBriefInput {
  title: string;
  slug?: string | null;
  summary?: string | null;
  source?: string | null;
  target_audience?: string | null;
  content_goals?: string | null;
  tone_and_style?: string | null;
  primary_keyword?: string | null;
  secondary_keywords?: string[];
  search_intent?: string | null;
  target_word_count?: number | null;
  outline?: BriefOutlineSection[];
  required_sections?: string[];
  status?: BriefStatus;
  content_type_id?: number | null;
  campaign_id?: number | null;
  notes?: string | null;
  // Note: idea_id removed since it's now the same record promoted
}

// ============================================================================
// Reference Types
// ============================================================================

// Simple reference types used in UI
export interface CampaignRef {
  id: number;
  name: string;
  color: string;
}

export interface IdeaRef {
  id: number;
  title: string;
}

// ============================================================================
// Filter Types
// ============================================================================

// Filter options
export interface StrategyFilterOptions {
  contentTypes: ContentTypeBase[];
  campaigns: CampaignRef[];
}

// Tab types
export type StrategyTab = "campaigns" | "ideas" | "briefs";

// Idea filters
export interface IdeaFilters {
  search: string;
  statuses: IdeaStatus[];
  priorities: ("low" | "medium" | "high" | "urgent")[];
  campaigns: number[];
}

// Brief filters
export interface BriefFilters {
  search: string;
  statuses: BriefStatus[];
  campaigns: number[];
}

// Default filters
export const DEFAULT_IDEA_FILTERS: IdeaFilters = {
  search: "",
  statuses: [],
  priorities: [],
  campaigns: [],
};

export const DEFAULT_BRIEF_FILTERS: BriefFilters = {
  search: "",
  statuses: [],
  campaigns: [],
};
