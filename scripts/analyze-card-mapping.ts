/**
 * Analyze a single Trello card and show ideal mapping
 */

import { parseDescription, mapCard, TRELLO_LIST_MAPPING, TRELLO_LABEL_TO_CONTENT_TYPE, TrelloCard, TrelloLabel } from "../lib/trello";

// The card data from Trello API
const card = {
  id: "68ccaf121e42bd7fd5f07158",
  name: "Are OTC Hearing Aids Any Good?",
  desc: `[https://www.hearingtracker.com/resources/otc-vs-prescription-hearing-aids](https://www.hearingtracker.com/resources/otc-vs-prescription-hearing-aids "smartCard-inline")

[StoryBlok](https://app.storyblok.com/#/me/spaces/45415/stories/0/0/131660511272960/blok/95d0d161-5454-4bd2-9238-f0a19081c5d6 "‌")

[Lab data calculations](https://docs.google.com/spreadsheets/d/19Hnxpz3Uq6_NcjhcrpLTApJtRiKulH5Is1WQ_2MjFas/edit?gid=0#gid=0 "‌")

‌

**Keywords**

\\*are otc hearing aids any good (200)
otc vs prescription hearing aids (150)
what are the best otc hearing aids (150, [internal link](https://www.hearingtracker.com/otc-hearing-aids "‌"))
what are otc hearing aids (70)
what is the difference between otc and prescription hearing aids (60)
are otc hearing aids as good as prescription hearing aids (40)
[*primary keywords]

**Potential FAQs**

Does Costco sell OTC hearing aids? ([internal link](https://www.hearingtracker.com/hearing-aids/costco "‌"))
How much do OTC hearing aids cost?
Are OTC hearing aids FSA eligible? ([internal link](https://www.hearingtracker.com/n4/how-to-finance-your-purchase-of-hearing-aids "‌"))
Does Medicare cover OTC hearing aids? ([internal link](https://www.hearingtracker.com/hearing-aid-insurance-coverage "‌"))
Where can I buy OTC hearing aids? (various internal links: [Amazon](https://www.hearingtracker.com/hearing-aids/best-amazon-hearing-aids "‌"), [Best Buy](https://www.hearingtracker.com/hearing-aids/best-buy-otc-hearing-aids "‌"), [Walmart](https://www.hearingtracker.com/hearing-aids/walmart "‌"))
When did OTC hearing aids become available?

**Competitors**

[https://www.consumerreports.org/health/hearing-aids/complete-guide-to-over-the-counter-hearing-aids-a3898239010/](https://www.consumerreports.org/health/hearing-aids/complete-guide-to-over-the-counter-hearing-aids-a3898239010/ "smartCard-inline")
[https://www.goodrx.com/health-topic/ear/over-the-counter-hearing-aids](https://www.goodrx.com/health-topic/ear/over-the-counter-hearing-aids "smartCard-inline")

**Proposed Outline**

- H2: What Are OTC Hearing Aids?
- H2: OTC vs. Prescription Hearing Aids: What's the Difference?
- H3: How Good Are OTC Hearing Aids Really
  Discuss the lab data in this section, but speak in broad terms.
- H2: Who Should Use OTC Hearing Aids?
- H2: Frequently Asked Questions
- H3: [FAQs not addressed or inserted above]

Address FAQs where relevant. Keep FAQ answers short and link to an in-depth HT article, if available.`,
  due: null,
  idList: "66f3594f320b66bf10668426", // Published
  labels: [{ id: "123", idBoard: "board123", name: "Resource", color: "blue", uses: 1 }] as TrelloLabel[],
  members: [
    { id: "68dd3c41afde76aedc90223d", fullName: "Seka Palikuca", username: "sekapalikuca" },
    { id: "6164adef34f3e63a4ffc88a2", fullName: "Abram Bailey", username: "abrambailey1" },
    { id: "66fc669dec372322df5da31f", fullName: "Karl Strom", username: "karlstrom1" },
  ],
  attachments: [
    { id: "68cde71b1a26736419f455ef", name: "image.png", mimeType: "image/png", url: "https://trello.com/1/cards/.../image.png" },
    { id: "691501be435569f5979a5ae3", name: "photo_1.jpg", mimeType: "image/jpeg", url: "https://trello.com/1/cards/.../photo_1.jpg" },
    { id: "691501c4dbc84967765fadd1", name: "photo_2.jpg", mimeType: "image/jpeg", url: "https://trello.com/1/cards/.../photo_2.jpg" },
    { id: "692a0507b0506afc97bd9492", name: "Google Doc", mimeType: "", url: "https://docs.google.com/document/d/1KaCmxbH3UiCcK0oUjQNyQ52qwf05qD01GZ0_d8uEkRM/edit" },
  ],
  shortUrl: "https://trello.com/c/GxZ1e0AZ",
};

// Parse the description
const parsed = parseDescription(card.desc);

console.log("=== TRELLO CARD ANALYSIS ===\n");
console.log("Card:", card.name);
console.log("List:", TRELLO_LIST_MAPPING[card.idList]);
console.log("Labels:", card.labels.map(l => l.name));
console.log("Members:", card.members.map(m => m.fullName));
console.log("Attachments:", card.attachments.length);
console.log("\n");

console.log("=== PARSED DESCRIPTION ===\n");
console.log("SEO Title:", parsed.seoTitle);
console.log("H1:", parsed.h1);
console.log("Slug:", parsed.slug);
console.log("Primary Keyword:", parsed.primaryKeyword);
console.log("Secondary Keywords:", parsed.secondaryKeywords.length);
console.log("Search Queries:", parsed.searchQueries.length);
console.log("FAQs:", parsed.faqs.length);
console.log("Storyblok URL:", parsed.storyblokUrl);
console.log("Live URL:", parsed.liveUrl);
console.log("All URLs:", parsed.allUrls.length);
console.log("Notes length:", parsed.notes.length);
console.log("\n");

console.log("=== MAPPED CONTENT (using mapCard) ===\n");

// Use the actual mapper function with full card shape
const fullCard: TrelloCard = {
  ...card,
  url: "https://trello.com/c/GxZ1e0AZ/113-are-otc-hearing-aids-any-good",
  dueComplete: false,
  idBoard: "66f358bba2848a046daa5e45",
  idLabels: [],
  idMembers: [],
  pos: 0,
  shortLink: "GxZ1e0AZ",
  dateLastActivity: "",
  closed: false,
};

const mappedContent = mapCard(fullCard);

console.log(JSON.stringify(mappedContent, null, 2));

console.log("\n=== LINKS (will be created in cp_content_links) ===\n");
console.log(JSON.stringify(mappedContent.links, null, 2));

console.log("\n=== MEMBERS ===\n");
console.log("Member usernames:", mappedContent.memberUsernames);

console.log("\n=== ATTACHMENTS (skipped for now) ===\n");
for (const att of card.attachments) {
  console.log(`  - ${att.name} (${att.mimeType || "link"})`);
  console.log(`    url: ${att.url}`);
}

console.log("\n=== SUMMARY ===\n");
console.log("✓ Trello card link included");
console.log("✓ Live URL extracted from description");
console.log("✓ Slug extracted from live URL path");
console.log("✓ Keywords/FAQs in structured fields");
console.log("✓ Outline preserved in metadata");
console.log("✓ Members preserved in memberUsernames");
console.log("○ Attachments skipped (require auth to download)");
