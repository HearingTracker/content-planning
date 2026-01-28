/**
 * Import Trello cards into the content planning system
 *
 * Usage:
 *   # Preview what would be imported (dry run)
 *   npx tsx scripts/import-trello.ts --dry-run
 *
 *   # Import all cards, skipping existing
 *   npx tsx scripts/import-trello.ts
 *
 *   # Import all cards, including re-importing existing
 *   npx tsx scripts/import-trello.ts --force
 *
 * Environment variables (loaded from .env.local):
 *   TRELLO_API_KEY, TRELLO_API_TOKEN - Trello credentials
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - Supabase credentials
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { importFromTrello, previewImport } from "../lib/trello";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  console.log("=== Trello Import ===\n");
  console.log(`Mode: ${dryRun ? "DRY RUN (preview only)" : "LIVE IMPORT"}`);
  console.log(`Skip existing: ${force ? "NO (will re-import)" : "YES"}\n`);

  if (dryRun) {
    const result = await previewImport({ skipExisting: !force });
    console.log("\n=== Preview Summary ===");
    console.log(`Total cards: ${result.totalCards}`);
    console.log(`Would import: ${result.imported}`);
    console.log(`Would skip: ${result.skipped}`);
    console.log(`Errors: ${result.errors}`);

    if (result.imported > 0) {
      console.log("\nRun without --dry-run to perform the import.");
    }
  } else {
    const result = await importFromTrello({ skipExisting: !force });
    console.log("\n=== Import Summary ===");
    console.log(`Total cards: ${result.totalCards}`);
    console.log(`Imported: ${result.imported}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Errors: ${result.errors}`);

    if (!result.success) {
      console.log("\nSome cards failed to import. Check errors above.");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
