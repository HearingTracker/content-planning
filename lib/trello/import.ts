/**
 * Trello import functionality
 * Imports cards from Trello Publishing board into the content planning system
 */

import { createAdminClient } from "../supabase/admin";
import {
  getPublishingBoardData,
  TrelloCard,
} from "./client";
import {
  mapCard,
  MappedContent,
  TRELLO_LIST_MAPPING,
  TRELLO_USERNAME_TO_EMAIL,
} from "./parser";

// Lookup tables loaded from database
interface LookupTables {
  contentTypes: Map<string, number>; // slug -> id
  workflowStatuses: Map<string, number>; // slug -> id
  usersByEmail: Map<string, string>; // email -> user UUID
}

// Import result for a single card
export interface CardImportResult {
  trelloCardId: string;
  trelloCardName: string;
  stage: "idea" | "brief" | "content";
  success: boolean;
  entityId?: number;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// Overall import result
export interface ImportResult {
  success: boolean;
  totalCards: number;
  imported: number;
  skipped: number;
  errors: number;
  results: CardImportResult[];
}

// Import options
export interface ImportOptions {
  dryRun?: boolean; // If true, don't actually insert, just show what would happen
  skipExisting?: boolean; // If true, skip cards already imported (by trello_card_id in metadata)
  listFilter?: string[]; // Only import from these list IDs
}

/**
 * Load lookup tables from database
 */
async function loadLookupTables(): Promise<LookupTables> {
  const supabase = createAdminClient();

  // Load content types
  const { data: contentTypes } = await supabase
    .from("cp_content_types")
    .select("id, slug")
    .eq("is_active", true);

  const contentTypeMap = new Map<string, number>();
  for (const ct of contentTypes ?? []) {
    contentTypeMap.set(ct.slug, ct.id);
  }

  // Load workflow statuses
  const { data: workflowStatuses } = await supabase
    .from("cp_workflow_statuses")
    .select("id, slug");

  const workflowStatusMap = new Map<string, number>();
  for (const ws of workflowStatuses ?? []) {
    workflowStatusMap.set(ws.slug, ws.id);
  }

  // Load users by email (query auth.users directly to include all users)
  const { data: authUsers } = await supabase.rpc("get_auth_users");

  const usersByEmail = new Map<string, string>();
  for (const user of authUsers ?? []) {
    if (user.email) {
      usersByEmail.set(user.email.toLowerCase(), user.id);
    }
  }

  return {
    contentTypes: contentTypeMap,
    workflowStatuses: workflowStatusMap,
    usersByEmail,
  };
}

/**
 * Check if a card has already been imported (checks unified cp_content table)
 */
async function isCardImported(
  supabase: ReturnType<typeof createAdminClient>,
  trelloCardId: string
): Promise<{ imported: boolean; id?: number; stage?: string }> {
  const { data } = await supabase
    .from("cp_content")
    .select("id, stage")
    .contains("metadata", { trello_card_id: trelloCardId })
    .limit(1)
    .maybeSingle();

  if (data) {
    return { imported: true, id: data.id, stage: data.stage };
  }

  return { imported: false };
}

/**
 * Import a single content item (unified for all stages)
 */
async function importContent(
  supabase: ReturnType<typeof createAdminClient>,
  data: MappedContent,
  lookups: LookupTables,
  dryRun: boolean
): Promise<{ id?: number; error?: string }> {
  const contentTypeId = data.content_type_slug
    ? lookups.contentTypes.get(data.content_type_slug)
    : undefined;

  const workflowStatusId = data.workflow_status_slug
    ? lookups.workflowStatuses.get(data.workflow_status_slug)
    : lookups.workflowStatuses.get("draft");

  // Build record based on stage
  const record: Record<string, unknown> = {
    title: data.title,
    stage: data.stage,
    content_type_id: contentTypeId,
    priority: data.priority ?? "medium",
    notes: data.notes,
    metadata: data.metadata ?? {},
  };

  // Add stage-specific status
  if (data.stage === "idea") {
    record.idea_status = data.idea_status || "submitted";
    record.description = data.description;
    record.source = data.source;
    record.potential_keywords = data.potential_keywords?.map(k => k.keyword) ?? [];
    record.target_audience = data.target_audience;
    record.estimated_effort = data.estimated_effort;
  } else if (data.stage === "brief") {
    record.brief_status = data.brief_status || "draft";
    record.slug = data.slug;
    record.description = data.description;
    record.primary_keyword = data.primary_keyword;
    record.secondary_keywords = data.secondary_keywords ?? [];
    record.target_audience = data.target_audience;
    record.content_goals = data.content_goals;
    record.tone_and_style = data.tone_and_style;
    record.outline = data.outline ? [{ heading: "Outline", notes: data.outline }] : [];
    record.internal_links = data.internal_links ?? [];
    record.external_references = data.external_references ?? [];
  } else if (data.stage === "content") {
    record.workflow_status_id = workflowStatusId;
    record.slug = data.slug;
    record.body = data.body ?? {};
    record.storyblok_url = data.storyblok_url;
    record.due_date = data.due_date;
    record.primary_keyword = data.primary_keyword;
    record.secondary_keywords = data.secondary_keywords ?? [];
    record.internal_links = data.internal_links ?? [];
    record.external_references = data.external_references ?? [];
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would insert ${data.stage}:`, record);
    if (data.links && data.links.length > 0) {
      console.log("[DRY RUN] Would create links:", data.links);
    }
    return { id: -1 };
  }

  const { data: inserted, error } = await supabase
    .from("cp_content")
    .insert(record)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Create content links (only for content stage)
  if (data.links && data.links.length > 0 && inserted?.id) {
    const linksToInsert = data.links.map((link, index) => ({
      content_id: inserted.id,
      url: link.url,
      name: link.name,
      link_type: link.link_type,
      display_order: index,
    }));

    const { error: linksError } = await supabase
      .from("cp_content_links")
      .insert(linksToInsert);

    if (linksError) {
      console.warn(`Warning: Failed to create links for content ${inserted.id}:`, linksError.message);
    }
  }

  // Create author assignments from Trello members (only for content stage)
  if (data.memberUsernames && data.memberUsernames.length > 0 && inserted?.id) {
    const assignmentsToInsert: Array<{
      content_id: number;
      user_id: string;
      role: string;
    }> = [];

    for (const username of data.memberUsernames) {
      const email = TRELLO_USERNAME_TO_EMAIL[username];
      if (email) {
        const userId = lookups.usersByEmail.get(email.toLowerCase());
        if (userId) {
          assignmentsToInsert.push({
            content_id: inserted.id,
            user_id: userId,
            role: "author",
          });
        } else {
          console.warn(`Warning: No user found for email ${email} (Trello: ${username})`);
        }
      } else {
        console.warn(`Warning: No email mapping for Trello username: ${username}`);
      }
    }

    if (assignmentsToInsert.length > 0) {
      const { error: assignError } = await supabase
        .from("cp_content_assignments")
        .insert(assignmentsToInsert);

      if (assignError) {
        console.warn(`Warning: Failed to create assignments for content ${inserted.id}:`, assignError.message);
      }
    }
  }

  return { id: inserted.id };
}

/**
 * Import a single card
 */
async function importCard(
  supabase: ReturnType<typeof createAdminClient>,
  card: TrelloCard,
  lookups: LookupTables,
  options: ImportOptions
): Promise<CardImportResult> {
  const result: CardImportResult = {
    trelloCardId: card.id,
    trelloCardName: card.name,
    stage: "content",
    success: false,
  };

  // Check if list is mapped
  const listMapping = TRELLO_LIST_MAPPING[card.idList];
  if (!listMapping) {
    result.skipped = true;
    result.skipReason = "List not mapped";
    return result;
  }

  result.stage = listMapping.stage;

  // Check if already imported
  if (options.skipExisting) {
    const existing = await isCardImported(supabase, card.id);
    if (existing.imported) {
      result.skipped = true;
      result.skipReason = `Already imported as ${existing.stage} #${existing.id}`;
      result.entityId = existing.id;
      return result;
    }
  }

