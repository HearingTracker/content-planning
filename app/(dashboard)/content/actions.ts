"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyComment, notifyAssignment } from "@/lib/notifications/triggers";
import type {
  ContentItem,
  ContentItemInput,
  ContentFilterOptions,
  CalendarItem,
  PipelineStatus,
  ContentAttachment,
  ContentLink,
  ContentLinkInput,
  Comment,
  User,
  ContentAssignment,
  AssignmentInput,
  AssignmentRole,
} from "./components/types";

export async function getContentItems(): Promise<ContentItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_content")
    .select(`
      id,
      title,
      slug,
      description,
      stage,
      idea_status,
      brief_status,
      priority,
      due_date,
      scheduled_date,
      scheduled_time,
      publish_date,
      notes,
      storyblok_url,
      body,
      display_order,
      metadata,
      source,
      potential_keywords,
      target_audience,
      estimated_effort,
      vote_count,
      votes,
      rejection_reason,
      primary_keyword,
      secondary_keywords,
      search_intent,
      target_word_count,
      content_goals,
      tone_and_style,
      outline,
      required_sections,
      internal_links,
      external_references,
      competitor_examples,
      seo_metadata,
      social_metadata,
      created_at,
      updated_at,
      content_type:cp_content_types(id, slug, name, description, icon, is_active),
      workflow_status:cp_workflow_statuses(id, slug, name, description, color, is_initial, is_terminal, allowed_transitions, display_order),
      campaign:cp_campaigns(id, name, color),
      tags:cp_content_tags(tag:cp_tags(id, slug, name, color, tag_group)),
      attachments:cp_content_attachments(id, content_id, storage_path, file_name, file_size, mime_type, uploaded_by, created_at),
      links:cp_content_links(id, content_id, url, name, description, link_type, display_order, created_by, created_at)
    `)
    .eq("stage", "content")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching content items:", error);
    return [];
  }

  // Fetch all assignments for these content items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentIds = (data || []).map((item: any) => item.id);
  const assignmentsByItem: Record<number, ContentAssignment[]> = {};

  if (contentIds.length > 0) {
    const { data: assignments } = await supabase
      .from("cp_content_assignments")
      .select("id, content_id, user_id, role, assigned_at, notes")
      .in("content_id", contentIds);

    // Get unique user IDs from assignments
    const userIds = [...new Set((assignments || []).map((a) => a.user_id))];
    const usersById: Record<string, User> = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("registered_users")
        .select("id, email, display_name, avatar_url")
        .in("id", userIds);

      (users || []).forEach((u) => {
        usersById[u.id] = {
          id: u.id,
          email: u.email,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
        };
      });
    }

    // Group assignments by content_id
    (assignments || []).forEach((a) => {
      if (!assignmentsByItem[a.content_id]) {
        assignmentsByItem[a.content_id] = [];
      }
      assignmentsByItem[a.content_id].push({
        id: a.id,
        content_id: a.content_id,
        user_id: a.user_id,
        user: usersById[a.user_id] || { id: a.user_id, email: "", display_name: null, avatar_url: null },
        role: a.role as AssignmentRole,
        assigned_at: a.assigned_at,
        notes: a.notes,
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    description: item.description,
    stage: item.stage,
    idea_status: item.idea_status,
    brief_status: item.brief_status,
    content_type: item.content_type || null,
    workflow_status: item.workflow_status || null,
    campaign: item.campaign || null,
    assignments: assignmentsByItem[item.id] || [],
    priority: item.priority as ContentItem["priority"],
    due_date: item.due_date,
    scheduled_date: item.scheduled_date,
    scheduled_time: item.scheduled_time,
    publish_date: item.publish_date,
    notes: item.notes,
    storyblok_url: item.storyblok_url,
    body: item.body || null,
    display_order: item.display_order ?? 0,
    metadata: item.metadata || {},
    // Idea fields
    source: item.source,
    potential_keywords: item.potential_keywords || [],
    target_audience: item.target_audience,
    estimated_effort: item.estimated_effort,
    vote_count: item.vote_count || 0,
    votes: item.votes || [],
    rejection_reason: item.rejection_reason,
    // Brief/SEO fields
    primary_keyword: item.primary_keyword,
    secondary_keywords: item.secondary_keywords || [],
    search_intent: item.search_intent,
    target_word_count: item.target_word_count,
    content_goals: item.content_goals,
    tone_and_style: item.tone_and_style,
    outline: item.outline || [],
    required_sections: item.required_sections || [],
    internal_links: item.internal_links || [],
    external_references: item.external_references || [],
    competitor_examples: item.competitor_examples || [],
    seo_metadata: item.seo_metadata || {},
    social_metadata: item.social_metadata || {},
    tags: (item.tags || []).map((t: { tag: unknown }) => t.tag).filter(Boolean),
    attachments: item.attachments || [],
    links: (item.links || []).sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order),
    created_at: item.created_at,
    updated_at: item.updated_at,
  })) as ContentItem[];
}

