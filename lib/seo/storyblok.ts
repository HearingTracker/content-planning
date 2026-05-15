// Fetch HearingTracker page metadata (title, H1, headings, body text) from
// Storyblok where possible, falling back to scraping the live HTML when a slug
// has no Storyblok story (e.g. programmatic compare pages).

import {
  tokenize,
  stripHtml,
  type PageContentType,
  type PageMeta,
  type Heading,
} from "./classify";

// Fields whose values are *headings* in any reasonable sense — promoted into
// `headings[]` so the section-embedding pass can score query↔heading cosine
// directly. Without this, FAQ-component "title"/"question" fields like
// "How much do hearing aids cost?" get folded into 400-char body chunks
// where the surrounding prose dilutes the cosine and a topic with a
// dedicated H2 reads as "marginal" coverage to the classifier.
const HEADING_FIELDS = new Set([
  "title","heading","sub_heading","headline","question",
]);

const TEXT_FIELDS = new Set([
  "subtitle","intro","description","body_text",
  "page_title","meta_description","seo_title","og_title","og_description",
  "caption","copy","content_text","tagline","blurb","summary",
  "answer","name","overview","pros","cons","verdict",
]);

// Reject obviously-non-heading values that happen to live in a heading-named
// field (long marketing copy that uses "title" loosely, URL slugs, etc.).
const MAX_HEADING_LEN = 200;

type WalkOut = { headings: Heading[]; body: string[]; components: Set<string> };

// Concatenate all text descendants of a node into a single string. Used for
// table cells and similar leaf content where structure inside doesn't matter.
function collectText(node: unknown): string {
  if (node == null) return "";
  if (typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(collectText).join("");
  const obj = node as Record<string, unknown>;
  if (obj.type === "text" && typeof obj.text === "string") return obj.text;
  if (Array.isArray(obj.content)) return (obj.content as unknown[]).map(collectText).join("");
  return "";
}

// Walk a Storyblok content tree. Storyblok rich text nodes look like
// {type:'heading', attrs:{level:N}, content:[{type:'text', text:'...'}]} —
// we capture headings separately and gather all other text into body[].
// Tables are emitted as markdown so the LLM can read structure. Custom Storyblok
// components are tagged inline as [block: <name>] so the LLM knows non-text
// blocks exist on the page (the bug that motivated v2: LLM recommending tables
// when a custom comparison_table component already covered the topic).
function walkStoryblok(node: unknown, out: WalkOut): void {
  if (node == null) return;
  if (typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) walkStoryblok(x, out);
    return;
  }

  const obj = node as Record<string, unknown>;

  if (typeof obj.type === "string") {
    if (obj.type === "text" && typeof obj.text === "string") {
      out.body.push(obj.text);
      return;
    }
    if (obj.type === "heading" && Array.isArray(obj.content)) {
      const text = (obj.content as Array<Record<string, unknown>>)
        .map((c) => (typeof c?.text === "string" ? (c.text as string) : ""))
        .join(" ");
      const level = typeof (obj.attrs as { level?: number } | undefined)?.level === "number"
        ? ((obj.attrs as { level: number }).level)
        : 2;
      out.headings.push({ level, text });
      return; // text already captured
    }
    if (obj.type === "table" && Array.isArray(obj.content)) {
      const rows = obj.content as Array<Record<string, unknown>>;
      const grid: string[][] = [];
      for (const row of rows) {
        if (!Array.isArray((row as { content?: unknown }).content)) continue;
        const cells = (row as { content: Array<Record<string, unknown>> }).content;
        grid.push(cells.map((cell) => collectText(cell).replace(/\s+/g, " ").trim() || " "));
      }
      if (grid.length > 0 && grid[0].length > 0) {
        const lines: string[] = [];
        lines.push(`| ${grid[0].join(" | ")} |`);
        lines.push(`| ${grid[0].map(() => "---").join(" | ")} |`);
        for (const r of grid.slice(1)) lines.push(`| ${r.join(" | ")} |`);
        out.body.push(lines.join("\n"));
      }
      return; // do not recurse — already captured
    }
    if (Array.isArray(obj.content)) {
      for (const c of obj.content) walkStoryblok(c, out);
      return;
    }
  }

  // Custom Storyblok component (bloks). Emit a structural marker so the LLM
  // knows there's a non-text block here, then keep walking to capture text
  // fields inside (specs, captions, etc.).
  if (typeof obj.component === "string" && obj.component.length > 0) {
    out.components.add(obj.component);
    out.body.push(`[block: ${obj.component}]`);

    // Listicle pages auto-render a price/spec comparison table at the top from
    // the product entries on the page. Without this marker the LLM only sees
    // product prose and concludes "no table here, recommend adding one."
    if (obj.component === "n4-page-config" && obj.listicle_table === true) {
      const tableTitle =
        typeof obj.listicle_table_title === "string" && obj.listicle_table_title.trim().length > 0
          ? obj.listicle_table_title.trim()
          : "comparison table";
      out.body.push(
        `[auto-rendered: "${tableTitle}" — comparison table at the top of this page showing price and key specs for the products described below]`,
      );
    }
  }

  for (const [k, v] of Object.entries(obj)) {
    if (k === "_uid" || k === "_editable" || k === "component") continue;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length <= 1 || /^https?:|^\//.test(trimmed)) continue;
      if (HEADING_FIELDS.has(k) && trimmed.length <= MAX_HEADING_LEN) {
        out.headings.push({ level: 2, text: trimmed });
      } else if (TEXT_FIELDS.has(k)) {
        out.body.push(trimmed);
      }
      continue;
    }
    walkStoryblok(v, out);
  }
}

