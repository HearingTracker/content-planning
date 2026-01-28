/**
 * Trello card description parser
 * Extracts structured data from Trello card descriptions
 */

import type { TrelloCard } from "./client";

// Parsed keyword with optional search volume
export interface ParsedKeyword {
  keyword: string;
  volume?: number;
}

// Parsed URL with type classification
export interface ParsedUrl {
  url: string;
  type: "storyblok" | "hearingtracker" | "forum" | "external";
  title?: string;
}

// Structured data extracted from description
export interface ParsedDescription {
  seoTitle?: string;
  h1?: string;
  slug?: string;
  primaryKeyword?: ParsedKeyword;
  secondaryKeywords: ParsedKeyword[];
  searchQueries: ParsedKeyword[];
  faqs: ParsedKeyword[];
  internalLinks: ParsedUrl[];
  forumResources: ParsedUrl[];
  externalResources: ParsedUrl[];
  brief?: string;
  outline?: string;
  notes: string;
  storyblokUrl?: string;
  liveUrl?: string;
  allUrls: ParsedUrl[];
}

// Content stage type
export type ContentStage = "idea" | "brief" | "content";

// Trello list to stage/status mapping
export const TRELLO_LIST_MAPPING: Record<
  string,
  { stage: ContentStage; status?: string }
> = {
  "66f358dc6c4988996773f6d8": { stage: "brief" }, // New Articles Queue
  "66fc535b0c087b59ad9b3a15": { stage: "brief" }, // Update Queue
  "68dc7e7ab3259474182f307d": { stage: "idea" }, // Pitches
  "66f358e065cc3ec20689f1be": { stage: "content", status: "draft" }, // Assigned
  "66f358e7c333ae6838219277": { stage: "content", status: "in_review" }, // Submitted
  "66f3594f320b66bf10668426": { stage: "content", status: "published" }, // Published
  "66f45bbd7444d2113f283a68": { stage: "content", status: "published" }, // Interlinked
  "670ef3c92f32149ba5ac5ee1": { stage: "content", status: "archived" }, // Done
};

// Trello label to content type mapping
export const TRELLO_LABEL_TO_CONTENT_TYPE: Record<string, string> = {
  "Best List": "best-list",
  Resource: "resource",
  "Product Page": "product-page",
  "Brand Page": "brand-page",
  Opinion: "opinion",
};

// Trello label to priority mapping
export const TRELLO_LABEL_TO_PRIORITY: Record<
  string,
  "low" | "medium" | "high" | "urgent"
> = {
  Urgent: "urgent",
  "low priority": "low",
};

// Trello username to user email mapping
export const TRELLO_USERNAME_TO_EMAIL: Record<string, string> = {
  sekapalikuca: "sekapalikuca@gmail.com",
  karlstrom1: "karl@hearingtracker.com",
  arbitrarytina: "tinasieber@gmail.com",
  abrambailey1: "abram@hearingtracker.com",
  abrambailey2: "abram@hearingtracker.com",
};

/**
 * Parse a keyword string that may include search volume in parentheses
 * Examples: "hearing aid repair (1.5K)", "how to repair hearing aids (20)"
 */
export function parseKeywordWithVolume(text: string): ParsedKeyword {
  const volumeMatch = text.match(/\(([0-9.,]+K?)\)\s*$/i);

  if (volumeMatch) {
    const keyword = text.replace(volumeMatch[0], "").trim();
    let volumeStr = volumeMatch[1].replace(/,/g, "");

    let volume: number;
    if (volumeStr.toLowerCase().endsWith("k")) {
      volume = parseFloat(volumeStr.slice(0, -1)) * 1000;
    } else {
      volume = parseFloat(volumeStr);
    }

    return { keyword, volume: isNaN(volume) ? undefined : volume };
  }

  return { keyword: text.trim() };
}

/**
 * Classify a URL by its type
 */
export function classifyUrl(url: string): ParsedUrl["type"] {
  if (url.includes("app.storyblok.com")) return "storyblok";
  if (url.includes("forum.hearingtracker.com")) return "forum";
  if (url.includes("hearingtracker.com")) return "hearingtracker";
  return "external";
}

