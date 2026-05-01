// Cluster coverage classification via Haiku.
//
// One LLM call per cluster. Inputs: the cluster's queries (with cheap
// phrase-in-body / in-heading signals from Phase 1A), aggregate metrics
// (avg position, weighted CTR vs expected CTR), and the page itself
// (title, meta, heading outline, body text). Output: a structured kind
// from the cp_seo_opportunity_kinds set + a 1–3 sentence recommendation
// for the editor + a confidence score.
//
// The classifier picks from FIVE mutually-exclusive editorial states. The
// DB enum has seven; the two it doesn't emit are intentional:
//   • needs_review — pre-classification / fallback only.
//   • freshness — requires date signals the body-text snapshot doesn't
//     carry; reserved for a follow-up date-aware pass.
//
// Model selection mirrors label.ts: SEO_COVERAGE_MODEL takes precedence,
// then falls back to SEO_LABEL_MODEL so a single env can drive both. The
// 'anthropic/' gateway prefix is stripped before handing to @ai-sdk/anthropic.

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { Heading } from "./classify";

export const COVERAGE_KINDS = [
  "coverage_strong",
  "coverage_partial",
  "intent_gap",
  "wrong_page",
  "snippet_ctr",
  "consolidate",
  "cede",
] as const;
export type CoverageKind = (typeof COVERAGE_KINDS)[number];

const CoverageSchema = z.object({
  kind: z.enum(COVERAGE_KINDS).describe(
    [
      "coverage_strong: the page already answers what the queries are asking. Just monitor.",
      "coverage_partial: the page touches the topic but doesn't fully answer the cluster's intent. Extend the page.",
      "intent_gap: the page barely addresses the cluster's intent at all. Add a new section.",
      "wrong_page: the cluster is genuinely about a different topic that belongs on a different page; do not add it here.",
      "snippet_ctr: the page does answer it and ranks reasonably, but the title/meta likely undersells the topic. Improve the snippet, not the body.",
      "consolidate: multiple HearingTracker pages compete for these queries; THIS page should win and the others should de-target.",
      "cede: multiple HearingTracker pages compete; ANOTHER page is the better target; don't optimize this one.",
    ].join(" | "),
  ),
  recommendation: z
    .string()
    .describe(
      "1–3 short sentences (max ~500 chars) telling the editor what to do, in concrete terms. Reference at least one anchor query by name. No filler ('Consider…', 'You could…').",
    ),
  // Anthropic's structured-output schema rejects min/max on number; we clamp
  // to [0,1] in code after the call. Keep the description tight so the model
  // returns a clean fraction.
  confidence: z
    .number()
    .describe(
      "Decimal between 0 and 1. Lower confidence (<0.6) means the page+queries don't give a clear signal — admin should review.",
    ),
});

export const COVERAGE_PROMPT_VERSION =
  process.env.SEO_COVERAGE_PROMPT_VERSION ?? "v1";