type StoryblokStory = {
  name?: string;
  content?: Record<string, unknown> & {
    blocks?: Array<Record<string, unknown>>;
    body?: Array<Record<string, unknown>>;
  };
};

async function fetchStoryblokStory(urlPath: string, sbToken: string): Promise<{
  name: string;
  pageTitle: string;
  metaDesc: string;
  headings: Heading[];
  body: string[];
  components: string[];
  /** ISO timestamp of the page's last meaningful update, or null. */
  contentModifiedAt: string | null;
} | null> {
  const slug = `stories${urlPath.startsWith("/") ? urlPath : "/" + urlPath}`;
  const url = `https://api.storyblok.com/v2/cdn/stories/${slug}?token=${sbToken}&version=published`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const data = (await res.json()) as { story?: StoryblokStory };
    const story = data.story;
    if (!story) return null;
    const out: WalkOut = { headings: [], body: [], components: new Set<string>() };
    walkStoryblok(story.content, out);

    const findField = (component: string, field: string): string => {
      const blocks = story.content?.blocks ?? story.content?.body ?? [];
      const blk = Array.isArray(blocks)
        ? blocks.find((b) => (b as { component?: string })?.component === component)
        : null;
      const v = (blk as Record<string, unknown> | undefined)?.[field];
      return typeof v === "string" ? v : "";
    };

    // Editor-managed staleness signal: n4-article.updated is bumped only on
    // meaningful content updates (typo fixes don't bump it), unlike the
    // API-level published_at which reflects every republish. Fall back to
    // n4-article.published so first-time articles still produce a date.
    const updatedRaw = findField("n4-article", "updated");
    const publishedRaw = findField("n4-article", "published");
    const contentModifiedAt = parseStoryblokDate(updatedRaw) ?? parseStoryblokDate(publishedRaw);

    return {
      name: story.name ?? "",
      pageTitle: findField("n4-meta-information", "page_title") || (story.name ?? ""),
      metaDesc: findField("n4-meta-information", "meta_description"),
      headings: out.headings,
      body: out.body,
      components: [...out.components].sort(),
      contentModifiedAt,
    };
  } catch (err) {
    console.warn(`[seo] storyblok fetch failed for ${slug}:`, (err as Error).message);
    return null;
  }
}