export async function getFilterOptions(): Promise<ContentFilterOptions> {
  const supabase = await createClient();

  const [statusesRes, typesRes, campaignsRes, usersRes] = await Promise.all([
    supabase
      .from("cp_workflow_statuses")
      .select("id, slug, name, description, color, is_initial, is_terminal, allowed_transitions, display_order")
      .order("display_order"),
    supabase
      .from("cp_content_types")
      .select("id, slug, name, description, icon, is_active")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("cp_campaigns")
      .select("id, name, color")
      .in("status", ["planning", "active"])
      .order("name"),
    supabase
      .from("registered_users")
      .select("id, email, display_name, avatar_url"),
  ]);

  return {
    statuses: statusesRes.data || [],
    types: typesRes.data || [],
    campaigns: campaignsRes.data || [],
    users: usersRes.data || [],
  };
}

// Generate a random color for new campaigns
function generateCampaignColor(): string {
  const colors = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
    "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
    "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export async function createCampaign(
  name: string
): Promise<{ success: boolean; id?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data, error } = await supabase
    .from("cp_campaigns")
    .insert({
      name,
      slug,
      status: "planning",
      color: generateCampaignColor(),
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

export async function getPipelineSummary(): Promise<PipelineStatus[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_content_pipeline")
    .select("*")
    .order("display_order");

  if (error) {
    console.error("Error fetching pipeline summary:", error);
    return [];
  }

  return data || [];
}

export async function getCalendarItems(
  startDate: string,
  endDate: string
): Promise<CalendarItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_calendar_view")
    .select("*")
    .gte("start_date", startDate)
    .lte("start_date", endDate);

  if (error) {
    console.error("Error fetching calendar items:", error);
    return [];
  }

  return data || [];
}

export async function createContentItem(
  input: ContentItemInput
): Promise<{ success: boolean; error?: string; id?: number }> {
  const supabase = await createClient();

  // Get default workflow status if not provided
  let workflowStatusId = input.workflow_status_id;
  if (!workflowStatusId) {
    const { data: defaultStatus } = await supabase
      .from("cp_workflow_statuses")
      .select("id")
      .eq("is_initial", true)
      .single();
    workflowStatusId = defaultStatus?.id;
  }

  const { data, error } = await supabase
    .from("cp_content")
    .insert({
      title: input.title,
      slug: input.slug,
      description: input.description,
      stage: "content",
      content_type_id: input.content_type_id,
      workflow_status_id: workflowStatusId,
      campaign_id: input.campaign_id,
      priority: input.priority || "medium",
      due_date: input.due_date,
      scheduled_date: input.scheduled_date,
      scheduled_time: input.scheduled_time,
      notes: input.notes,
      storyblok_url: input.storyblok_url,
      body: input.body,
      // SEO fields can be set from input if provided
      primary_keyword: input.primary_keyword,
      secondary_keywords: input.secondary_keywords,
      target_audience: input.target_audience,
      content_goals: input.content_goals,
      tone_and_style: input.tone_and_style,
      outline: input.outline,
      internal_links: input.internal_links,
      external_references: input.external_references,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating content item:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true, id: data.id };
}

export async function updateContentItem(
  id: number,
  input: Partial<ContentItemInput>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content")
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.content_type_id !== undefined && { content_type_id: input.content_type_id }),
      ...(input.workflow_status_id !== undefined && { workflow_status_id: input.workflow_status_id }),
      ...(input.campaign_id !== undefined && { campaign_id: input.campaign_id }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.due_date !== undefined && { due_date: input.due_date }),
      ...(input.scheduled_date !== undefined && { scheduled_date: input.scheduled_date }),
      ...(input.scheduled_time !== undefined && { scheduled_time: input.scheduled_time }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.storyblok_url !== undefined && { storyblok_url: input.storyblok_url }),
      ...(input.body !== undefined && { body: input.body }),
      // SEO fields
      ...(input.primary_keyword !== undefined && { primary_keyword: input.primary_keyword }),
      ...(input.secondary_keywords !== undefined && { secondary_keywords: input.secondary_keywords }),
      ...(input.target_audience !== undefined && { target_audience: input.target_audience }),
      ...(input.content_goals !== undefined && { content_goals: input.content_goals }),
      ...(input.tone_and_style !== undefined && { tone_and_style: input.tone_and_style }),
      ...(input.outline !== undefined && { outline: input.outline }),
      ...(input.internal_links !== undefined && { internal_links: input.internal_links }),
      ...(input.external_references !== undefined && { external_references: input.external_references }),
    })
    .eq("id", id)
    .eq("stage", "content");

  if (error) {
    console.error("Error updating content item:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true };
}

export async function deleteContentItem(
  id: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content")
    .delete()
    .eq("id", id)
    .eq("stage", "content");

  if (error) {
    console.error("Error deleting content item:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true };
}

export async function changeWorkflowStatus(
  contentId: number,
  newStatusId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get current status for transition logging
  const { data: currentItem } = await supabase
    .from("cp_content")
    .select("workflow_status_id")
    .eq("id", contentId)
    .eq("stage", "content")
    .single();

  const fromStatusId = currentItem?.workflow_status_id;

  // Update the status
  const { error: updateError } = await supabase
    .from("cp_content")
    .update({ workflow_status_id: newStatusId })
    .eq("id", contentId)
    .eq("stage", "content");

  if (updateError) {
    console.error("Error changing workflow status:", updateError);
    return { success: false, error: updateError.message };
  }

  // Log the transition
  if (fromStatusId) {
    await supabase.from("cp_workflow_transitions").insert({
      content_id: contentId,
      from_status_id: fromStatusId,
      to_status_id: newStatusId,
      transitioned_by: user?.id,
    });
  }

  revalidatePath("/content");
  return { success: true };
}

export async function reorderContentItems(
  updates: { id: number; display_order: number; workflow_status_id?: number }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Update each item's display_order (and optionally status)
  for (const update of updates) {
    const updateData: { display_order: number; workflow_status_id?: number } = {
      display_order: update.display_order,
    };

    // If status is changing, get current status for transition logging
    if (update.workflow_status_id !== undefined) {
      const { data: currentItem } = await supabase
        .from("cp_content")
        .select("workflow_status_id")
        .eq("id", update.id)
        .single();

      const fromStatusId = currentItem?.workflow_status_id;

      updateData.workflow_status_id = update.workflow_status_id;

      const { error } = await supabase
        .from("cp_content")
        .update(updateData)
        .eq("id", update.id);

      if (error) {
        console.error("Error reordering content item:", error);
        return { success: false, error: error.message };
      }

      // Log transition if status changed
      if (fromStatusId && fromStatusId !== update.workflow_status_id) {
        await supabase.from("cp_workflow_transitions").insert({
          content_id: update.id,
          from_status_id: fromStatusId,
          to_status_id: update.workflow_status_id,
          transitioned_by: user?.id,
        });
      }
    } else {
      const { error } = await supabase
        .from("cp_content")
        .update(updateData)
        .eq("id", update.id);

      if (error) {
        console.error("Error reordering content item:", error);
        return { success: false, error: error.message };
      }
    }
  }

  revalidatePath("/content");
  return { success: true };
}

// ============================================================================
// Attachment Actions
// ============================================================================

export async function getAttachmentUrl(
  storagePath: string
): Promise<{ url: string | null; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("content-attachments")
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) {
    console.error("Error getting attachment URL:", error);
    return { url: null, error: error.message };
  }

  return { url: data.signedUrl };
}

export async function uploadAttachment(
  contentId: number,
  formData: FormData
): Promise<{ success: boolean; error?: string; attachment?: ContentAttachment }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storagePath = `content/${contentId}/${timestamp}-${safeName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("content-attachments")
    .upload(storagePath, file);

  if (uploadError) {
    console.error("Error uploading attachment:", uploadError);
    return { success: false, error: uploadError.message };
  }

  // Create database record
  const { data, error: dbError } = await supabase
    .from("cp_content_attachments")
    .insert({
      content_id: contentId,
      storage_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id,
    })
    .select()
    .single();

  if (dbError) {
    // Cleanup uploaded file
    await supabase.storage.from("content-attachments").remove([storagePath]);
    console.error("Error creating attachment record:", dbError);
    return { success: false, error: dbError.message };
  }

  revalidatePath("/content");
  return { success: true, attachment: data };
}

export async function deleteAttachment(
  attachmentId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get the attachment to find storage path
  const { data: attachment, error: fetchError } = await supabase
    .from("cp_content_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single();

  if (fetchError || !attachment) {
    console.error("Error fetching attachment:", fetchError);
    return { success: false, error: fetchError?.message || "Attachment not found" };
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("content-attachments")
    .remove([attachment.storage_path]);

  if (storageError) {
    console.error("Error deleting from storage:", storageError);
    // Continue to delete DB record anyway
  }

  // Delete database record
  const { error: dbError } = await supabase
    .from("cp_content_attachments")
    .delete()
    .eq("id", attachmentId);

  if (dbError) {
    console.error("Error deleting attachment record:", dbError);
    return { success: false, error: dbError.message };
  }

  revalidatePath("/content");
  return { success: true };
}

// ============================================================================
// Content Link Actions
// ============================================================================

export async function addContentLink(
  contentId: number,
  link: ContentLinkInput
): Promise<{ success: boolean; error?: string; link?: ContentLink }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get max display order
  const { data: existingLinks } = await supabase
    .from("cp_content_links")
    .select("display_order")
    .eq("content_id", contentId)
    .order("display_order", { ascending: false })
    .limit(1);

  const nextOrder = (existingLinks?.[0]?.display_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("cp_content_links")
    .insert({
      content_id: contentId,
      url: link.url,
      name: link.name,
      description: link.description,
      link_type: link.link_type || "resource",
      display_order: link.display_order ?? nextOrder,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding content link:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true, link: data };
}

export async function updateContentLink(
  linkId: number,
  link: Partial<ContentLinkInput>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content_links")
    .update({
      ...(link.url !== undefined && { url: link.url }),
      ...(link.name !== undefined && { name: link.name }),
      ...(link.description !== undefined && { description: link.description }),
      ...(link.link_type !== undefined && { link_type: link.link_type }),
      ...(link.display_order !== undefined && { display_order: link.display_order }),
    })
    .eq("id", linkId);

  if (error) {
    console.error("Error updating content link:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true };
}

export async function deleteContentLink(
  linkId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content_links")
    .delete()
    .eq("id", linkId);

  if (error) {
    console.error("Error deleting content link:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true };
}

// ============================================================================
// Comment Actions
// ============================================================================

export async function getComments(
  contentId: number,
  search?: string
): Promise<Comment[]> {
  const supabase = await createClient();

  let query = supabase
    .from("cp_comments")
    .select(`
      id,
      commentable_type,
      commentable_id,
      body,
      body_html,
      parent_id,
      author_id,
      author_email,
      is_resolved,
      resolved_by,
      resolved_at,
      mentions,
      created_at,
      updated_at
    `)
    .eq("commentable_type", "content_item")
    .eq("commentable_id", contentId)
    .order("created_at", { ascending: true });

  if (search) {
    query = query.ilike("body", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  // Fetch attachments for all comments
  const commentIds = (data || []).map((c) => c.id);
  const { data: attachments } = await supabase
    .from("cp_comment_attachments")
    .select("*")
    .in("comment_id", commentIds);

  // Fetch user profiles for all comment authors
  const authorIds = [...new Set((data || []).map((c) => c.author_id))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url")
    .in("id", authorIds);

  // Create lookup map for profiles
  const profilesByUserId: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
  (profiles || []).forEach((p) => {
    profilesByUserId[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
  });

  // Group attachments by comment_id
  const attachmentsByComment: Record<number, typeof attachments> = {};
  (attachments || []).forEach((a) => {
    if (!attachmentsByComment[a.comment_id]) {
      attachmentsByComment[a.comment_id] = [];
    }
    attachmentsByComment[a.comment_id]!.push(a);
  });

  return (data || []).map((c) => ({
    ...c,
    mentions: c.mentions || [],
    attachments: attachmentsByComment[c.id] || [],
    author_display_name: profilesByUserId[c.author_id]?.display_name || null,
    author_avatar_url: profilesByUserId[c.author_id]?.avatar_url || null,
  })) as Comment[];
}

// Extract @mentions from comment body (matches @name or @email)
function extractMentions(text: string): string[] {
  const mentionRegex = /@([\w.+-]+@[\w.-]+\.\w+|[\w.-]+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return [];
  return matches.map((m) => m.slice(1).toLowerCase()); // Remove @ and lowercase
}

export async function addComment(
  contentId: number,
  body: string,
  attachmentFiles?: FormData
): Promise<{ success: boolean; error?: string; comment?: Comment }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Extract and resolve @mentions
  const mentionTexts = extractMentions(body);
  let mentionedUserIds: string[] = [];

  if (mentionTexts.length > 0) {
    // Look up users by email or display_name
    const { data: users } = await supabase
      .from("registered_users")
      .select("id, email, display_name");

    if (users) {
      mentionedUserIds = users
        .filter((u) => {
          const emailLower = u.email?.toLowerCase() || "";
          const nameLower = u.display_name?.toLowerCase().replace(/\s+/g, "") || "";
          return mentionTexts.some(
            (m) => emailLower === m || nameLower === m || emailLower.split("@")[0] === m
          );
        })
        .map((u) => u.id);
    }
  }

  // Create comment with mentions
  const { data, error } = await supabase
    .from("cp_comments")
    .insert({
      commentable_type: "content_item",
      commentable_id: contentId,
      body,
      author_id: user.id,
      author_email: user.email,
      mentions: mentionedUserIds,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating comment:", error);
    return { success: false, error: error.message };
  }

  // Handle attachments if provided
  const attachments: Array<{ id: number; comment_id: number; storage_path: string; file_name: string; file_size: number | null; mime_type: string | null; created_at: string }> = [];
  if (attachmentFiles) {
    const files = attachmentFiles.getAll("files") as File[];
    for (const file of files) {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `comments/${data.id}/${timestamp}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("content-attachments")
        .upload(storagePath, file);

      if (!uploadError) {
        const { data: attachmentData } = await supabase
          .from("cp_comment_attachments")
          .insert({
            comment_id: data.id,
            storage_path: storagePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          })
          .select()
          .single();

        if (attachmentData) {
          attachments.push(attachmentData);
        }
      }
    }
  }

  // Fetch user's profile for display name and avatar
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  // Trigger notifications (don't await to avoid blocking response)
  (async () => {
    try {
      const { data: contentItem } = await supabase
        .from("cp_content")
        .select("title")
        .eq("id", contentId)
        .single();

      if (contentItem) {
        // Notify assigned and mentioned users (consolidated to avoid duplicates)
        await notifyComment(
          contentId,
          contentItem.title,
          body,
          data.id,
          user.id,
          mentionedUserIds
        );
      }
    } catch (err) {
      console.error("Error triggering comment notification:", err);
    }
  })();

  revalidatePath("/content");
  return {
    success: true,
    comment: {
      ...data,
      mentions: data.mentions || [],
      attachments,
      author_email: user.email,
      author_display_name: profile?.display_name || null,
      author_avatar_url: profile?.avatar_url || null,
    } as Comment,
  };
}

