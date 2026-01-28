/**
 * Clear all imported content data from the database.
 * Run with: npx tsx scripts/clear-content-data.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();

  console.log("Clearing existing content data...\n");

  // Delete in correct order for foreign keys
  const { error: assignmentsError } = await supabase.from("cp_content_assignments").delete().gte("id", 0);
  console.log(`Deleted content assignments${assignmentsError ? ` (error: ${assignmentsError.message})` : ""}`);

  const { error: linksError } = await supabase.from("cp_content_links").delete().gte("id", 0);
  console.log(`Deleted content links${linksError ? ` (error: ${linksError.message})` : ""}`);

  // Now using unified cp_content table instead of separate tables
  const { error: contentError } = await supabase.from("cp_content").delete().gte("id", 0);
  console.log(`Deleted content (ideas, briefs, and content items)${contentError ? ` (error: ${contentError.message})` : ""}`);

  console.log("\nData cleared. Run import-trello.ts to import fresh.");
}

main().catch(console.error);
