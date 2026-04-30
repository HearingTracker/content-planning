// Fetch HearingTracker page metadata (title, H1, headings, body text) from
// Storyblok where possible, falling back to scraping the live HTML when a slug
// has no Storyblok story (e.g. programmatic compare pages).

import { tokenize, stripHtml, type PageMeta, type Heading } from "./classify";

const TEXT_FIELDS = new Set([
  "title","subtitle","heading","sub_heading","intro","description","body_text",
  "page_title","meta_description","seo_title","og_title","og_description",
  "caption","copy","content_text","headline","tagline","blurb","summary",
  "question","answer","name","overview","pros","cons","verdict",
]);

type WalkOut = { headings: Heading[]; body: string[] };

// Walk a Storyblok content tree. Storyblok rich text nodes look like
// {type:'heading', attrs:{level:N}, content:[{type:'text', text:'...'}]} —
// we capture headings separately and gather all other text into body[].
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
    if (Array.isArray(obj.content)) {
      for (const c of obj.content) walkStoryblok(c, out);
      return;
    }
  }

  for (const [k, v] of Object.entries(obj)) {
    if (k === "_uid" || k === "_editable" || k === "component") continue;
    if (typeof v === "string") {
      if (TEXT_FIELDS.has(k) && v.length > 1 && !/^https?:|^\//.test(v)) {
        out.body.push(v);
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
} | null> {
  const slug = `stories${urlPath.startsWith("/") ? urlPath : "/" + urlPath}`;
  const url = `https://api.storyblok.com/v2/cdn/stories/${slug}?token=${sbToken}&version=published`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const data = (await res.json()) as { story?: StoryblokStory };
    const story = data.story;
    if (!story) return null;
    const out: WalkOut = { headings: [], body: [] };
    walkStoryblok(story.content, out);

    const findField = (component: string, field: string): string => {
      const blocks = story.content?.blocks ?? story.content?.body ?? [];
      const blk = Array.isArray(blocks)
        ? blocks.find((b) => (b as { component?: string })?.component === component)
        : null;
      const v = (blk as Record<string, unknown> | undefined)?.[field];
      return typeof v === "string" ? v : "";
    };

    return {
      name: story.name ?? "",
      pageTitle: findField("n4-meta-information", "page_title") || (story.name ?? ""),
      metaDesc: findField("n4-meta-information", "meta_description"),
      headings: out.headings,
      body: out.body,
    };
  } catch (err) {
    console.warn(`[seo] storyblok fetch failed for ${slug}:`, (err as Error).message);
    return null;
  }
}

async function fetchRenderedMeta(siteOrigin: string, urlPath: string): Promise<{
  title: string; h1: string; description: string; h2s: string[]; body: string;
}> {
  const url = new URL(urlPath, siteOrigin).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "HT-SEO-LHF/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return { title: "", h1: "", description: "", h2s: [], body: "" };
    const html = await res.text();
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const descM =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const h2s = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => stripHtml(m[1]));
    const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 60).map((m) => stripHtml(m[1]));
    return {
      title: stripHtml(titleM?.[1]),
      h1: stripHtml(h1M?.[1]),
      description: stripHtml(descM?.[1]),
      h2s,
      body: ps.join(" "),
    };
  } catch (err) {
    console.warn(`[seo] rendered fetch failed for ${url}:`, (err as Error).message);
    return { title: "", h1: "", description: "", h2s: [], body: "" };
  }
}

export async function fetchPageMeta(siteOrigin: string, urlPath: string, sbToken: string | undefined): Promise<PageMeta> {
  let sb = null;
  if (sbToken) sb = await fetchStoryblokStory(urlPath, sbToken);

  let title = "";
  let h1 = "";
  let description = "";
  let headings: Heading[] = [];
  let bodyText = "";
  let source: "storyblok" | "rendered" = "rendered";

  if (sb) {
    source = "storyblok";
    title = sb.pageTitle || sb.name;
    description = sb.metaDesc;
    headings = sb.headings;
    h1 = headings.find((h) => h.level === 1)?.text || sb.name;
    bodyText = sb.body.join(" ");
  } else {
    const html = await fetchRenderedMeta(siteOrigin, urlPath);
    title = html.title;
    h1 = html.h1;
    description = html.description;
    headings = html.h2s.map((t) => ({ level: 2, text: t }));
    bodyText = html.body;
  }

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
    titleTokens,
    bodyTokens,
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
