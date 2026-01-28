"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  CampaignSummary,
  CampaignInput,
  ContentIdea,
  ContentIdeaInput,
  ContentBrief,
  ContentBriefInput,
  StrategyFilterOptions,
} from "./components/types";

// ============================================================================
// Filter Options
// ============================================================================

export async function getStrategyFilterOptions(): Promise<StrategyFilterOptions> {
  const supabase = await createClient();

  const [typesRes, campaignsRes] = await Promise.all([
    supabase
      .from("cp_content_types")
      .select("id, slug, name, description, icon, is_active")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("cp_campaigns")
      .select("id, name, color")
      .in("status", ["planning", "active"])
      .order("name"),
  ]);

  return {
    contentTypes: typesRes.data || [],
    campaigns: campaignsRes.data || [],
  };
}

// ============================================================================
// Campaigns
// ============================================================================

export async function getCampaigns(): Promise<CampaignSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_campaign_summary")
    .select("*")
    .order("start_date", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Error fetching campaigns:", error);
    return [];
  }

  return data || [];
}

export async function createCampaign(
  input: CampaignInput
): Promise<{ success: boolean; error?: string; id?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, "-");

  const { data, error } = await supabase
    .from("cp_campaigns")
    .insert({
      name: input.name,
      slug,
      description: input.description,
      goals: input.goals,
      start_date: input.start_date,
      end_date: input.end_date,
      status: input.status || "planning",
      color: input.color || "#6366F1",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true, id: data.id };
}