function inferPageContentType(args: {
  urlPath: string;
  title: string;
  h1: string;
  description: string;
  headings: Heading[];
  bodyText: string;
  componentNames: string[];
}): { contentType: PageContentType; signals: string[] } {
  const { urlPath, title, h1, description, headings, bodyText, componentNames } = args;
  const text = [
    urlPath,
    title,
    h1,
    description,
    ...headings.slice(0, 12).map((h) => h.text),
    bodyText.slice(0, 3000),
  ].join(" ").toLowerCase();
  const surfaceText = [
    urlPath,
    title,
    h1,
    description,
    ...headings.slice(0, 12).map((h) => h.text),
  ].join(" ").toLowerCase();
  const components = new Set(componentNames);
  const signals: string[] = [];
  const add = (signal: string) => {
    if (!signals.includes(signal)) signals.push(signal);
  };

  if (
    urlPath === "/best-hearing-aids"
    || /(^|\/)best[-/]/i.test(urlPath)
    || /\b(best|top)\s+\w*(?:\s+\w+){0,4}\s+hearing aids?\b/i.test(title)
    || text.includes("[auto-rendered:")
  ) {
    add("best/listicle URL, title, or listicle table");
    return { contentType: "best_list", signals };
  }

  if (
    /\b(vs|versus|compare|comparison|compared)\b/i.test(title)
    || urlPath.includes("/compare")
    || /-vs-|\/vs\//i.test(urlPath)
  ) {
    add("comparison URL or title");
    return { contentType: "comparison_page", signals };
  }

  if (
    /\breviews?\b/i.test(title)
    || /\breviews?\b/i.test(h1)
    || /\/reviews?\//i.test(urlPath)
    || components.has("product-review")
    || components.has("n4-product-review")
  ) {
    add("review URL, title, or component");
    return { contentType: "product_review", signals };
  }

  if (/^\/hearing-aids\/[^/]+$/.test(urlPath)) {
    add("single hearing-aids subpath");
    return { contentType: "brand_page", signals };
  }

  if (
    /\b(price|prices|pricing|cost|costs|affordable|cheap|finance|financing|insurance|medicare)\b/i.test(surfaceText)
    || /(?:price|pricing|cost|affordable|finance|insurance|medicare)/i.test(urlPath)
  ) {
    add("price, cost, insurance, or buying-guide surface language");
    return { contentType: "price_or_buying_guide", signals };
  }

  if (/\bhearing aids?\b/i.test(text) || urlPath.includes("hearing-aids")) {
    add("hearing-aids guide context");
    return { contentType: "general_guide", signals };
  }

  if (title || h1 || bodyText) {
    add("article metadata present");
    return { contentType: "generic_article", signals };
  }

  add("no reliable content-type signal");
  return { contentType: "unknown", signals };
}

/**
 * Storyblok stores dates as `"YYYY-MM-DD HH:MM"` strings (no timezone).
 * Treat as UTC for consistency — the synthesizer compares ages in days, so
 * sub-day timezone drift doesn't matter.
 */
