import { parseDescription, mapCard, TrelloCard } from "../lib/trello";

const desc = `SEO title: How to Fix Battery Drain on Phonak Sphere Infinio Hearing Aids
H1: X Tips to Fix Excessive Battery Drain on Phonak Sphere Infinio Hearing Aids
Slug: fix-phonak-hearing-aids-battery-drain

This seems to be a common issue.

**Forum resources:**
[https://forum.hearingtracker.com/t/example](https://forum.hearingtracker.com/t/example)

**Search queries:**
phonak rechargeable battery replacement cost (150)
phonak battery replacement (100)`;

const parsed = parseDescription(desc);
console.log("=== Parsed Description ===");
console.log("seoTitle:", parsed.seoTitle);
console.log("h1:", parsed.h1);
console.log("slug:", parsed.slug);
console.log("slug length:", parsed.slug?.length);
console.log("notes:", parsed.notes);
console.log("notes length:", parsed.notes?.length);

const card: TrelloCard = {
  id: "test",
  name: "Phonak Battery Drain",
  desc,
  due: null,
  dueComplete: false,
  idBoard: "test",
  idList: "66f358dc6c4988996773f6d8", // Brief Draft list
  idLabels: [],
  idMembers: [],
  labels: [],
  members: [],
  pos: 0,
  shortLink: "test",
  shortUrl: "https://trello.com/c/test",
  url: "https://trello.com/c/test",
  dateLastActivity: "",
  closed: false,
};

const mapped = mapCard(card);
console.log("\n=== Mapped Content (Brief stage) ===");
console.log("stage:", mapped.stage);
console.log("title:", mapped.title, "length:", mapped.title?.length);
console.log("slug:", mapped.slug, "length:", mapped.slug?.length);
console.log("description:", mapped.description, "length:", mapped.description?.length);
console.log("primary_keyword:", mapped.primary_keyword, "length:", mapped.primary_keyword?.length);
console.log(
  "notes preview:",
  mapped.notes?.substring(0, 100),
  "... length:",
  mapped.notes?.length
);
console.log("secondary_keywords count:", mapped.secondary_keywords?.length);
