// Tokenization, primary/supporting/secondary classification, and scoring.

const STOPWORDS = new Set([
  "a","an","the","of","for","to","in","on","at","by","from","with","and","or","but",
  "is","are","was","were","be","been","being","it","this","that","these","those",
  "i","you","we","they","he","she","my","your","our","their","its","as","if","than","then",
  "s","vs","via","about","can","do","does","how","what","why","when","where","which","who",
  "will","would","could","should","have","has","had",
]);

export function tokenize(s: string | null | undefined): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && t.length > 1);
}

export function stripHtml(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Heading = { level: number; text: string };

export type PageMeta = {
  url: string;
  source: "storyblok" | "rendered";
  title: string;
  h1: string;
  description: string;
  headings: Heading[];
  bodyText: string;
  titleTokens: Set<string>;
  bodyTokens: Set<string>;
  /**
   * Editor-managed last-update date pulled from the n4-article Storyblok
   * block's `updated` field (with `published` fallback). Only bumped on
   * meaningful updates, so it's a higher-signal staleness indicator than
   * the API-level `published_at`. Null for non-Storyblok pages or pages
   * without an n4-article block.
   */
  contentModifiedAt?: string | null;
  /**
   * Distinct HearingTracker-internal paths linked-to from this page's body.
   * Extracted from raw HTML before stripHtml() runs (anchor hrefs are lost
   * once HTML is stripped). Synthesizer inverts this graph in-memory to
   * compute inbound link counts for the internal_link_gap detector.
   */
  outboundInternalLinks?: string[];
};

export type KeywordKind = "primary" | "supporting" | "secondary";

export type Classification = {
  kind: KeywordKind;
  novelTokens: string[];
  phraseInBody: number;
  inHeading: boolean;
};

// Industry CTR-by-position curve (rough, US, mixed-intent).
export function expectedCtr(pos: number): number {
  const table: Record<number, number> = {
    1: 0.30, 2: 0.16, 3: 0.10, 4: 0.07, 5: 0.05,
    6: 0.04, 7: 0.03, 8: 0.025, 9: 0.02, 10: 0.018,
  };
  const k = Math.max(1, Math.min(10, Math.round(pos)));
  return table[k] ?? 0.01;
}

const TARGET_CTR = 0.10;

export function actionabilityScore(args: {
  pos: number; imp: number; ctr: number; kd: number | null;
}): number {
  const ctrGap = Math.max(0, TARGET_CTR - args.ctr);
  const missedClicks = args.imp * ctrGap;
  // Unknown KD → 0.7 multiplier (common for low-volume long-tails DataForSEO lacks data on)
  const kdMult = args.kd == null ? 0.7 : Math.max(0.1, 1 - args.kd / 100);
  const posMult = args.pos <= 5 ? 1.2 : args.pos <= 8 ? 1.0 : 0.8;
  return missedClicks * kdMult * posMult;
}

// Classify a keyword vs a page's metadata.
//   primary    = all query tokens appear in title / H1 / meta description
//   supporting = query tokens missing from title but appear in body content
//   secondary  = query tokens missing from page entirely (page ranks "by accident")
export function classifyKeyword(query: string, meta: PageMeta): Classification {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return { kind: "primary", novelTokens: [], phraseInBody: 0, inHeading: false };
  }
  const novelToTitle = queryTokens.filter((t) => !meta.titleTokens.has(t));
  const novelToBody = queryTokens.filter((t) => !meta.bodyTokens.has(t));

  let kind: KeywordKind;
  if (novelToTitle.length === 0) kind = "primary";
  else if (novelToBody.length === 0) kind = "supporting";
  else kind = "secondary";

  // Exact phrase mentions in body
  const haystack = (meta.bodyText ?? "").toLowerCase();
  const needle = query.toLowerCase().trim();
  let phraseInBody = 0;
  if (needle.length >= 3) {
    let idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
      phraseInBody++;
      idx += needle.length;
    }
  }

  // In any heading?
  const inHeading = (meta.headings ?? []).some((h) => h.text.toLowerCase().includes(needle));

  return { kind, novelTokens: novelToTitle, phraseInBody, inHeading };
}