  // Map and import
  const mapped = mapCard(card);

  try {
    const importResult = await importContent(
      supabase,
      mapped,
      lookups,
      options.dryRun ?? false
    );

    if (importResult.error) {
      result.error = importResult.error;
    } else {
      result.success = true;
      result.entityId = importResult.id;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

/**
 * Main import function - imports all cards from Trello Publishing board
 */
export async function importFromTrello(
  options: ImportOptions = {}
): Promise<ImportResult> {
  const supabase = createAdminClient();

  console.log("Fetching Trello data...");
  const { cards, members } = await getPublishingBoardData();

  console.log(`Found ${cards.length} cards, loading lookup tables...`);
  const lookups = await loadLookupTables();

  console.log(
    `Loaded ${lookups.contentTypes.size} content types, ${lookups.workflowStatuses.size} workflow statuses, ${lookups.usersByEmail.size} users`
  );

  const results: CardImportResult[] = [];
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Filter cards
  let filteredCards = cards.filter((c) => !c.closed);
  if (options.listFilter && options.listFilter.length > 0) {
    filteredCards = filteredCards.filter((c) =>
      options.listFilter!.includes(c.idList)
    );
  }

  console.log(`Processing ${filteredCards.length} cards...`);

  for (const card of filteredCards) {
    const result = await importCard(supabase, card, lookups, options);
    results.push(result);

    if (result.skipped) {
      skipped++;
      if (!options.dryRun) {
        console.log(`  SKIP: ${card.name} - ${result.skipReason}`);
      }
    } else if (result.success) {
      imported++;
      console.log(
        `  OK: ${card.name} -> ${result.stage} #${result.entityId}`
      );
    } else {
      errors++;
      console.error(`  ERROR: ${card.name} - ${result.error}`);
    }
  }

  return {
    success: errors === 0,
    totalCards: filteredCards.length,
    imported,
    skipped,
    errors,
    results,
  };
}

/**
 * Get import preview without actually importing
 */
export async function previewImport(
  options: Omit<ImportOptions, "dryRun"> = {}
): Promise<ImportResult> {
  return importFromTrello({ ...options, dryRun: true });
}