export async function updateCampaign(
  id: number,
  input: Partial<CampaignInput>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_campaigns")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.goals !== undefined && { goals: input.goals }),
      ...(input.start_date !== undefined && { start_date: input.start_date }),
      ...(input.end_date !== undefined && { end_date: input.end_date }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.color !== undefined && { color: input.color }),
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating campaign:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

export async function deleteCampaign(
  id: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("cp_campaigns").delete().eq("id", id);

  if (error) {
    console.error("Error deleting campaign:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

// Generate a random color for new campaigns
function generateCampaignColor(): string {
  const colors = [
    "#6366F1", // indigo
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#EF4444", // red
    "#F97316", // orange
    "#EAB308", // yellow
    "#22C55E", // green
    "#14B8A6", // teal
    "#06B6D4", // cyan
    "#3B82F6", // blue
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Quick create a campaign with just a name (for inline creation in dropdowns)
 */
export async function quickCreateCampaign(
  name: string
): Promise<{ success: boolean; id?: number; color?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const color = generateCampaignColor();

  const { data, error } = await supabase
    .from("cp_campaigns")
    .insert({
      name,
      slug,
      status: "planning",
      color,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true, id: data.id, color };
}

// ============================================================================
// Ideas (now from cp_content with stage='idea')
// ============================================================================

export async function getIdeas(): Promise<ContentIdea[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_content")
    .select(`
      id,
      title,
      description,
      source,
      potential_keywords,
      target_audience,
      estimated_effort,
      priority,
      idea_status,
      vote_count,
      votes,
      rejection_reason,
      notes,
      created_at,
      updated_at,
      content_type:cp_content_types(id, slug, name, icon),
      campaign:cp_campaigns(id, name, color)
    `)
    .eq("stage", "idea")
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching ideas:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((idea: any) => ({
    id: idea.id,
    title: idea.title,
    description: idea.description,
    source: idea.source,
    potential_keywords: idea.potential_keywords || [],
    target_audience: idea.target_audience,
    estimated_effort: idea.estimated_effort,
    priority: idea.priority || "medium",
    status: idea.idea_status || "submitted",
    vote_count: idea.vote_count || 0,
    votes: idea.votes || [],
    rejection_reason: idea.rejection_reason,
    notes: idea.notes,
    created_at: idea.created_at,
    updated_at: idea.updated_at,
    content_type: idea.content_type || null,
    campaign: idea.campaign || null,
  })) as ContentIdea[];
}

export async function createIdea(
  input: ContentIdeaInput
): Promise<{ success: boolean; error?: string; id?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("cp_content")
    .insert({
      title: input.title,
      description: input.description,
      stage: "idea",
      idea_status: input.status || "submitted",
      source: input.source,
      potential_keywords: input.potential_keywords || [],
      target_audience: input.target_audience,
      estimated_effort: input.estimated_effort,
      priority: input.priority || "medium",
      content_type_id: input.content_type_id,
      campaign_id: input.campaign_id,
      notes: input.notes,
      submitted_by: user?.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating idea:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true, id: data.id };
}

export async function updateIdea(
  id: number,
  input: Partial<ContentIdeaInput>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content")
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.source !== undefined && { source: input.source }),
      ...(input.potential_keywords !== undefined && {
        potential_keywords: input.potential_keywords,
      }),
      ...(input.target_audience !== undefined && {
        target_audience: input.target_audience,
      }),
      ...(input.estimated_effort !== undefined && {
        estimated_effort: input.estimated_effort,
      }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.status !== undefined && { idea_status: input.status }),
      ...(input.content_type_id !== undefined && {
        content_type_id: input.content_type_id,
      }),
      ...(input.campaign_id !== undefined && { campaign_id: input.campaign_id }),
      ...(input.notes !== undefined && { notes: input.notes }),
    })
    .eq("id", id)
    .eq("stage", "idea");

  if (error) {
    console.error("Error updating idea:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

export async function deleteIdea(
  id: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content")
    .delete()
    .eq("id", id)
    .eq("stage", "idea");

  if (error) {
    console.error("Error deleting idea:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

export async function voteOnIdea(
  ideaId: number,
  vote: 1 | -1
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get current idea
  const { data: idea, error: fetchError } = await supabase
    .from("cp_content")
    .select("votes, vote_count")
    .eq("id", ideaId)
    .eq("stage", "idea")
    .single();

  if (fetchError || !idea) {
    return { success: false, error: "Idea not found" };
  }

  const currentVotes = (idea.votes || []) as { user_id: string; vote: number; timestamp: string }[];
  const existingVoteIndex = currentVotes.findIndex((v) => v.user_id === user.id);

  let newVotes = [...currentVotes];
  let voteDelta: number = vote;

  if (existingVoteIndex >= 0) {
    const existingVote = currentVotes[existingVoteIndex].vote;
    if (existingVote === vote) {
      // Remove vote (toggle off)
      newVotes.splice(existingVoteIndex, 1);
      voteDelta = -vote;
    } else {
      // Change vote
      newVotes[existingVoteIndex] = {
        user_id: user.id,
        vote,
        timestamp: new Date().toISOString(),
      };
      voteDelta = vote * 2; // Going from -1 to +1 or vice versa
    }
  } else {
    // Add new vote
    newVotes.push({
      user_id: user.id,
      vote,
      timestamp: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from("cp_content")
    .update({
      votes: newVotes,
      vote_count: (idea.vote_count || 0) + voteDelta,
    })
    .eq("id", ideaId)
    .eq("stage", "idea");

  if (error) {
    console.error("Error voting on idea:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

// ============================================================================
// Briefs (now from cp_content with stage='brief')
// ============================================================================

export async function getBriefs(): Promise<ContentBrief[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_content")
    .select(`
      id,
      title,
      slug,
      description,
      source,
      target_audience,
      content_goals,
      tone_and_style,
      primary_keyword,
      secondary_keywords,
      search_intent,
      target_word_count,
      outline,
      required_sections,
      internal_links,
      external_references,
      brief_status,
      competitor_examples,
      notes,
      created_at,
      updated_at,
      content_type:cp_content_types(id, slug, name, icon),
      campaign:cp_campaigns(id, name, color)
    `)
    .eq("stage", "brief")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching briefs:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((brief: any) => ({
    id: brief.id,
    title: brief.title,
    slug: brief.slug,
    summary: brief.description, // description maps to summary for briefs
    source: brief.source,
    target_audience: brief.target_audience,
    content_goals: brief.content_goals,
    tone_and_style: brief.tone_and_style,
    primary_keyword: brief.primary_keyword,
    secondary_keywords: brief.secondary_keywords || [],
    search_intent: brief.search_intent,
    target_word_count: brief.target_word_count,
    outline: brief.outline || [],
    required_sections: brief.required_sections || [],
    internal_links: brief.internal_links || [],
    external_references: brief.external_references || [],
    status: brief.brief_status || "draft",
    competitor_examples: brief.competitor_examples || [],
    notes: brief.notes,
    created_at: brief.created_at,
    updated_at: brief.updated_at,
    content_type: brief.content_type || null,
    campaign: brief.campaign || null,
    idea: null, // No longer separate entity reference
  })) as ContentBrief[];
}

export async function getBrief(id: number): Promise<ContentBrief | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_content")
    .select(`
      id,
      title,
      slug,
      description,
      source,
      target_audience,
      content_goals,
      tone_and_style,
      primary_keyword,
      secondary_keywords,
      search_intent,
      target_word_count,
      outline,
      required_sections,
      internal_links,
      external_references,
      brief_status,
      competitor_examples,
      notes,
      created_at,
      updated_at,
      content_type:cp_content_types(id, slug, name, icon),
      campaign:cp_campaigns(id, name, color)
    `)
    .eq("id", id)
    .eq("stage", "brief")
    .single();

  if (error || !data) {
    console.error("Error fetching brief:", error);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brief = data as any;
  return {
    id: brief.id,
    title: brief.title,
    slug: brief.slug,
    summary: brief.description,
    source: brief.source,
    target_audience: brief.target_audience,
    content_goals: brief.content_goals,
    tone_and_style: brief.tone_and_style,
    primary_keyword: brief.primary_keyword,
    secondary_keywords: brief.secondary_keywords || [],
    search_intent: brief.search_intent,
    target_word_count: brief.target_word_count,
    outline: brief.outline || [],
    required_sections: brief.required_sections || [],
    internal_links: brief.internal_links || [],
    external_references: brief.external_references || [],
    status: brief.brief_status || "draft",
    competitor_examples: brief.competitor_examples || [],
    notes: brief.notes,
    created_at: brief.created_at,
    updated_at: brief.updated_at,
    content_type: brief.content_type || null,
    campaign: brief.campaign || null,
    idea: null,
  } as ContentBrief;
}

export async function createBrief(
  input: ContentBriefInput
): Promise<{ success: boolean; error?: string; id?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slug = input.slug || input.title.toLowerCase().replace(/\s+/g, "-");

  const { data, error } = await supabase
    .from("cp_content")
    .insert({
      title: input.title,
      slug,
      description: input.summary, // summary maps to description
      stage: "brief",
      brief_status: input.status || "draft",
      target_audience: input.target_audience,
      content_goals: input.content_goals,
      tone_and_style: input.tone_and_style,
      primary_keyword: input.primary_keyword,
      secondary_keywords: input.secondary_keywords || [],
      search_intent: input.search_intent,
      target_word_count: input.target_word_count,
      outline: input.outline || [],
      required_sections: input.required_sections || [],
      content_type_id: input.content_type_id,
      campaign_id: input.campaign_id,
      notes: input.notes,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating brief:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true, id: data.id };
}

export async function updateBrief(
  id: number,
  input: Partial<ContentBriefInput>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content")
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.summary !== undefined && { description: input.summary }),
      ...(input.source !== undefined && { source: input.source }),
      ...(input.target_audience !== undefined && {
        target_audience: input.target_audience,
      }),
      ...(input.content_goals !== undefined && {
        content_goals: input.content_goals,
      }),
      ...(input.tone_and_style !== undefined && {
        tone_and_style: input.tone_and_style,
      }),
      ...(input.primary_keyword !== undefined && {
        primary_keyword: input.primary_keyword,
      }),
      ...(input.secondary_keywords !== undefined && {
        secondary_keywords: input.secondary_keywords,
      }),
      ...(input.search_intent !== undefined && {
        search_intent: input.search_intent,
      }),
      ...(input.target_word_count !== undefined && {
        target_word_count: input.target_word_count,
      }),
      ...(input.outline !== undefined && { outline: input.outline }),
      ...(input.required_sections !== undefined && {
        required_sections: input.required_sections,
      }),
      ...(input.status !== undefined && { brief_status: input.status }),
      ...(input.content_type_id !== undefined && {
        content_type_id: input.content_type_id,
      }),
      ...(input.campaign_id !== undefined && { campaign_id: input.campaign_id }),
      ...(input.notes !== undefined && { notes: input.notes }),
    })
    .eq("id", id)
    .eq("stage", "brief");

  if (error) {
    console.error("Error updating brief:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

export async function deleteBrief(
  id: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cp_content")
    .delete()
    .eq("id", id)
    .eq("stage", "brief");

  if (error) {
    console.error("Error deleting brief:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

// ============================================================================
// Promote Content (replaces convertIdeaToBrief)
// ============================================================================

/**
 * Promote content from one stage to the next
 * idea -> brief: Sets brief_status to 'draft', idea_status to 'converted'
 * brief -> content: Sets workflow_status to initial status, brief_status to 'completed'
 */
export async function promoteContent(
  id: number,
  toStage: "brief" | "content"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get current content
  const { data: content, error: fetchError } = await supabase
    .from("cp_content")
    .select("stage, title")
    .eq("id", id)
    .single();

  if (fetchError || !content) {
    return { success: false, error: "Content not found" };
  }

  // Validate stage transition
  if (toStage === "brief" && content.stage !== "idea") {
    return { success: false, error: "Can only promote ideas to briefs" };
  }
  if (toStage === "content" && content.stage !== "brief") {
    return { success: false, error: "Can only promote briefs to content" };
  }

  // Build update based on target stage
  const updateData: Record<string, unknown> = {
    stage: toStage,
  };

  if (toStage === "brief") {
    // Idea -> Brief: fetch full record to copy keywords
    const { data: fullContent } = await supabase
      .from("cp_content")
      .select("potential_keywords, source")
      .eq("id", id)
      .single();

    updateData.idea_status = "converted";
    updateData.brief_status = "draft";

    // Generate slug if not present
    const slug = content.title.toLowerCase().replace(/\s+/g, "-");
    updateData.slug = slug;

    // Copy potential_keywords to secondary_keywords
    if (fullContent?.potential_keywords && Array.isArray(fullContent.potential_keywords)) {
      // Handle both formats: plain strings or objects with keyword property
      updateData.secondary_keywords = fullContent.potential_keywords.map((k: unknown) => {
        if (typeof k === "string") return k;
        if (k && typeof k === "object" && "keyword" in k) return (k as { keyword: string }).keyword;
        return null;
      }).filter(Boolean);
    }
  } else if (toStage === "content") {
    // Brief -> Content
    updateData.brief_status = "completed";

    // Get default workflow status
    const { data: defaultStatus } = await supabase
      .from("cp_workflow_statuses")
      .select("id")
      .eq("is_initial", true)
      .single();

    if (defaultStatus) {
      updateData.workflow_status_id = defaultStatus.id;
    }
  }

  const { error } = await supabase
    .from("cp_content")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Error promoting content:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  revalidatePath("/content");
  return { success: true };
}

// Legacy function - now just calls promoteContent
export async function convertIdeaToBrief(
  ideaId: number
): Promise<{ success: boolean; error?: string; briefId?: number }> {
  const result = await promoteContent(ideaId, "brief");
  return {
    success: result.success,
    error: result.error,
    briefId: result.success ? ideaId : undefined, // Same ID since it's the same record
  };
}
