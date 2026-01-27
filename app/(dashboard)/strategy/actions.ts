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
      .select("id, slug, name, icon")
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
// Ideas
// ============================================================================

export async function getIdeas(): Promise<ContentIdea[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_content_ideas")
    .select(`
      id,
      title,
      description,
      source,
      potential_keywords,
      target_audience,
      estimated_effort,
      priority,
      status,
      vote_count,
      votes,
      rejection_reason,
      notes,
      created_at,
      updated_at,
      content_type:cp_content_types(id, slug, name, icon),
      campaign:cp_campaigns(id, name, color)
    `)
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching ideas:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((idea: any) => ({
    ...idea,
    potential_keywords: idea.potential_keywords || [],
    votes: idea.votes || [],
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
    .from("cp_content_ideas")
    .insert({
      title: input.title,
      description: input.description,
      source: input.source,
      potential_keywords: input.potential_keywords || [],
      target_audience: input.target_audience,
      estimated_effort: input.estimated_effort,
      priority: input.priority || "medium",
      status: input.status || "submitted",
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
    .from("cp_content_ideas")
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
      ...(input.status !== undefined && { status: input.status }),
      ...(input.content_type_id !== undefined && {
        content_type_id: input.content_type_id,
      }),
      ...(input.campaign_id !== undefined && { campaign_id: input.campaign_id }),
      ...(input.notes !== undefined && { notes: input.notes }),
    })
    .eq("id", id);

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

  const { error } = await supabase.from("cp_content_ideas").delete().eq("id", id);

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
    .from("cp_content_ideas")
    .select("votes, vote_count")
    .eq("id", ideaId)
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
    .from("cp_content_ideas")
    .update({
      votes: newVotes,
      vote_count: (idea.vote_count || 0) + voteDelta,
    })
    .eq("id", ideaId);

  if (error) {
    console.error("Error voting on idea:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

// ============================================================================
// Briefs
// ============================================================================

export async function getBriefs(): Promise<ContentBrief[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_content_briefs")
    .select(`
      id,
      title,
      slug,
      summary,
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
      status,
      competitor_examples,
      notes,
      created_at,
      updated_at,
      content_type:cp_content_types(id, slug, name, icon),
      campaign:cp_campaigns(id, name, color),
      idea:cp_content_ideas(id, title)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching briefs:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((brief: any) => ({
    ...brief,
    secondary_keywords: brief.secondary_keywords || [],
    outline: brief.outline || [],
    required_sections: brief.required_sections || [],
    internal_links: brief.internal_links || [],
    external_references: brief.external_references || [],
    competitor_examples: brief.competitor_examples || [],
    content_type: brief.content_type || null,
    campaign: brief.campaign || null,
    idea: brief.idea || null,
  })) as ContentBrief[];
}

export async function getBrief(id: number): Promise<ContentBrief | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cp_content_briefs")
    .select(`
      id,
      title,
      slug,
      summary,
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
      status,
      competitor_examples,
      notes,
      created_at,
      updated_at,
      content_type:cp_content_types(id, slug, name, icon),
      campaign:cp_campaigns(id, name, color),
      idea:cp_content_ideas(id, title)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching brief:", error);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brief = data as any;
  return {
    ...brief,
    secondary_keywords: brief.secondary_keywords || [],
    outline: brief.outline || [],
    required_sections: brief.required_sections || [],
    internal_links: brief.internal_links || [],
    external_references: brief.external_references || [],
    competitor_examples: brief.competitor_examples || [],
    content_type: brief.content_type || null,
    campaign: brief.campaign || null,
    idea: brief.idea || null,
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
    .from("cp_content_briefs")
    .insert({
      title: input.title,
      slug,
      summary: input.summary,
      target_audience: input.target_audience,
      content_goals: input.content_goals,
      tone_and_style: input.tone_and_style,
      primary_keyword: input.primary_keyword,
      secondary_keywords: input.secondary_keywords || [],
      search_intent: input.search_intent,
      target_word_count: input.target_word_count,
      outline: input.outline || [],
      required_sections: input.required_sections || [],
      status: input.status || "draft",
      content_type_id: input.content_type_id,
      campaign_id: input.campaign_id,
      idea_id: input.idea_id,
      notes: input.notes,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating brief:", error);
    return { success: false, error: error.message };
  }

  // If creating from an idea, mark the idea as converted
  if (input.idea_id) {
    await supabase
      .from("cp_content_ideas")
      .update({ status: "converted" })
      .eq("id", input.idea_id);
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
    .from("cp_content_briefs")
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.summary !== undefined && { summary: input.summary }),
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
      ...(input.status !== undefined && { status: input.status }),
      ...(input.content_type_id !== undefined && {
        content_type_id: input.content_type_id,
      }),
      ...(input.campaign_id !== undefined && { campaign_id: input.campaign_id }),
      ...(input.notes !== undefined && { notes: input.notes }),
    })
    .eq("id", id);

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

  const { error } = await supabase.from("cp_content_briefs").delete().eq("id", id);

  if (error) {
    console.error("Error deleting brief:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/strategy");
  return { success: true };
}

// ============================================================================
// Convert Idea to Brief
// ============================================================================

export async function convertIdeaToBrief(
  ideaId: number
): Promise<{ success: boolean; error?: string; briefId?: number }> {
  const supabase = await createClient();

  // Get the idea
  const { data: idea, error: fetchError } = await supabase
    .from("cp_content_ideas")
    .select("*")
    .eq("id", ideaId)
    .single();

  if (fetchError || !idea) {
    return { success: false, error: "Idea not found" };
  }

  // Create a brief from the idea
  const result = await createBrief({
    title: idea.title,
    summary: idea.description,
    target_audience: idea.target_audience,
    secondary_keywords: idea.potential_keywords || [],
    content_type_id: idea.content_type_id,
    campaign_id: idea.campaign_id,
    idea_id: ideaId,
    notes: idea.notes,
  });

  return {
    success: result.success,
    error: result.error,
    briefId: result.id,
  };
}
