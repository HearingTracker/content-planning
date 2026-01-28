// Workflow status from cp_workflow_statuses
export interface WorkflowStatus {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  is_initial: boolean;
  is_terminal: boolean;
  allowed_transitions: string[];
  display_order: number;
}

// Content type from cp_content_types
export interface ContentType {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
}

// Author from authors table
export interface Author {
  id: number;
  name: string;
  slug: string;
  avatar_url: string | null;
}

// User from auth.users + user_profiles (for assignments)
export interface User {
  id: string; // UUID
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

// Content assignment roles
export type AssignmentRole = "author" | "editor" | "reviewer" | "contributor";

// Content assignment from cp_content_assignments
export interface ContentAssignment {
  id: number;
  content_id: number;
  user_id: string;
  user: User;
  role: AssignmentRole;
  assigned_at: string;
  notes: string | null;
}

// Campaign summary
export interface CampaignSummary {
  id: number;
  name: string;
  color: string;
}

// Tag from cp_tags
export interface Tag {
  id: number;
  slug: string;
  name: string;
  color: string;
  tag_group: string | null;
}

// Content attachment from cp_content_attachments
export interface ContentAttachment {
  id: number;
  content_id: number;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// Content link from cp_content_links
export interface ContentLink {
  id: number;
  content_id: number;
  url: string;
  name: string | null;
  description: string | null;
  link_type: string;
  display_order: number;
  created_by: string | null;
  created_at: string;
}

// Comment from cp_comments
export interface Comment {
  id: number;
  commentable_type: "content_item" | "content_brief" | "content_idea";
  commentable_id: number;
  body: string;
  body_html: string | null;
  parent_id: number | null;
  author_id: string;
  author_email?: string;
  author_display_name?: string | null;
  author_avatar_url?: string | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  mentions: string[];
  attachments: CommentAttachment[];
  created_at: string;
  updated_at: string;
}

// Comment attachment from cp_comment_attachments
export interface CommentAttachment {
  id: number;
  comment_id: number;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

// ============================================================================
// Content Stages & Status Types
// ============================================================================

export type ContentStage = "idea" | "brief" | "content";
export type IdeaStatus = "submitted" | "under_review" | "approved" | "rejected" | "converted";
export type BriefStatus = "draft" | "ready" | "assigned" | "in_progress" | "completed";
export type Priority = "low" | "medium" | "high" | "urgent";
export type EstimatedEffort = "low" | "medium" | "high";

// Vote on an idea
export interface IdeaVote {
  user_id: string;
  vote: 1 | -1;
  timestamp: string;
}

// Brief outline section
export interface BriefOutlineSection {
  heading: string;
  subheadings?: string[];
  notes?: string;
}

// ============================================================================
// Unified Content Type
// ============================================================================

// Unified Content interface from cp_content table
export interface Content {
  id: number;
  title: string;
  slug: string | null;
  description: string | null;

  // Stage tracking
  stage: ContentStage;
  idea_status: IdeaStatus | null;
  brief_status: BriefStatus | null;
  workflow_status: WorkflowStatus | null;

  // Common fields
  content_type: ContentType | null;
  campaign: CampaignSummary | null;
  priority: Priority;
  notes: string | null;
  metadata: Record<string, unknown>;

  // Idea-specific fields
  source: string | null;
  potential_keywords: string[];
  target_audience: string | null;
  estimated_effort: EstimatedEffort | null;
  vote_count: number;
  votes: IdeaVote[];
  rejection_reason: string | null;

  // Brief/SEO fields
  primary_keyword: string | null;
  secondary_keywords: string[];
  search_intent: string | null;
  target_word_count: number | null;
  content_goals: string | null;
  tone_and_style: string | null;
  outline: BriefOutlineSection[];
  required_sections: string[];
  internal_links: string[];
  external_references: string[];
  competitor_examples: string[];