function resolveModelId(): string {
  const raw = process.env.SEO_COVERAGE_MODEL ?? process.env.SEO_LABEL_MODEL;
  if (!raw) throw new Error("SEO_COVERAGE_MODEL or SEO_LABEL_MODEL must be set");
  return raw.replace(/^anthropic\//, "");
}

const SYSTEM_PROMPT = `You are an SEO content strategist deciding what an editor should do about a cluster of search queries that a specific page is partially ranking for.

You will be given:
- The page's URL, title, meta description, and heading outline.
- The page's body text (may be truncated).
- A cluster of related Google Search Console queries the page ranks for in striking distance (positions 4–15), with cheap signals about whether each phrase appears in the body or in a heading.
- Aggregate ranking and CTR metrics for the cluster.
- Anchor queries — the cluster's deterministically ranked top 3–5 low-hanging-fruit queries (high volume / low difficulty / close to top of striking distance). The recommendation MUST explicitly name at least one anchor query in the wording.
- Cannibalization signals — for any cluster member that ALSO ranks in striking distance on OTHER HearingTracker pages, the list of competing page URLs.

Your job: pick exactly one of these seven editorial states, and write 1–3 short sentences telling the editor what to do.

States (mutually exclusive — pick the BEST fit):
1. coverage_strong — The page already meaningfully answers the cluster's intent. Recommend monitoring; don't recommend body changes.
2. coverage_partial — The page touches on this topic but doesn't fully answer it. Recommend extending an existing section with the missing angles.
3. intent_gap — The page barely addresses this cluster's intent. Recommend adding a NEW section (or sub-page) on the topic.
4. wrong_page — The cluster is genuinely about a different topic that belongs on a different page (e.g. queries are about a different brand, product, or task that has no overlap with this page). Recommend writing elsewhere.
5. snippet_ctr — The body genuinely answers the queries AND average rank is reasonable (≤8) but actual CTR is well below expected CTR. The fix is the title/meta, not the body. Use this sparingly — only when body coverage is clearly strong.
6. consolidate — Cannibalization is present (other pages compete for these queries) AND this page is the strongest target — same brand/topic, more depth. Recommend claiming the topic here and de-targeting the sibling pages (e.g. trim overlapping sections, internal-link toward this one).
7. cede — Cannibalization is present AND a sibling page looks like the stronger target. Recommend ceding here (don't add coverage on this page; let the sibling rank).

Decision guidance:
- Prefer coverage_partial over intent_gap when at least one heading or body passage already addresses a sibling angle of the cluster.
- Prefer wrong_page over cede when there is NO cannibalization signal — wrong_page means "not the right topic for this page," cede means "right topic, wrong page."
- Pick consolidate or cede ONLY when at least one anchor or member query has competing pages listed.
- Use snippet_ctr only when coverage is genuinely strong AND CTR is materially below expected.
- Do NOT pick snippet_ctr if body coverage is weak; pick coverage_partial or intent_gap instead.
- Recommendations must reference at least one anchor query by name and be specific to the topic — no generic SEO advice.
- Confidence < 0.6 if the page content is too thin to judge or the cluster is ambiguous.`;

// ─── Deterministic anchor ranking ───────────────────────────────────────────
// "Low-hanging fruit" within a cluster: high volume / low difficulty /
// close to the top of the striking-distance window. Computed in code so
// it's reproducible across syncs and the LLM has a fixed target to write
// recommendations against.

const STRIKING_DISTANCE_WINDOW = 16; // pos 4 → ~0.75, pos 14 → ~0.125, pos ≥16 → 0

export function strikingDistanceFactor(position: number | null | undefined): number {
  if (position == null) return 0;
  return Math.max(0, (STRIKING_DISTANCE_WINDOW - position) / STRIKING_DISTANCE_WINDOW);
}

export type AnchorCandidate = {
  query: string;
  position: number | null;
  volume: number | null;
  kd: number | null;
};

/**
 * Rank candidates by volume / max(kd, 1) × striking_distance_factor and
 * return the top N. KD nulls fall back to 50 (neutral mid-difficulty); volume
 * nulls fall back to 0 so missing-data members don't outrank real signals.
 * Ties broken by query length asc (shorter = often the head term).
 */
export function rankAnchorQueries(
  candidates: AnchorCandidate[],
  topN = 5,
): { query: string; score: number }[] {
  const scored = candidates.map((c) => {
    const vol = c.volume ?? 0;
    const kd = Math.max(c.kd ?? 50, 1);
    const sd = strikingDistanceFactor(c.position);
    return { query: c.query, score: (vol / kd) * sd };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.query.length - b.query.length;
  });
  return scored.slice(0, topN).filter((s) => s.score > 0);
}

// Body text can be enormous on long-form pages. 3.5k chars (~900 tokens) is
// enough for the model to gauge depth of coverage on a topic without blowing
// the per-minute input-token budget at concurrency.
const MAX_BODY_CHARS = 3500;

function truncateBody(body: string, max = MAX_BODY_CHARS): string {
  if (body.length <= max) return body;
  // Cut at last sentence boundary within the window so the snippet ends mid-thought less often.
  const slice = body.slice(0, max);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
  if (lastStop > max * 0.6) return slice.slice(0, lastStop + 1) + " […]";
  return slice + " […]";
}

function formatHeadings(headings: Heading[] | null | undefined): string {
  if (!headings || headings.length === 0) return "(no headings detected)";
  return headings
    .filter((h) => h.text.trim().length > 0)
    .map((h) => `${"#".repeat(Math.max(1, Math.min(6, h.level)))} ${h.text.trim()}`)
    .join("\n");
}

export type CoverageMemberSignal = {
  query: string;
  phrase_in_body: number;
  in_heading: boolean;
  /** Other revenue pages that ALSO rank in striking distance for this query. */
  competing_pages?: string[];
};

export type CoverageAnchor = {
  query: string;
  /** Deterministic priority score (volume / max(kd,1) × striking_distance_factor). */
  score: number;
};

export type CoverageInput = {
  page: string;
  pageTitle: string | null;
  metaDescription: string | null;
  headings: Heading[];
  bodyText: string;

  clusterLabel: string;
  canonicalQuery: string;
  isBranded: boolean;
  brand: string | null;
  retailer: string | null;
  productFamily: string | null;
  ahrefsIntentPrior: string | null;

  members: CoverageMemberSignal[];

  /** Top 3–5 anchor queries the recommendation should name. Determined in code. */
  anchors: CoverageAnchor[];

  // Cluster-level metrics that help separate snippet_ctr from coverage_partial.
  avgPosition: number | null;
  weightedCtrPct: number | null;
  expectedCtrPct: number | null;
};

export type CoverageResult = {
  kind: CoverageKind;
  recommendation: string;
  confidence: number;
  modelId: string;
  promptVersion: string;
  audit: {
    prompt_version: string;
    page: string;
    cluster_label: string;
    canonical_query: string;
    member_count: number;
    body_chars_seen: number;
    body_truncated: boolean;
    heading_count: number;
    avg_position: number | null;
    weighted_ctr_pct: number | null;
    expected_ctr_pct: number | null;
    anchor_queries: string[];
    cannibal_member_count: number;
  };
  tokens: { input: number; output: number };
};

export async function classifyClusterCoverage(input: CoverageInput): Promise<CoverageResult> {
  if (input.members.length === 0) {
    throw new Error("classifyClusterCoverage: members cannot be empty");
  }

  const modelId = resolveModelId();
  const truncatedBody = truncateBody(input.bodyText ?? "");
  const bodyTruncated = (input.bodyText ?? "").length > truncatedBody.length;

  const anchorSet = new Set(input.anchors.map((a) => a.query));
  const memberLines = input.members.map((m) => {
    const flags: string[] = [];
    if (anchorSet.has(m.query)) flags.push("ANCHOR");
    if (m.phrase_in_body > 0) flags.push(`phrase×${m.phrase_in_body} in body`);
    if (m.in_heading) flags.push("in heading");
    if (m.competing_pages && m.competing_pages.length > 0) {
      flags.push(`also ranks on: ${m.competing_pages.join(", ")}`);
    }
    if (flags.length === 0) flags.push("not in body");
    return `- "${m.query}" (${flags.join(", ")})`;
  });

  const cannibalMemberCount = input.members.filter(
    (m) => (m.competing_pages?.length ?? 0) > 0,
  ).length;

  const ctrLine = (() => {
    if (input.weightedCtrPct == null || input.expectedCtrPct == null) return "(unknown)";
    const diff = input.weightedCtrPct - input.expectedCtrPct;
    const tag = diff < -0.5 ? "below expected" : diff > 0.5 ? "above expected" : "near expected";
    return `${input.weightedCtrPct.toFixed(2)}% actual vs ${input.expectedCtrPct.toFixed(2)}% expected (${tag})`;
  })();

  const userParts: string[] = [
    `Page URL: ${input.page}`,
    `Page title: ${input.pageTitle ?? "(empty)"}`,
    `Meta description: ${input.metaDescription ?? "(empty)"}`,
    "",
    "Heading outline:",
    formatHeadings(input.headings),
    "",
    "Body text:",
    truncatedBody.length > 0 ? truncatedBody : "(empty)",
    "",
    `Cluster: "${input.clusterLabel}"`,
    `Canonical query: "${input.canonicalQuery}"`,
  ];

  if (input.isBranded && input.brand) {
    userParts.push(`Branded cluster — brand: ${input.brand}`);
  }
  if (input.retailer) userParts.push(`Retailer context: ${input.retailer}`);
  if (input.productFamily) userParts.push(`Product family: ${input.productFamily}`);
  if (input.ahrefsIntentPrior) userParts.push(`Ahrefs intent prior: ${input.ahrefsIntentPrior}`);

  userParts.push(
    "",
    `Anchor queries (top ${input.anchors.length} by volume / kd / striking distance — recommendation MUST name at least one):`,
    ...input.anchors.map((a) => `- "${a.query}"  (priority ${a.score.toFixed(1)})`),
    "",
    `Cluster member queries (${input.members.length}):`,
    ...memberLines,
    "",
    "Cluster metrics:",
    `- avg rank: ${input.avgPosition != null ? `#${input.avgPosition.toFixed(1)}` : "—"}`,
    `- CTR: ${ctrLine}`,
    `- cannibalization: ${cannibalMemberCount > 0 ? `${cannibalMemberCount} member(s) ALSO rank on other pages — see member lines` : "none detected"}`,
  );

  const result = await generateObject({
    model: anthropic(modelId),
    schema: CoverageSchema,
    system: SYSTEM_PROMPT,
    prompt: userParts.join("\n"),
  });

  return {
    kind: result.object.kind,
    recommendation: result.object.recommendation.trim(),
    confidence: Math.max(0, Math.min(1, result.object.confidence)),
    modelId,
    promptVersion: COVERAGE_PROMPT_VERSION,
    audit: {
      prompt_version: COVERAGE_PROMPT_VERSION,
      page: input.page,
      cluster_label: input.clusterLabel,
      canonical_query: input.canonicalQuery,
      member_count: input.members.length,
      body_chars_seen: truncatedBody.length,
      body_truncated: bodyTruncated,
      heading_count: input.headings.length,
      avg_position: input.avgPosition,
      weighted_ctr_pct: input.weightedCtrPct,
      expected_ctr_pct: input.expectedCtrPct,
      anchor_queries: input.anchors.map((a) => a.query),
      cannibal_member_count: cannibalMemberCount,
    },
    tokens: {
      input: result.usage?.inputTokens ?? 0,
      output: result.usage?.outputTokens ?? 0,
    },
  };
}

/**
 * Concurrency-controlled bulk classifier. Lower default than label.ts (2 vs 5)
 * because each prompt carries the page body (~1k tokens) plus member queries
 * and competing pages — at concurrency 5 the burst overruns Haiku's 50k
 * input-tokens-per-minute org limit on first-tier accounts.
 */
export async function classifyClustersConcurrently(
  inputs: CoverageInput[],
  opts: { concurrency?: number; onResult?: (i: number, r: CoverageResult) => void } = {},
): Promise<CoverageResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 2);
  const results: CoverageResult[] = new Array(inputs.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= inputs.length) return;
      const r = await classifyClusterCoverage(inputs[i]);
      results[i] = r;
      opts.onResult?.(i, r);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, worker);
  await Promise.all(workers);
  return results;
}