function parseStoryblokDate(s: string): string | null {
  if (!s || s.trim().length === 0) return null;
  // Accept "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" or "YYYY-MM-DD HH:MM:SS"
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  if (!m) return null;
  const date = m[1];
  const time = m[2] ? (m[2].length === 5 ? `${m[2]}:00` : m[2]) : "00:00:00";
  const iso = `${date}T${time}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchRenderedMeta(siteOrigin: string, urlPath: string): Promise<{
  title: string; h1: string; description: string; h2s: string[]; body: string;
  outboundInternalLinks: string[];
}> {
  const url = new URL(urlPath, siteOrigin).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "HT-SEO-LHF/1.0" },
      redirect: "follow",
    });
    if (!res.ok) {
      return { title: "", h1: "", description: "", h2s: [], body: "", outboundInternalLinks: [] };
    }
    const html = await res.text();
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const descM =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const h2s = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => stripHtml(m[1]));
    const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 60).map((m) => stripHtml(m[1]));
    const outboundInternalLinks = extractOutboundInternalLinks(html, urlPath);
    return {
      title: stripHtml(titleM?.[1]),
      h1: stripHtml(h1M?.[1]),
      description: stripHtml(descM?.[1]),
      h2s,
      body: ps.join(" "),
      outboundInternalLinks,
    };
  } catch (err) {
    console.warn(`[seo] rendered fetch failed for ${url}:`, (err as Error).message);
    return { title: "", h1: "", description: "", h2s: [], body: "", outboundInternalLinks: [] };
  }
}

/**
 * Pull HearingTracker-internal anchor hrefs out of the raw HTML body. Must
 * run BEFORE stripHtml() — that helper drops anchors entirely.
 *
 * Accepts both forms editors produce:
 *   • <a href="/hearing-aids/phonak"> ...
 *   • <a href="https://www.hearingtracker.com/hearing-aids/phonak"> ...
 *
 * Excludes: external sites, fragment-only links, mailto/tel, and self-links
 * to the page being scraped (a page doesn't link to itself in the
 * link-equity sense). Returns deduped, sorted, normalized paths.
 */
function extractOutboundInternalLinks(html: string, currentPath: string): string[] {
  const matches = html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi);
  const out = new Set<string>();
  const selfPath = currentPath.replace(/\/+$/, "") || "/";
  for (const m of matches) {
    const href = m[1].trim();
    if (!href) continue;
    let path: string | null = null;
    if (href.startsWith("/")) {
      // Reject protocol-relative ("//cdn.example.com/x") and fragment-only.
      if (href.startsWith("//") || href.startsWith("/#")) continue;
      path = href;
    } else if (/^https?:\/\//i.test(href)) {
      try {
        const u = new URL(href);
        if (u.host !== "www.hearingtracker.com") continue;
        path = u.pathname || "/";
      } catch {
        continue;
      }
    } else {
      continue; // mailto:, tel:, javascript:, fragments, etc.
    }
    if (!path) continue;
    // Drop query strings and fragments — link-equity is at the page level.
    path = path.split("#")[0].split("?")[0].replace(/\/+$/, "") || "/";
    if (path === selfPath) continue;
    out.add(path);
  }
  return [...out].sort();
}

export async function fetchPageMeta(siteOrigin: string, urlPath: string, sbToken: string | undefined): Promise<PageMeta> {
  // Storyblok and rendered fetches in parallel:
  //   • Storyblok provides the editor-managed `n4-article.updated` date and
  //     clean structured body/headings.
  //   • Rendered HTML provides the outbound-link graph (anchor hrefs are
  //     stripped from Storyblok rich-text fields once they're stringified).
  // We always do BOTH so internal-link extraction works for all pages, not
  // just non-Storyblok ones. Cost is one extra HTTP fetch per page; sync
  // concurrency is bounded (6) and runs infrequently.
  const [sb, rendered] = await Promise.all([
    sbToken ? fetchStoryblokStory(urlPath, sbToken) : Promise.resolve(null),
    fetchRenderedMeta(siteOrigin, urlPath),
  ]);

  let title = "";
  let h1 = "";
  let description = "";
  let headings: Heading[] = [];
  let bodyText = "";
  let source: "storyblok" | "rendered" = "rendered";
  let contentModifiedAt: string | null = null;
  let componentNames: string[] = [];

  if (sb) {
    source = "storyblok";
    title = sb.pageTitle || sb.name;
    description = sb.metaDesc;
    headings = sb.headings;
    h1 = headings.find((h) => h.level === 1)?.text || sb.name;
    bodyText = sb.body.join("\n\n");
    contentModifiedAt = sb.contentModifiedAt;
    componentNames = sb.components;
  } else {
    title = rendered.title;
    h1 = rendered.h1;
    description = rendered.description;
    headings = rendered.h2s.map((t) => ({ level: 2, text: t }));
    bodyText = rendered.body;
  }

  const contentType = inferPageContentType({
    urlPath,
    title,
    h1,
    description,
    headings,
    bodyText,
    componentNames,
  });

  const titleTokens = new Set([
    ...tokenize(title),
    ...tokenize(h1),
    ...tokenize(description),
  ]);
  const bodyTokens = new Set([
    ...tokenize(bodyText),
    ...headings.flatMap((h) => tokenize(h.text)),
  ]);
  // Slug fallback so brand pages without rendered HTML still classify
  for (const t of tokenize(urlPath.replace(/[/-]/g, " "))) titleTokens.add(t);

  return {
    url: new URL(urlPath, siteOrigin).toString(),
    source,
    title, h1, description,
    headings,
    bodyText,
    contentType: contentType.contentType,
    contentTypeSignals: contentType.signals,
    titleTokens,
    bodyTokens,
    contentModifiedAt,
    outboundInternalLinks: rendered.outboundInternalLinks,
  };
}

export async function fetchAllPageMetas(
  siteOrigin: string,
  paths: string[],
  sbToken: string | undefined,
  concurrency = 6,
): Promise<Map<string, PageMeta>> {
  const out = new Map<string, PageMeta>();
  for (let i = 0; i < paths.length; i += concurrency) {
    const slice = paths.slice(i, i + concurrency);
    const results = await Promise.all(slice.map((p) => fetchPageMeta(siteOrigin, p, sbToken)));
    slice.forEach((p, idx) => out.set(p, results[idx]));
  }
  return out;
}