/**
 * Extract all URLs from text, handling markdown link format
 * Handles: [title](url), [url](url "smartCard-inline"), plain URLs
 */
export function extractUrls(text: string): ParsedUrl[] {
  const urls: ParsedUrl[] = [];
  const seen = new Set<string>();

  // Match markdown links: [text](url) or [text](url "title")
  const markdownLinkRegex = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;

  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const title = match[1];
    const url = match[2];

    if (!seen.has(url)) {
      seen.add(url);
      urls.push({
        url,
        type: classifyUrl(url),
        title: title && title !== url ? title : undefined,
      });
    }
  }

  // Match plain URLs not in markdown format
  const plainUrlRegex =
    /(?<!\]\()https?:\/\/[^\s\)\]"]+(?<!\s"smartCard-inline)/g;
  while ((match = plainUrlRegex.exec(text)) !== null) {
    const url = match[0];
    if (!seen.has(url)) {
      seen.add(url);
      urls.push({
        url,
        type: classifyUrl(url),
      });
    }
  }

  return urls;
}

/**
 * Extract a labeled field value from description
 * Handles **Label:**, Label:, and **Label** (section header) formats
 * @param singleLine - If true, only capture until end of line (for slug, title fields)
 */
function extractLabeledField(
  text: string,
  label: string,
  singleLine: boolean = false
): { value: string; endIndex: number } | null {
  if (singleLine) {
    // Single-line extraction - capture only until newline
    const singleLinePattern = new RegExp(
      `(?:\\*\\*${label}:?\\*\\*|(?:^|\\n)${label}:)\\s*([^\\n]*)`,
      "i"
    );
    const match = text.match(singleLinePattern);
    if (match) {
      return {
        value: match[1].trim(),
        endIndex: match.index! + match[0].length,
      };
    }
    return null;
  }

  // Multi-line extraction
  // Try bold format with colon: **Label:**
  let pattern = new RegExp(
    `\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Za-z]|\\n##|$)`,
    "i"
  );
  let match = text.match(pattern);

  if (!match) {
    // Try bold section header without colon: **Label**
    pattern = new RegExp(
      `\\*\\*${label}\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*[A-Za-z]|\\n##|$)`,
      "i"
    );
    match = text.match(pattern);
  }

  if (!match) {
    // Try plain format: Label:
    pattern = new RegExp(
      `(?:^|\\n)${label}:\\s*([\\s\\S]*?)(?=\\n[A-Za-z]+:|\\n##|$)`,
      "i"
    );
    match = text.match(pattern);
  }

  if (match) {
    return {
      value: match[1].trim(),
      endIndex: match.index! + match[0].length,
    };
  }

  return null;
}

/**
 * Parse multiple keywords from a multiline text block
 */
function parseKeywordList(text: string): ParsedKeyword[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("["))
    .map(parseKeywordWithVolume);
}

/**
 * Main parser: Extract structured data from a Trello card description
 */