export async function updateComment(
  commentId: number,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_comments")
    .update({ body })
    .eq("id", commentId);

  if (error) {
    console.error("Error updating comment:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true };
}

export async function deleteComment(
  commentId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get comment attachments for cleanup
  const { data: attachments } = await supabase
    .from("cp_comment_attachments")
    .select("storage_path")
    .eq("comment_id", commentId);

  // Delete from storage
  if (attachments && attachments.length > 0) {
    await supabase.storage
      .from("content-attachments")
      .remove(attachments.map((a) => a.storage_path));
  }

  // Delete comment (attachments cascade delete)
  const { error } = await supabase
    .from("cp_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Error deleting comment:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true };
}

// ============================================================================
// Assignment Actions
// ============================================================================

export async function getAssignments(
  contentId: number
): Promise<ContentAssignment[]> {
  const supabase = await createClient();

  const { data: assignments, error } = await supabase
    .from("cp_content_assignments")
    .select("id, content_id, user_id, role, assigned_at, notes")
    .eq("content_id", contentId);

  if (error) {
    console.error("Error fetching assignments:", error);
    return [];
  }

  // Get unique user IDs
  const userIds = [...new Set((assignments || []).map((a) => a.user_id))];
  const usersById: Record<string, User> = {};

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("registered_users")
      .select("id, email, display_name, avatar_url")
      .in("id", userIds);

    (users || []).forEach((u) => {
      usersById[u.id] = {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
      };
    });
  }

  return (assignments || []).map((a) => ({
    id: a.id,
    content_id: a.content_id,
    user_id: a.user_id,
    user: usersById[a.user_id] || { id: a.user_id, email: "", display_name: null, avatar_url: null },
    role: a.role as AssignmentRole,
    assigned_at: a.assigned_at,
    notes: a.notes,
  }));
}

export async function addAssignment(
  contentId: number,
  input: AssignmentInput
): Promise<{ success: boolean; error?: string; assignment?: ContentAssignment }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("cp_content_assignments")
    .insert({
      content_id: contentId,
      user_id: input.user_id,
      role: input.role,
      assigned_by: user?.id,
      notes: input.notes,
    })
    .select("id, content_id, user_id, role, assigned_at, notes")
    .single();

  if (error) {
    console.error("Error adding assignment:", error);
    return { success: false, error: error.message };
  }

  // Fetch user data
  const { data: userData } = await supabase
    .from("registered_users")
    .select("id, email, display_name, avatar_url")
    .eq("id", input.user_id)
    .single();

  // Trigger notification for the assigned user (don't await to avoid blocking response)
  if (user && input.user_id !== user.id) {
    (async () => {
      try {
        const { data: contentItem } = await supabase
          .from("cp_content")
          .select("title")
          .eq("id", contentId)
          .single();

        if (contentItem) {
          await notifyAssignment(
            input.user_id,
            contentId,
            contentItem.title,
            input.role,
            user.id
          );
        }
      } catch (err) {
        console.error("Error triggering assignment notification:", err);
      }
    })();
  }

  revalidatePath("/content");
  return {
    success: true,
    assignment: {
      id: data.id,
      content_id: data.content_id,
      user_id: data.user_id,
      user: userData || { id: input.user_id, email: "", display_name: null, avatar_url: null },
      role: data.role as AssignmentRole,
      assigned_at: data.assigned_at,
      notes: data.notes,
    },
  };
}

export async function removeAssignment(
  assignmentId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    console.error("Error removing assignment:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/content");
  return { success: true };
}

export async function updateAssignments(
  contentId: number,
  assignments: AssignmentInput[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Delete all existing assignments for this content item
  const { error: deleteError } = await supabase
    .from("cp_content_assignments")
    .delete()
    .eq("content_id", contentId);

  if (deleteError) {
    console.error("Error clearing assignments:", deleteError);
    return { success: false, error: deleteError.message };
  }

  // Insert new assignments
  if (assignments.length > 0) {
    const { error: insertError } = await supabase
      .from("cp_content_assignments")
      .insert(
        assignments.map((a) => ({
          content_id: contentId,
          user_id: a.user_id,
          role: a.role,
          assigned_by: user?.id,
          notes: a.notes,
        }))
      );

    if (insertError) {
      console.error("Error adding assignments:", insertError);
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/content");
  return { success: true };
}
