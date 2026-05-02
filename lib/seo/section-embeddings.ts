// Semantic-coverage scoring for the cluster classifier.
//
// The Phase 1B classifier got fooled by "phrase_in_body=0" → "topic missing"
// when a page like /best-hearing-aids has a literal H2 "How much do hearing
// aids cost?" but no exact occurrence of the substring "hearing aid price".
// This module embeds each page's topical surface (title, H1, description,
// every heading, sliding body chunks) and exposes a max-cosine helper so
// the classifier can distinguish "exact phrase missing" from "topic missing."
//
// Cost is negligible — on a ~5k-char body that's ~20 chunks plus headings,
// ≈100 sections per page × 100 pages = 10k texts × ~50 tokens each at
// $0.02/1M = ~$0.01 per full sync. Cheaper than one Haiku call.

import { embedQueries } from "./embed";
import type { PageMeta } from "./classify";

// Body chunking: 400-char windows with 100-char overlap so a phrase that
// straddles a boundary still appears intact in one chunk. With 1536-d
// text-embedding-3-small a 400-char chunk gives a clean topical fingerprint.
const BODY_CHUNK_CHARS = 400;
const BODY_CHUNK_OVERLAP = 100;

// Skip pages with bodies under this size — the title+headings alone are a
// better signal than a near-empty body chunk.
const MIN_BODY_FOR_CHUNKING = 200;

/** Build the list of texts that represent a page's topical surface. */
export function pageSectionTexts(meta: PageMeta): string[] {
  const out: string[] = [];

  // Page-level signals — high information density. The title and H1 alone
  // often suffice for "topic X is on this page."
  if (meta.title?.trim()) out.push(meta.title.trim());
  if (meta.h1?.trim() && meta.h1.trim() !== meta.title?.trim()) out.push(meta.h1.trim());
  if (meta.description?.trim()) out.push(meta.description.trim());

  // Each heading is its own topic signal. Long-form pages can have 30+
  // headings and we want each to have a chance to match a query.
  for (const h of meta.headings ?? []) {
    const t = h.text.trim();
    if (t.length > 0) out.push(t);
  }

  // Body chunks. Sliding window so phrases spanning a boundary still get
  // covered by exactly one chunk that contains them in full.
  const body = (meta.bodyText ?? "").trim();
  if (body.length >= MIN_BODY_FOR_CHUNKING) {
    const stride = BODY_CHUNK_CHARS - BODY_CHUNK_OVERLAP;
    for (let i = 0; i < body.length; i += stride) {
      const chunk = body.slice(i, i + BODY_CHUNK_CHARS).trim();
      if (chunk.length > 0) out.push(chunk);
      if (i + BODY_CHUNK_CHARS >= body.length) break;
    }
  } else if (body.length > 0) {
    // Short body — embed the whole thing as one section.
    out.push(body);
  }

  return out;
}

export type PageSectionEmbeddings = {
  /** page → array of embeddings, one per section text in pageSectionTexts() order. */
  embeddings: Map<string, number[][]>;
  /** Total input tokens consumed across the batched embedMany call. */
  tokens: number;
};

/**
 * Embed every page's section texts in one batched call. Caller passes the
 * full pageMetas map; pages with no usable text get no entry in the result.
 */
export async function embedPageSections(
  pageMetas: Map<string, PageMeta>,
): Promise<PageSectionEmbeddings> {
  const allTexts: string[] = [];
  // page → [start, end) slice into allTexts
  const indexByPage = new Map<string, [number, number]>();

  for (const [page, meta] of pageMetas) {
    const texts = pageSectionTexts(meta);
    if (texts.length === 0) continue;
    indexByPage.set(page, [allTexts.length, allTexts.length + texts.length]);
    allTexts.push(...texts);
  }

  if (allTexts.length === 0) {
    return { embeddings: new Map(), tokens: 0 };
  }

  const result = await embedQueries(allTexts);

  const out = new Map<string, number[][]>();
  for (const [page, [start, end]] of indexByPage) {
    out.set(page, result.embeddings.slice(start, end));
  }
  return { embeddings: out, tokens: result.inputTokens };
}

/** Cosine similarity between two equal-length dense vectors. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, aMag = 0, bMag = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }
  if (aMag === 0 || bMag === 0) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

/**
 * Max cosine similarity between a query embedding and any of the page's
 * section embeddings. The interpretation in coverage.ts is:
 *   ≥ 0.55  topic substantively covered (matches SEO_CLUSTER_COSINE_THRESHOLD)
 *   0.40-0.55  marginal; some sections allude to the topic
 *   < 0.40  topic genuinely missing — body extension is warranted
 */
export function topicCoverageScore(
  queryEmbedding: number[],
  sectionEmbeddings: number[][],
): number {
  if (sectionEmbeddings.length === 0) return 0;
  let best = 0;
  for (const s of sectionEmbeddings) {
    const c = cosine(queryEmbedding, s);
    if (c > best) best = c;
  }
  return best;
}
