"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import type { SeoOppStatus, SeoPage, SeoOpportunity } from "./types";

async function requireEditor(): Promise<string> {
  const role = await getCurrentUserRole();
  if (role !== "admin" && role !== "editor") {
    throw new Error("editor or admin role required");
  }
  return role;
}

export async function getSeoPages(): Promise<SeoPage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cp_seo_pages_with_stats")
    .select("*")
    .order("earnings_90d", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SeoPage[];
}

export async function getSeoOpportunities(page: string): Promise<SeoOpportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cp_seo_opportunities")
    .select("*")
    .eq("page", page)
    .is("archived_at", null)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SeoOpportunity[];
}

export async function updateOpportunityStatus(id: number, status: SeoOppStatus): Promise<void> {
  await requireEditor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cp_seo_opportunities")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/seo");
}

export async function assignOpportunity(id: number, userId: string | null): Promise<void> {
  await requireEditor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cp_seo_opportunities")
    .update({ assigned_to: userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/seo");
}

export async function updateOpportunityNotes(id: number, notes: string | null): Promise<void> {
  await requireEditor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cp_seo_opportunities")
    .update({ notes })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/seo");
}

// Admin-only: runs the same sync as the cron, in-process, so authors don't
// have to wait until Monday during a content sprint.
export async function refreshNow(): Promise<{ pages: number; opportunities: number }> {
  const role = await getCurrentUserRole();
  if (role !== "admin") throw new Error("admin role required");
  const { syncSeoOpportunities } = await import("@/lib/seo/sync");
  const result = await syncSeoOpportunities();
  revalidatePath("/seo");
  return { pages: result.pages, opportunities: result.opportunities };
}
