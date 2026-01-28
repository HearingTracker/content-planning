/**
 * Test script to verify Trello parser with real data
 *
 * Run with: source .env.local && npx tsx scripts/test-trello-parser.ts
 */

import {
  getPublishingBoardData,
  mapCard,
  parseDescription,
  TRELLO_LIST_MAPPING,
} from "../lib/trello";

async function main() {
  console.log("Fetching Trello Publishing board data...\n");

  const { lists, cards, labels, members } = await getPublishingBoardData();

  console.log(`Found ${lists.length} lists, ${cards.length} cards\n`);

  // Show list mapping
  console.log("=== LIST MAPPING ===\n");
  for (const list of lists) {
    const mapping = TRELLO_LIST_MAPPING[list.id];
    console.log(
      `${list.name} (${list.id}) -> ${mapping?.stage ?? "unmapped"}${mapping?.status ? ` [${mapping.status}]` : ""}`
    );
  }

  // Group cards by target stage
  const ideas: ReturnType<typeof mapCard>[] = [];
  const briefs: ReturnType<typeof mapCard>[] = [];
  const contentItems: ReturnType<typeof mapCard>[] = [];

  for (const card of cards) {
    if (card.closed) continue; // Skip archived cards

    const mapped = mapCard(card);
    switch (mapped.stage) {
      case "idea":
        ideas.push(mapped);
        break;
      case "brief":
        briefs.push(mapped);
        break;
      case "content":
        contentItems.push(mapped);
        break;
    }
  }

  console.log(`\n=== SUMMARY ===\n`);
  console.log(`Ideas: ${ideas.length}`);
  console.log(`Briefs: ${briefs.length}`);
  console.log(`Content Items: ${contentItems.length}`);

  // Show sample of each type
  console.log(`\n=== SAMPLE IDEAS ===\n`);
  for (const item of ideas.slice(0, 3)) {
    console.log(JSON.stringify(item, null, 2));
    console.log("---");
  }

  console.log(`\n=== SAMPLE BRIEFS ===\n`);
  for (const item of briefs.slice(0, 3)) {
    console.log(JSON.stringify(item, null, 2));
    console.log("---");
  }

  console.log(`\n=== SAMPLE CONTENT ITEMS ===\n`);
  for (const item of contentItems.slice(0, 3)) {
    console.log(JSON.stringify(item, null, 2));
    console.log("---");
  }

  // Test parser on a complex description
  console.log(`\n=== PARSER TEST ===\n`);
  const complexDesc = `**SEO title:** How to Fix Battery Drain on Phonak Sphere Infinio Hearing Aids
**H1:** X Tips to Fix Excessive Battery Drain
**Slug:** fix-phonak-hearing-aids-battery-drain

**Primary keyword:** phonak battery drain (150)

**Secondary keywords:**
phonak rechargeable battery replacement cost (150)
phonak battery replacement (100)

**Forum resources:**
[https://forum.hearingtracker.com/t/phonak-sphere-i90-eccessive-battery-drain/109180](https://forum.hearingtracker.com/t/phonak-sphere-i90-eccessive-battery-drain/109180)

**Internal links:**
[https://www.hearingtracker.com/hearing-aids/phonak-audeo-infinio](https://www.hearingtracker.com/hearing-aids/phonak-audeo-infinio)

This is a common issue. Article should discuss the Ultra upgrade.`;

  const parsed = parseDescription(complexDesc);
  console.log("Parsed result:");
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch(console.error);