export function parseDescription(description: string): ParsedDescription {
  const result: ParsedDescription = {
    secondaryKeywords: [],
    searchQueries: [],
    faqs: [],
    internalLinks: [],
    forumResources: [],
    externalResources: [],
    notes: "",
    allUrls: [],
  };

  if (!description || description.trim() === "") {
    return result;
  }

  // Extract all URLs first
  result.allUrls = extractUrls(description);

  // Find storyblok and live URLs
  result.storyblokUrl = result.allUrls.find(
    (u) => u.type === "storyblok"
  )?.url;
  result.liveUrl = result.allUrls.find(
    (u) => u.type === "hearingtracker"
  )?.url;

  // Extract labeled fields (single-line fields)
  const seoTitle = extractLabeledField(description, "SEO title", true);
  if (seoTitle) result.seoTitle = seoTitle.value;

  const h1 = extractLabeledField(description, "H1", true);
  if (h1) result.h1 = h1.value;

  const slug = extractLabeledField(description, "Slug", true);
  if (slug) result.slug = slug.value;

  const primaryKeyword = extractLabeledField(description, "Primary keyword", true);
  if (primaryKeyword) {
    result.primaryKeyword = parseKeywordWithVolume(primaryKeyword.value);
  }

  const secondaryKeywords = extractLabeledField(
    description,
    "Secondary keywords"
  );
  if (secondaryKeywords) {
    result.secondaryKeywords = parseKeywordList(secondaryKeywords.value);
  }

  // Also try "Keywords" section header (without "Secondary")
  const keywordsSection = extractLabeledField(description, "Keywords");
  if (keywordsSection) {
    result.secondaryKeywords.push(...parseKeywordList(keywordsSection.value));
  }

  const searchQueries = extractLabeledField(description, "Search queries");
  if (searchQueries) {
    result.searchQueries = parseKeywordList(searchQueries.value);
  }

  const otherQueries = extractLabeledField(
    description,
    "Other search queries"
  );
  if (otherQueries) {
    result.searchQueries.push(...parseKeywordList(otherQueries.value));
  }

  const faqs = extractLabeledField(description, "FAQs");
  if (faqs) {
    result.faqs = parseKeywordList(faqs.value);
  }

  const potentialFaqs = extractLabeledField(description, "Potential FAQs");
  if (potentialFaqs) {
    result.faqs.push(...parseKeywordList(potentialFaqs.value));
  }

  const brief = extractLabeledField(description, "Brief");
  if (brief) result.brief = brief.value;

  const outline = extractLabeledField(description, "Proposed Outline");
  if (outline) result.outline = outline.value;

  // Categorize URLs by section
  const internalLinks = extractLabeledField(description, "Internal links");
  if (internalLinks) {
    result.internalLinks = extractUrls(internalLinks.value);
  }

  const forumResources = extractLabeledField(description, "Forum resources");
  if (forumResources) {
    result.forumResources = extractUrls(forumResources.value);
  }

  const externalResources = extractLabeledField(
    description,
    "External resources"
  );
  if (externalResources) {
    result.externalResources = extractUrls(externalResources.value);
  }

  // Also try "Competitors" section for external resources
  const competitors = extractLabeledField(description, "Competitors");
  if (competitors) {
    result.externalResources.push(...extractUrls(competitors.value));
  }

  // Also check for forum URLs not in a labeled section
  result.forumResources.push(
    ...result.allUrls.filter(
      (u) =>
        u.type === "forum" &&
        !result.forumResources.some((f) => f.url === u.url)
    )
  );

  // Build notes from remaining unstructured text
  let notes = description;

  // Remove labeled sections (both with and without colons)
  const labelsToRemove = [
    "SEO title",
    "H1",
    "Slug",
    "Primary keyword",
    "Secondary keywords",
    "Keywords",
    "Search queries",
    "Other search queries",
    "FAQs",
    "Potential FAQs",
    "Brief",
    "Proposed Outline",
    "Internal links",
    "Forum resources",
    "External resources",
    "Competitors",
  ];

  for (const label of labelsToRemove) {
    // Remove bold format with colon: **Label:**
    notes = notes.replace(
      new RegExp(
        `\\*\\*${label}:\\*\\*\\s*[\\s\\S]*?(?=\\n\\*\\*[A-Za-z]|\\n##|$)`,
        "gi"
      ),
      ""
    );
    // Remove bold section header without colon: **Label**
    notes = notes.replace(
      new RegExp(
        `\\*\\*${label}\\*\\*\\s*\\n[\\s\\S]*?(?=\\n\\*\\*[A-Za-z]|\\n##|$)`,
        "gi"
      ),
      ""
    );
    // Remove plain format: Label:
    notes = notes.replace(
      new RegExp(`(?:^|\\n)${label}:\\s*[\\s\\S]*?(?=\\n[A-Za-z]+:|\\n##|$)`, "gi"),
      ""
    );
  }

  // Remove standalone URLs (they're already captured)
  notes = notes.replace(/\[([^\]]*)\]\([^)]+\)/g, "");
  notes = notes.replace(/https?:\/\/[^\s]+/g, "");

  // Clean up
  notes = notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();

  result.notes = notes;

  return result;
}