  // Content-specific fields
  body: EditorJSData | null;
  storyblok_url: string | null;
  due_date: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  publish_date: string | null;
  display_order: number;
  seo_metadata: Record<string, unknown>;
  social_metadata: Record<string, unknown>;

  // Relations (for content stage)
  assignments: ContentAssignment[];
  tags: Tag[];
  attachments: ContentAttachment[];
  links: ContentLink[];

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Content Input Types
// ============================================================================

// Unified input for creating/updating content
export interface ContentInput {
  title: string;
  slug?: string | null;
  description?: string | null;
  stage?: ContentStage;

  // Status fields
  idea_status?: IdeaStatus;
  brief_status?: BriefStatus;
  workflow_status_id?: number | null;

  // Common fields
  content_type_id?: number | null;
  campaign_id?: number | null;
  priority?: Priority;
  notes?: string | null;

  // Idea fields
  source?: string | null;
  potential_keywords?: string[];
  target_audience?: string | null;
  estimated_effort?: EstimatedEffort | null;

  // Brief/SEO fields
  primary_keyword?: string | null;
  secondary_keywords?: string[];
  search_intent?: string | null;
  target_word_count?: number | null;
  content_goals?: string | null;
  tone_and_style?: string | null;
  outline?: BriefOutlineSection[];
  required_sections?: string[];
  internal_links?: string[];
  external_references?: string[];
  competitor_examples?: string[];

  // Content fields
  body?: EditorJSData | null;
  storyblok_url?: string | null;
  due_date?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

// Content link input for creation/update
export interface ContentLinkInput {
  url: string;
  name?: string | null;
  description?: string | null;
  link_type?: string;
  display_order?: number;
}

// Input for adding/removing assignments
export interface AssignmentInput {
  user_id: string;
  role: AssignmentRole;
  notes?: string | null;
}

// ============================================================================
// Legacy Type Aliases (for backward compatibility during migration)
// ============================================================================

// ContentItem is now just Content with stage='content'
export type ContentItem = Content;

// ContentItemInput is now just ContentInput
export type ContentItemInput = ContentInput;

// ============================================================================
// Filter Types
// ============================================================================

// Filter state for content items
export interface ContentFilters {
  search: string;
  statuses: string[]; // workflow status slugs
  types: string[]; // content type slugs
  campaigns: number[];
  assignees: string[]; // user IDs (UUIDs)
  priorities: Priority[];
}

// Default filters
export const DEFAULT_CONTENT_FILTERS: ContentFilters = {
  search: "",
  statuses: [],
  types: [],
  campaigns: [],
  assignees: [],
  priorities: [],
};

// View types
export type ContentView = "list" | "kanban" | "calendar";

// ============================================================================
// Editor.js Types
// ============================================================================

// Editor.js block data types
export interface EditorJSBlock {
  id?: string;
  type: string;
  data: Record<string, unknown>;
}

// Editor.js output data
export interface EditorJSData {
  time?: number;
  blocks: EditorJSBlock[];
  version?: string;
}

// ============================================================================
// View Types
// ============================================================================

// Calendar view item (from cp_calendar_view)
export interface CalendarItem {
  item_type: "content_item" | "content_due" | "calendar_event";
  item_id: number;
  title: string;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: boolean;
  color: string;
  priority: Priority | null;
  content_type_name: string | null;
  content_type_icon: string | null;
  status_name: string | null;
  campaign_name: string | null;
  campaign_id: number | null;
  calendar_event_id: number | null;
}

// Pipeline summary (from cp_content_pipeline)
export interface PipelineStatus {
  status_id: number;
  status_slug: string;
  status_name: string;
  status_color: string;
  display_order: number;
  is_initial: boolean;
  is_terminal: boolean;
  item_count: number;
  urgent_count: number;
  high_priority_count: number;
  overdue_count: number;
}

// Filter options for dropdowns
export interface ContentFilterOptions {
  statuses: WorkflowStatus[];
  types: ContentType[];
  campaigns: CampaignSummary[];
  users: User[]; // Registered site users (for assignments)
}