// ============================================================================
// Unified MappedContent type (replaces MappedIdea, MappedBrief, MappedContentItem)
// ============================================================================

// Link to be created in cp_content_links
export interface ContentLink {
  url: string;
  name?: string;
  link_type: string;
}

// Unified mapped content type for all stages
export interface MappedContent {
  // Core fields
  title: string;
  slug?: string;
  description?: string; // Maps to description field

  // Stage tracking
  stage: ContentStage;
  idea_status?: string;
  brief_status?: string;
  workflow_status_slug?: string;

  // Common fields
  content_type_slug?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  notes?: string;
  metadata?: Record<string, unknown>;

  // Idea-specific fields
  source?: string;
  potential_keywords?: ParsedKeyword[];
  target_audience?: string;
  estimated_effort?: "low" | "medium" | "high";

  // Brief/SEO fields
  primary_keyword?: string;
  secondary_keywords?: string[];
  search_intent?: string;
  target_word_count?: number;
  content_goals?: string;
  tone_and_style?: string;
  outline?: string;
  internal_links?: string[];
  external_references?: string[];
  competitor_examples?: string[];

  // Content-specific fields
  body?: Record<string, unknown>;
  storyblok_url?: string;
  due_date?: string;

  // Relations
  memberUsernames?: string[]; // Trello member usernames for assignment mapping
  links?: ContentLink[]; // Links to create in cp_content_links
}

// Legacy type aliases for backward compatibility
export type MappedIdea = MappedContent;
export type MappedBrief = MappedContent;
export type MappedContentItem = MappedContent;

/**
 * Convert markdown formatting to EditorJS HTML
 */
function convertMarkdownToHtml(text: string): string {
  let result = text;
  // Links: [text](url) -> <a href="url">text</a>
  result = result.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2">$1</a>');
  // Bold: **text** or __text__ -> <b>text</b>
  result = result.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  result = result.replace(/__([^_]+)__/g, '<b>$1</b>');
  // Clean up zero-width chars
  result = result.replace(/[\u200B-\u200D\uFEFF\u00AD‌]/g, '');
  return result.trim();
}

/**
 * Convert entire Trello description to EditorJS format (preserving all content)
 */
function descriptionToEditorJS(description: string): { time: number; blocks: Array<{ type: string; data: Record<string, unknown> }>; version: string } | undefined {
  if (!description || description.trim() === "") {
    return undefined;
  }

  const blocks: Array<{ type: string; data: Record<string, unknown> }> = [];
  const lines = description.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Check for bold section headers: **Section Name** or **Section Name:**
    const boldHeaderMatch = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldHeaderMatch) {
      blocks.push({
        type: "header",
        data: { text: boldHeaderMatch[1].trim(), level: 2 },
      });
      continue;
    }

    // Check for H2/H3 markers in outline format
    const h2Match = trimmed.match(/^-?\s*H2:\s*(.+)/i);
    const h3Match = trimmed.match(/^-?\s*H3:\s*(.+)/i);

    if (h2Match) {
      blocks.push({
        type: "header",
        data: { text: convertMarkdownToHtml(h2Match[1].trim()), level: 2 },
      });
    } else if (h3Match) {
      blocks.push({
        type: "header",
        data: { text: convertMarkdownToHtml(h3Match[1].trim()), level: 3 },
      });
    } else {
      // Regular paragraph - convert markdown to HTML
      blocks.push({
        type: "paragraph",
        data: { text: convertMarkdownToHtml(trimmed) },
      });
    }
  }

  return blocks.length > 0 ? { time: Date.now(), blocks, version: "2.28.0" } : undefined;
}

/**
 * Map a Trello card to unified Content
 * Determines stage from list mapping and populates appropriate fields
 */
export function mapCard(card: TrelloCard): MappedContent {
  const parsed = parseDescription(card.desc);
  const labels = card.labels?.map((l) => l.name) ?? [];
  const listMapping = TRELLO_LIST_MAPPING[card.idList];
  const stage = listMapping?.stage || "content";

  // Determine priority from labels
  let priority: MappedContent["priority"];
  for (const label of labels) {
    if (TRELLO_LABEL_TO_PRIORITY[label]) {
      priority = TRELLO_LABEL_TO_PRIORITY[label];
      break;
    }
  }

  // Determine content type from labels
  let contentTypeSlug: string | undefined;
  for (const label of labels) {
    if (TRELLO_LABEL_TO_CONTENT_TYPE[label]) {
      contentTypeSlug = TRELLO_LABEL_TO_CONTENT_TYPE[label];
      break;
    }
  }

  // Build base content object
  const content: MappedContent = {
    title: card.name,
    stage,
    content_type_slug: contentTypeSlug,
    priority,
    metadata: {
      trello_card_id: card.id,
      trello_url: card.url,
    },
  };

  // Add stage-specific fields and status
  switch (stage) {
    case "idea": {
      content.idea_status = "submitted";
      content.description = parsed.brief || parsed.notes || undefined;
      content.source = labels.includes("Forum Idea") ? "forum" : undefined;
      content.potential_keywords = [
        ...(parsed.primaryKeyword ? [parsed.primaryKeyword] : []),
        ...parsed.searchQueries,
      ];
      content.notes = parsed.notes || undefined;
      // Add forum links to metadata
      if (parsed.forumResources.length > 0) {
        content.metadata = {
          ...content.metadata,
          forum_links: parsed.forumResources.map((u) => u.url),
        };
      }
      break;
    }

    case "brief": {
      content.brief_status = "draft";
      content.slug = parsed.slug;
      content.description = parsed.seoTitle || parsed.brief;
      content.primary_keyword = parsed.primaryKeyword?.keyword;
      content.secondary_keywords = [
        ...parsed.secondaryKeywords.map((k) => k.keyword),
        ...parsed.searchQueries.map((k) => k.keyword),
      ];
      content.internal_links = parsed.internalLinks.map((u) => u.url);
      content.external_references = [
        ...parsed.externalResources.map((u) => u.url),
        ...parsed.forumResources.map((u) => u.url),
      ];
      content.outline = parsed.outline;
      content.notes = parsed.notes || undefined;
      // Add SEO metadata
      content.metadata = {
        ...content.metadata,
        seo_title: parsed.seoTitle,
        h1: parsed.h1,
        faqs: parsed.faqs,
        is_update: labels.includes("Update"),
        live_url: parsed.liveUrl,
      };
      break;
    }

    case "content": {
      content.workflow_status_slug = listMapping?.status || "draft";
      content.slug = parsed.slug || parsed.liveUrl?.split("/").pop() || undefined;
      content.storyblok_url = parsed.storyblokUrl;
      content.due_date = card.due ? card.due.split("T")[0] : undefined;
      content.memberUsernames = card.members?.map((m) => m.username);
      // Convert description to EditorJS body
      content.body = descriptionToEditorJS(card.desc);
      // Preserve SEO fields from brief stage
      content.primary_keyword = parsed.primaryKeyword?.keyword;
      content.secondary_keywords = [
        ...parsed.secondaryKeywords.map((k) => k.keyword),
        ...parsed.searchQueries.map((k) => k.keyword),
      ];
      content.internal_links = parsed.internalLinks.map((u) => u.url);
      content.external_references = [
        ...parsed.externalResources.map((u) => u.url),
        ...parsed.forumResources.map((u) => u.url),
      ];
      // Add Trello card link
      content.links = [{
        url: card.url,
        name: "Trello Card",
        link_type: "trello",
      }];
      break;
    }
  }

  return content;
}

// Legacy mapping functions (for backward compatibility)
export function mapCardToIdea(card: TrelloCard): MappedContent {
  const content = mapCard(card);
  content.stage = "idea";
  content.idea_status = "submitted";
  return content;
}

export function mapCardToBrief(card: TrelloCard): MappedContent {
  const content = mapCard(card);
  content.stage = "brief";
  content.brief_status = "draft";
  return content;
}

export function mapCardToContentItem(card: TrelloCard): MappedContent {
  const content = mapCard(card);
  content.stage = "content";
  return content;
}
