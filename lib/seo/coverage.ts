// Cluster coverage classification via Haiku.
//
// One LLM call per cluster. Inputs: the cluster's queries (with cheap
// phrase-in-body / in-heading signals from Phase 1A), aggregate metrics
// (avg position, weighted CTR vs expected CTR), and the page itself
// (title, meta, heading outline, body text). Output: a structured kind
// from the cp_seo_opportunity_kinds set + a 1–3 sentence recommendation
// for the editor + a confidence score.
//
// The classifier picks from SEVEN mutually-exclusive editorial states
// (COVERAGE_KINDS_LLM below). The DB enum has nine total; the two the
// classifier never emits are intentional:
//   • needs_review — pre-classification / fail-soft fallback only.
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

// Kinds the LLM is allowed to emit. needs_review is the system-emitted
// fallback (e.g. when classification times out / fails) and is intentionally
// excluded from the LLM enum.
export const COVERAGE_KINDS_LLM = [
  "coverage_strong",
  "coverage_partial",
  "intent_gap",
  "wrong_page",
  "snippet_ctr",
  "consolidate",
  "cede",
  "ai_overview_loss",
] as const;
export const COVERAGE_KINDS = [...COVERAGE_KINDS_LLM, "needs_review"] as const;
export type CoverageKind = (typeof COVERAGE_KINDS)[number];

const CoverageSchema = z.object({
  kind: z.enum(COVERAGE_KINDS_LLM).describe(
    [
      "coverage_strong: the page already answers what the queries are asking. Just monitor.",
      "coverage_partial: the page touches the topic but doesn't fully answer the cluster's intent. Extend the page.",
      "intent_gap: the page barely addresses the cluster's intent at all. Add a new section.",
      "wrong_page: the cluster is genuinely about a different topic that belongs on a different page; do not add it here.",
      "snippet_ctr: the page does answer it and ranks reasonably, but the title/meta likely undersells the topic. Improve the snippet, not the body.",
      "consolidate: multiple HearingTracker pages compete for these queries; THIS page should win and the others should de-target.",
      "cede: multiple HearingTracker pages compete; ANOTHER page is the better target; don't optimize this one.",
      "ai_overview_loss: the page ranks reasonably (≤8) but the SERP shows an AI Overview AND HearingTracker is NOT cited in the AIO panel. The lever is passage-level GEO (rewrite for AIO-citation patterns: front-loaded factual answers, source attribution, structured passages), not snippet or body coverage.",
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
  start_with: z
    .array(z.string())
    .describe(
      "1–3 anchor queries the editor should target FIRST. Pick from the anchor list. EXCLUDE any anchor the page already substantively covers AND any that should be ceded to a competing page. Empty array is valid for kind=coverage_strong, wrong_page, or cede (nothing to start with on this page).",
    ),
});

// v1: initial — flags only, opaque anchor priority score.
// v2: adds per-query KD/volume/position/impressions, LH-fruit directive,
//     "judge coverage from body/headings, flags are hints" guidance.
// v3: body now includes markdown tables and [block: <component>] markers from
//     Storyblok; body cap raised 3.5k → 8k chars so structure isn't truncated.
// v4: listicle pages get an [auto-rendered: …] marker for the runtime-rendered
//     comparison table that doesn't live in Storyblok JSON.
// v5: LLM emits start_with — its curated 1–3 anchors after excluding ones the
//     page already covers or should cede. UI highlights only these instead of
//     the full deterministic anchor list.
// v6: prompt handles the no-anchor case explicitly; post-call normalization
//     enforces consolidate/cede only with cannibalization, empty start_with
//     for coverage_strong/wrong_page/cede, and a fallback anchor + confidence
//     ceiling for actionable kinds returned with empty start_with.
// v7: competing_pages is SERP-verified (only URLs in live top-20 are passed,
//     forum subdomain dropped) AND each competitor is annotated with the
//     queries it currently wins on this site. New rule: consolidate must
//     acknowledge what the de-target sibling wins; if a sibling has any
//     anchor at pos ≤10 with KD ≤20, prefer coverage_strong/snippet_ctr
//     over consolidate.
// v8: each member carries `topic_coverage_score` (max cosine between the
//     query embedding and any of the page's section embeddings). Fixes the
//     v7 failure mode where the model recommended adding a "pricing section"
//     to a page that already had an H2 "How much do hearing aids cost?".
//     phrase_in_body now means literal-string match only; topic coverage is
//     judged from the cosine score. Body additions only when BOTH are low.
// v9: each anchor carries AI Overview presence + HT-cited annotations from
//     live SERPs. New kind `ai_overview_loss` for pages that rank well but
//     lose the click to AIO without being cited. Snippet_ctr forbidden when
//     AIO suppresses the dominant-impression queries. Cluster-level
//     `clusterAioImpressionShare` lets the model discount the standard
//     expected-CTR baseline by AIO suppression.
// v10: per-query CTR (actual + position-conditional expected) on each member.
//     New `hopelessQueries` list — queries at pos ≥10 whose impressions
//     dominate the cluster (cumulative ≥50%). Snippet_ctr forbidden when
//     hopelessQueries covers >50% of impressions and no page-1 query has a
//     real CTR gap. Prevents the v9 failure where snippet_ctr fired on a
//     cluster whose CTR gap was 77%-driven by one borderline-page-2 query.
// v11: each anchor carries `external_canonical` when a different HearingTracker
//     URL ranks ≤10 in the live SERP. Forbid recommendations that bolt that
//     anchor's topic onto this page (cross-cluster cannibalization). When
//     EVERY anchor has an external canonical, force `cede` regardless of
//     body coverage.
// v12: tighten the `ai_overview_loss` × `external_canonical` interaction.
//     v11's "MUST cite which anchors lose the click to AIO" requirement
//     could be satisfied by citing canonical-owned anchors, which violated
//     rule 161. v12 makes rule 161 take explicit precedence over every
//     other MUST-cite obligation in the prompt: anchors with an external
//     canonical are off-limits as citation targets even when AIO-suppressed,
//     and `ai_overview_loss` is only eligible if at least one non-canonical
//     AIO-suppressed anchor exists. Otherwise prefer `cede`.
// v13: v12 was only partially effective — the model still named canonical
//     anchors in the recommendation prose (interpreting "cite ONLY
//     non-canonical" as "the action targets non-canonical, but other
//     anchors can be mentioned"). v13 replaces the prose rule with two
//     concrete worked examples (a WRONG one matching the v12 failure and
//     a RIGHT one demonstrating the deferral pattern) so the model
//     learns the distinction by example, not by inference.
export const COVERAGE_PROMPT_VERSION =
  process.env.SEO_COVERAGE_PROMPT_VERSION ?? "v13";

function resolveModelId(): string {
  const raw = process.env.SEO_COVERAGE_MODEL ?? process.env.SEO_LABEL_MODEL;
  if (!raw) throw new Error("SEO_COVERAGE_MODEL or SEO_LABEL_MODEL must be set");
  return raw.replace(/^anthropic\//, "");
}

const SYSTEM_PROMPT = `You are an SEO content strategist deciding what an editor should do about a cluster of search queries that a specific page is partially ranking for.

You will be given:
- The page's URL, title, meta description, and heading outline.
- The page's body text (may be truncated).
- A cluster of related Google Search Console queries the page ranks for in striking distance (positions 4–15), with TWO body-coverage signals per query: (a) "phrase×N in body" — exact-string occurrences of the literal query in the body text; (b) "topic NN%" — semantic max-cosine between the query embedding and the page's section embeddings (title, H1, every heading, body chunks). A topic score ≥55% means the page already has a section addressing that topic even if the literal phrase isn't there.
- Aggregate ranking and CTR metrics for the cluster.
- Anchor queries — the cluster's deterministically ranked top 3–5 low-hanging-fruit queries (high volume / low difficulty / close to top of striking distance). The recommendation MUST explicitly name at least one anchor query in the wording.
- Cannibalization signals — for any cluster member that ALSO ranks in the LIVE top-20 organic SERP via another HearingTracker page, the competitor URL plus the queries that competitor currently wins (its strongest in-cluster rankings on this site). These are SERP-verified, not GSC-noise: a URL listed here is genuinely competing.
- AI Overview signals — for each anchor query, whether the live SERP shows an AI Overview panel and whether THIS page is cited as one of the AIO sources. AI Overviews suppress organic CTR by ~30–60%; if a majority of cluster impressions sit on AIO-present queries, the standard expected-CTR baseline overstates the achievable ceiling. The cluster summary "AIO on N of M anchors (P% of cluster impressions)" tells you how dominant the AIO suppression is.
- External canonical signals — for any anchor where a DIFFERENT HearingTracker URL ranks ≤10 in the live SERP, the anchor line carries an "EXTERNAL CANONICAL: <url> at #N" annotation. The canonical owner of the topic already exists on the site; recommending body additions, snippet changes, or start_with for that anchor on THIS page would cannibalize the canonical. Defer to the canonical instead.

Your job: pick exactly one of these eight editorial states, and write 1–3 short sentences telling the editor what to do.

States (mutually exclusive — pick the BEST fit):
1. coverage_strong — The page already meaningfully answers the cluster's intent. Recommend monitoring; don't recommend body changes.
2. coverage_partial — The page touches on this topic but doesn't fully answer it. Recommend extending an existing section with the missing angles.
3. intent_gap — The page barely addresses this cluster's intent. Recommend adding a NEW section (or sub-page) on the topic.
4. wrong_page — The cluster is genuinely about a different topic that belongs on a different page (e.g. queries are about a different brand, product, or task that has no overlap with this page). Recommend writing elsewhere.
5. snippet_ctr — The body genuinely answers the queries AND average rank is reasonable (≤8) AND there's at least one query with a real CTR gap that AIO is NOT suppressing. The fix is the title/meta, not the body. Use this sparingly — only when body coverage is clearly strong.
6. consolidate — Cannibalization is present (other pages compete for these queries) AND this page is the strongest target — same brand/topic, more depth. Recommend claiming the topic here and de-targeting the sibling pages (e.g. trim overlapping sections, internal-link toward this one).
7. cede — Cannibalization is present AND a sibling page looks like the stronger target. Recommend ceding here (don't add coverage on this page; let the sibling rank).
8. ai_overview_loss — The page ranks reasonably (≤8) but the live SERP shows an AI Overview AND this page is NOT cited in the AIO panel. The lever is passage-level GEO (rewrite content to match AIO-citation patterns: front-loaded factual answers near the top of the page, structured passages, source-friendly attribution, table-form data that mirrors AIO answer structure), NOT snippet rewriting and NOT body extensions. Recommendations should call out which anchors lose the click to AIO and propose a specific GEO change.

Decision guidance:
- Prefer coverage_partial over intent_gap when at least one heading or body passage already addresses a sibling angle of the cluster.
- Prefer wrong_page over cede when there is NO cannibalization signal — wrong_page means "not the right topic for this page," cede means "right topic, wrong page."
- Pick consolidate or cede ONLY when at least one anchor or member query has competing pages listed.
- Before recommending consolidate, you MUST acknowledge in the recommendation what each de-target sibling currently wins (cite a winning query by name). If ANY listed competitor wins an anchor-tier query (pos ≤10 AND KD ≤20), prefer coverage_strong or snippet_ctr instead — that sibling is doing its job and de-targeting it would forfeit real traffic.
- Use snippet_ctr only when ALL of: (a) coverage is genuinely strong, (b) at least one cluster member at pos ≤8 has a real per-query CTR gap (its own actual CTR is materially below the position-conditional expected CTR shown on its line), (c) AIO is NOT suppressing the dominant-impression queries — if AIO covers ≥50% of cluster impressions, the cluster's headline CTR gap is partly structural, AND (d) the "Hopeless queries" cluster-metric line shows none, OR shows a set covering <50% of cluster impressions. The cluster-weighted CTR gap alone is NOT sufficient justification — a snippet rewrite cannot move CTR on a query at pos ≥10. When recommending snippet_ctr, the prose MUST cite which page-1 query has the recoverable CTR gap.
- Do NOT pick snippet_ctr if body coverage is weak; pick coverage_partial or intent_gap instead.
- Do NOT pick snippet_ctr if the "Hopeless queries" line covers ≥50% of cluster impressions AND no member at pos ≤8 has a CTR gap. The CTR gap is structural; coverage_strong is the correct verdict (page is doing what it can; the head-term rank ceiling is the lever, which is out of scope for this classifier).
- Pick ai_overview_loss when: ≥1 anchor WITHOUT an external canonical has AIO present AND this page is NOT cited on those AIO panels AND avg rank ≤8. The recommendation MUST cite at least one such non-canonical AIO-suppressed anchor by name and propose a specific GEO change (e.g. "lead with a 1-sentence price range near the H1 to mirror the AIO answer pattern"). Do NOT recommend snippet rewrites or body extensions in this state — they don't move the needle when the click never reaches the organic result. If EVERY AIO-suppressed anchor has an external canonical, do NOT pick ai_overview_loss; pick "cede" and name the canonical(s) instead — the AIO opportunity for those queries belongs to the canonical pages.
- AIO suppression discount: when an anchor has AIO present, treat its expected CTR as roughly half the curve baseline. Do not budget against the full CTR gap.
- External canonical rule: anchors annotated with EXTERNAL CANONICAL must NOT appear in start_with. The recommendation prose MUST NOT propose body additions, snippet rewrites, schema changes, or any other on-page optimization targeting those anchors — the canonical page is winning the SERP and any optimization here cannibalizes it. This rule takes precedence over every other "MUST cite" or "MUST name" requirement in this prompt (including ai_overview_loss's anchor-citation requirement). When a state's MUST-cite obligation can only be satisfied by a canonical-owned anchor, the correct verdict is to switch states (typically to "cede"), not to violate this rule.
- Canonical anchors in prose — strict pattern. A canonical-owned anchor MUST NOT appear in the prose as part of any "rewrite to recover X / cite Y / target Z" claim, EVEN AS A LISTED ITEM among other anchors. The ONLY acceptable way to mention a canonical-owned anchor is as an explicit DEFERRAL that names the canonical URL it belongs to. Worked examples:
  WRONG (lumps canonical anchors into the recovery action — even though it cites a non-canonical anchor "hearing aids over the counter" too, the prose treats all three as joint recovery targets):
  > "Three anchors—'hearing aids over the counter', 'hearing aid cost', and 'affordable hearing aids'—show AI Overview panels without HearingTracker citation. Rewrite the page to front-load a 1-2 sentence factual summary answering each query…"
  RIGHT (recovery action targets ONLY the non-canonical anchor; canonical anchors are cited only with their canonical URL as a deferral):
  > "Anchor 'hearing aids over the counter' (pos 11) shows AI Overview without HT citation — rewrite the top of the page with a 1-sentence OTC pricing summary to mirror the AIO answer pattern. ('hearing aid cost' and 'affordable hearing aids' are also AIO-suppressed but their canonicals are /how-much-do-hearing-aids-cost and /hearing-aids/affordable-hearing-aids respectively — defer those.)"
  The structural test: every canonical-anchor mention in the prose must be either (a) absent, or (b) accompanied by the canonical URL and the word "defer", "canonical", or "owned by". If you cannot satisfy this, drop the canonical anchors from the prose entirely.
- If EVERY anchor in the cluster has an external canonical, pick "cede" regardless of body coverage — this is the wrong page for this cluster and any on-page optimization here cannibalizes a sibling that's already winning.
- Recommendations must reference at least one anchor query by name and be specific to the topic — no generic SEO advice.
- When recommending content additions, the named anchors should be queries the page does NOT already cover well. Use the "topic NN%" semantic score as the primary coverage verdict: ≥55% = topic substantively covered (do NOT recommend adding content for it); 40–55% = marginal (an extension may help); <40% = topic genuinely missing (a new section is warranted). The "phrase×N in body" count and "in heading" flag are *literal*-string signals — useful for snippet/title decisions but NEVER on their own a reason to claim a topic is missing. If a query has phrase×0 but topic ≥55%, the topic is covered; the fix (if any) is the title/meta wording, not new body content. If every high-priority anchor scores ≥55%, prefer coverage_strong (rank well already) or snippet_ctr (rank well + bad CTR).
- Use the per-query KD, volume, position, and impressions in the member/anchor lines to identify true low-hanging fruit. Call out specific queries by name in the recommendation, framed by why they're the easy wins (low KD, decent volume, already in striking distance).
- "start_with" output: pick the 1–3 anchor queries the editor should attack FIRST. EXCLUDE any anchor whose topic the page already substantively covers (those need no new content), AND any anchor that should be ceded to a competing page. The recommendation prose and start_with must be consistent — don't say "start with X" in the prose if X is excluded from start_with. Empty start_with is correct for coverage_strong, wrong_page, and cede.
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

// Body text can be enormous on long-form pages. 8k chars (~2k tokens) gives
// the model enough room to see markdown tables and structural [block:…]
// markers in full while staying well under Tier 2 per-minute token budgets at
// concurrency 10 (peak ~50k ITPM).
const MAX_BODY_CHARS = 8000;

function truncateBody(body: string, max = MAX_BODY_CHARS): string {
  if (body.length <= max) return body;
  // Cut at last sentence boundary within the window so the snippet ends mid-thought less often.
  const slice = body.slice(0, max);
  const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
  if (lastStop > max * 0.6) return slice.slice(0, lastStop + 1) + " […]";
  return slice + " […]";
}

function summarizeHopelessQueries(input: {
  hopelessQueries: CoverageInput["hopelessQueries"];
  members: CoverageMemberSignal[];
}): {
  hopeless_query_count: number;
  hopeless_impression_share: number;
  top_impression_query: string | null;
} {
  const hopelessShare = input.hopelessQueries.reduce(
    (s, q) => s + q.impression_share,
    0,
  );
  let topQ: string | null = null;
  let topImp = 0;
  for (const m of input.members) {
    const imp = m.impressions ?? 0;
    if (imp > topImp) { topImp = imp; topQ = m.query; }
  }
  return {
    hopeless_query_count: input.hopelessQueries.length,
    hopeless_impression_share: Math.round(hopelessShare * 1000) / 1000,
    top_impression_query: topQ,
  };
}

function summarizeTopicScores(members: { topic_coverage_score?: number | null }[]): {
  topic_score_min: number | null;
  topic_score_median: number | null;
  topic_score_max: number | null;
} {
  const scores = members
    .map((m) => m.topic_coverage_score)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (scores.length === 0) {
    return { topic_score_min: null, topic_score_median: null, topic_score_max: null };
  }
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  return {
    topic_score_min: round3(scores[0]),
    topic_score_median: round3(scores[Math.floor(scores.length / 2)]),
    topic_score_max: round3(scores[scores.length - 1]),
  };
}

function formatHeadings(headings: Heading[] | null | undefined): string {
  if (!headings || headings.length === 0) return "(no headings detected)";
  return headings
    .filter((h) => h.text.trim().length > 0)
    .map((h) => `${"#".repeat(Math.max(1, Math.min(6, h.level)))} ${h.text.trim()}`)
    .join("\n");
}

/** A SERP-verified competitor for one cluster member query. */
export type CompetingPage = {
  /** Full URL of the competing HearingTracker page. */
  url: string;
  /**
   * Queries this competitor currently wins on this site (its top-of-site
   * positions in the cluster, restricted to pos ≤10). Empty/undefined when
   * the competitor has no strong wins to defend — in which case consolidate
   * is a safer recommendation.
   */
  wins?: Array<{
    query: string;
    position: number;
    kd: number | null;
    volume: number | null;
  }>;
};

export type CoverageMemberSignal = {
  query: string;
  phrase_in_body: number;
  in_heading: boolean;
  /**
   * Max cosine similarity between this query's embedding and any of the page's
   * section embeddings (title, H1, description, every heading, body chunks).
   * 0–1 range. The semantic counterpart to `phrase_in_body`: closes the gap
   * where a page covers a topic without containing the literal query string.
   * `null` when the page has no embeddable text (rare).
   */
  topic_coverage_score?: number | null;
  /**
   * Other HearingTracker pages that ALSO rank in the LIVE top-20 organic for
   * this query. SERP-verified — GSC-only "ranks at pos 47 with 2 impressions"
   * noise is filtered out before this list is built.
   */
  competing_pages?: CompetingPage[];
  /** Per-query SEO signals so the LLM can identify low-hanging fruit. */
  kd: number | null;
  volume: number | null;
  position: number | null;
  impressions: number | null;
  /** Query-level GSC clicks. Used to compute per-query CTR. */
  clicks?: number | null;
  /** Query-level actual CTR as a percentage (0–100). */
  ctr_pct?: number | null;
  /**
   * POSITION-CONDITIONAL expected CTR as a percentage — `expectedCtr(position)
   * × 100`. NOT the cluster-weighted aggregate. The classifier needs the
   * per-position curve so it can tell "this query at pos 11 is structurally
   * stuck at ~1.8%" vs "this query at pos 5 has a real CTR gap."
   */
  expected_ctr_pct?: number | null;
};

export type CoverageAnchor = {
  query: string;
  /** Deterministic priority score (volume / max(kd,1) × striking_distance_factor). */
  score: number;
  /**
   * Set when a DIFFERENT HearingTracker URL ranks ≤10 in the live SERP for
   * this anchor query — the canonical owner of the topic on this site.
   * Recommending body additions, snippet rewrites, or `start_with` targeting
   * for this anchor would cannibalize the canonical's CTR. The page may still
   * rank for the same query, but it should NOT be optimized for it on THIS
   * page; defer to the canonical.
   */
  external_canonical?: {
    url: string;
    position: number;
    kd: number | null;
    volume: number | null;
  };
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

  /**
   * Per-anchor AI Overview presence pulled from live SERPs. `aiOverview` is
   * true when an AIO panel rendered for the query; `cited` is true when an
   * exact (host+path) match for this page's URL appears in the AIO source
   * list. Anchors without SERP data have no entry — interpret missing as
   * "unknown," not "AIO absent."
   */
  anchorAioPresence: Array<{
    query: string;
    aiOverview: boolean;
    cited: boolean;
  }>;

  /**
   * Share of the cluster's total impressions accounted for by anchor queries
   * with AIO present. 0–1. Used by the prompt to discount the standard
   * expected-CTR baseline — when AIO suppresses ~30–60% of organic CTR on a
   * majority of impressions, the cluster's "below expected CTR" gap is
   * partly structural and not recoverable via on-page changes.
   */
  clusterAioImpressionShare: number;

  /**
   * Queries at pos ≥10 whose cumulative impression share crosses 50% of the
   * cluster (sorted by impressions desc, taken until threshold). When non-empty,
   * the cluster's CTR gap is dominated by structurally-low-CTR queries that a
   * snippet rewrite cannot move — snippet_ctr is forbidden in that case.
   * The single-borderline-query case (one query >50% impressions at pos ≥10)
   * is the natural specialization.
   */
  hopelessQueries: Array<{
    query: string;
    impressions: number;
    impression_share: number;     // 0–1 of cluster impressions
    position: number;
    expected_ctr_at_pos: number;  // 0–1 — the realistic ceiling per the curve
  }>;

  // Cluster-level metrics that help separate snippet_ctr from coverage_partial.
  avgPosition: number | null;
  weightedCtrPct: number | null;
  expectedCtrPct: number | null;
};

export type CoverageResult = {
  kind: CoverageKind;
  recommendation: string;
  confidence: number;
  startWith: string[];
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
    /** Distribution of topic_coverage_score across members for offline calibration. */
    topic_score_min: number | null;
    topic_score_median: number | null;
    topic_score_max: number | null;
    /** AIO presence on anchor queries (v9+). */
    aio_anchor_count: number;
    aio_cited_count: number;
    aio_impression_share: number;
    /** Hopeless-query audit (v10+). */
    hopeless_query_count: number;
    hopeless_impression_share: number;
    top_impression_query: string | null;
    /** External-canonical audit (v11+). */
    external_canonical_anchor_count: number;
    error?: string;
  };
  tokens: { input: number; output: number };
};

export async function classifyClusterCoverage(input: CoverageInput): Promise<CoverageResult> {
  if (input.members.length === 0) {
    throw new Error("classifyClusterCoverage: members cannot be empty");
  }

  const modelId = resolveModelId();
  const originalBody = input.bodyText ?? "";
  const truncatedBody = truncateBody(originalBody);
  // Compare against the cap, not the truncated string — truncateBody appends
  // " […]" so a body just over MAX_BODY_CHARS produces a longer string than
  // the original and would otherwise be reported as not truncated.
  const bodyTruncated = originalBody.length > MAX_BODY_CHARS;

  const anchorSet = new Set(input.anchors.map((a) => a.query));
  const memberByQuery = new Map(input.members.map((m) => [m.query, m]));
  const formatStats = (m: CoverageMemberSignal): string => {
    const parts: string[] = [];
    parts.push(m.kd != null ? `KD ${m.kd}` : "KD ?");
    parts.push(m.volume != null ? `vol ${m.volume.toLocaleString()}/mo` : "vol ?");
    if (m.position != null) parts.push(`pos #${m.position.toFixed(1)}`);
    if (m.impressions != null && m.impressions > 0) {
      parts.push(`${m.impressions.toLocaleString()} imp/mo`);
    }
    return parts.join(", ");
  };
  const formatCompetitor = (c: CompetingPage): string => {
    if (!c.wins || c.wins.length === 0) {
      return `${c.url} [no strong wins on this site]`;
    }
    const winsStr = c.wins
      .map((w) => {
        const kdPart = w.kd != null ? ` KD ${w.kd}` : "";
        const volPart = w.volume != null ? ` ${w.volume.toLocaleString()}/mo` : "";
        return `"${w.query}" #${w.position.toFixed(1)}${kdPart}${volPart}`;
      })
      .join("; ");
    return `${c.url} — wins ${winsStr}`;
  };
  const formatTopicScore = (score: number | null | undefined): string => {
    if (score == null) return "topic ?";
    const pct = Math.round(score * 100);
    const tag = score >= 0.55 ? "covered"
      : score >= 0.40 ? "marginal"
      : "missing";
    return `topic ${pct}% (${tag})`;
  };
  const formatPerQueryCtr = (m: CoverageMemberSignal): string | null => {
    if (m.ctr_pct == null || m.expected_ctr_pct == null) return null;
    const diff = m.ctr_pct - m.expected_ctr_pct;
    const tag = diff < -0.5 ? "below" : diff > 0.5 ? "above" : "near";
    return `CTR ${m.ctr_pct.toFixed(2)}% vs ${m.expected_ctr_pct.toFixed(2)}% expected-at-pos (${tag})`;
  };
  const memberLines = input.members.map((m) => {
    const flags: string[] = [formatStats(m)];
    if (anchorSet.has(m.query)) flags.unshift("ANCHOR");
    flags.push(formatTopicScore(m.topic_coverage_score));
    const ctrFlag = formatPerQueryCtr(m);
    if (ctrFlag) flags.push(ctrFlag);
    if (m.phrase_in_body > 0) flags.push(`phrase×${m.phrase_in_body} in body`);
    else flags.push("phrase×0 in body");
    if (m.in_heading) flags.push("phrase in heading");
    if (m.competing_pages && m.competing_pages.length > 0) {
      flags.push(
        `SERP-verified competitors:\n    ${m.competing_pages.map(formatCompetitor).join("\n    ")}`,
      );
    }
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

  // AIO presence map keyed by query for cheap per-anchor lookup.
  const aioByQuery = new Map(
    input.anchorAioPresence.map((a) => [a.query, a]),
  );
  const formatAioFlag = (query: string): string | null => {
    const a = aioByQuery.get(query);
    if (!a || !a.aiOverview) return null;
    return a.cited ? "AIO present, HT cited" : "AIO present, HT NOT cited";
  };

  const formatExternalCanonical = (a: CoverageAnchor): string | null => {
    const ec = a.external_canonical;
    if (!ec) return null;
    const kdPart = ec.kd != null ? `, KD ${ec.kd}` : "";
    const volPart = ec.volume != null ? `, ${ec.volume.toLocaleString()}/mo` : "";
    return `EXTERNAL CANONICAL: ${ec.url} at #${ec.position.toFixed(1)}${kdPart}${volPart}`;
  };

  if (input.anchors.length > 0) {
    userParts.push(
      "",
      `Anchor queries (top ${input.anchors.length} by volume / kd / striking distance — recommendation MUST name at least one):`,
      ...input.anchors.map((a) => {
        const m = memberByQuery.get(a.query);
        const aioFlag = formatAioFlag(a.query);
        const ecFlag = formatExternalCanonical(a);
        const suffix = [aioFlag, ecFlag].filter(Boolean).join(" — ");
        const suffixPart = suffix ? ` — ${suffix}` : "";
        return m
          ? `- "${a.query}"  (${formatStats(m)})${suffixPart}`
          : `- "${a.query}"  (priority ${a.score.toFixed(1)})${suffixPart}`;
      }),
    );
  } else {
    userParts.push(
      "",
      "Anchor queries: NONE selected (every member is either zero-volume, missing KD, or outside striking distance). Do NOT invent anchor queries; recommend based on cluster-level signals only and leave start_with empty.",
    );
  }

  const aioAnchorCount = input.anchorAioPresence.filter((a) => a.aiOverview).length;
  const aioCitedCount = input.anchorAioPresence.filter((a) => a.aiOverview && a.cited).length;
  const aioImpSharePct = Math.round(input.clusterAioImpressionShare * 100);

  const hopelessLine = (() => {
    if (input.hopelessQueries.length === 0) return "none — no single subset of pos≥10 queries dominates the cluster";
    const sharePct = Math.round(
      input.hopelessQueries.reduce((s, q) => s + q.impression_share, 0) * 100,
    );
    const detail = input.hopelessQueries
      .map((q) => `"${q.query}" #${q.position.toFixed(1)} (${Math.round(q.impression_share * 100)}% imps, ceiling ${(q.expected_ctr_at_pos * 100).toFixed(2)}%)`)
      .join("; ");
    return `${input.hopelessQueries.length} structurally-low-CTR queries account for ${sharePct}% of cluster impressions: ${detail}`;
  })();

  userParts.push(
    "",
    `Cluster member queries (${input.members.length}):`,
    ...memberLines,
    "",
    "Cluster metrics:",
    `- avg rank: ${input.avgPosition != null ? `#${input.avgPosition.toFixed(1)}` : "—"}`,
    `- CTR: ${ctrLine}`,
    `- cannibalization: ${cannibalMemberCount > 0 ? `${cannibalMemberCount} member(s) ALSO rank on other pages — see member lines` : "none detected"}`,
    `- AI Overview: ${aioAnchorCount > 0
        ? `present on ${aioAnchorCount} of ${input.anchorAioPresence.length} anchors (HT cited on ${aioCitedCount}); ${aioImpSharePct}% of cluster impressions on AIO-present anchors`
        : "absent from all anchors with SERP data"}`,
    `- Hopeless queries (pos ≥10, dominate impressions): ${hopelessLine}`,
  );

  // 60s per-call cap so a single hung request can't block the whole phase.
  const result = await generateObject({
    model: anthropic(modelId),
    schema: CoverageSchema,
    system: SYSTEM_PROMPT,
    prompt: userParts.join("\n"),
    abortSignal: AbortSignal.timeout(60_000),
  });

  // Defensive normalization. The prompt states these rules but the model
  // doesn't always honor them; we enforce here so DB invariants hold.
  const validAnchors = new Set(input.anchors.map((a) => a.query));
  // Anchors whose topic is owned by another HearingTracker page in the
  // live SERP. These must NEVER appear in start_with — the prose can name
  // them as "defer to canonical" but we do not let the editor click into
  // an action that would cannibalize a sibling.
  const externallyCanonicalized = new Set(
    input.anchors.filter((a) => a.external_canonical).map((a) => a.query),
  );
  let kind: CoverageKind = result.object.kind;
  let confidence = Math.max(0, Math.min(1, result.object.confidence));
  let startWith = (result.object.start_with ?? [])
    .filter((q) => validAnchors.has(q) && !externallyCanonicalized.has(q))
    .slice(0, 3);

  // (a) consolidate / cede require a real cannibalization signal. If the model
  //     picks them without one, downgrade to needs_review so an admin can
  //     re-categorize rather than silently mislabel.
  if (cannibalMemberCount === 0 && (kind === "consolidate" || kind === "cede")) {
    kind = "needs_review";
    confidence = Math.min(confidence, 0.4);
  }

  // (a2) ai_overview_loss requires AIO presence on at least one anchor — and
  //      strictly speaking, on at least one anchor where THIS page is NOT
  //      cited. Without that signal the diagnosis is unfounded; downgrade to
  //      needs_review.
  const aioUncitedAnchorCount = input.anchorAioPresence.filter(
    (a) => a.aiOverview && !a.cited,
  ).length;
  if (kind === "ai_overview_loss" && aioUncitedAnchorCount === 0) {
    kind = "needs_review";
    confidence = Math.min(confidence, 0.4);
  }

  // (b) coverage_strong / wrong_page / cede / ai_overview_loss should have
  //     empty start_with. ai_overview_loss is GEO-rewrite, not anchor-targeted.
  if (
    kind === "coverage_strong" ||
    kind === "wrong_page" ||
    kind === "cede" ||
    kind === "ai_overview_loss"
  ) {
    startWith = [];
  }

  // (c) actionable kinds should have at least one start_with anchor (the prose
  //     names one). If the model returned an empty list (or every pick was
  //     invalid, or every pick was externally canonicalized), walk forward
  //     through `input.anchors` to find the first un-canonicalized one. If
  //     none exists, every anchor's topic is owned by another HT page and
  //     the right verdict is `cede` regardless of what the model picked.
  const actionableKinds: CoverageKind[] = ["coverage_partial", "intent_gap", "snippet_ctr", "consolidate"];
  if (actionableKinds.includes(kind) && startWith.length === 0 && input.anchors.length > 0) {
    const nonCanonical = input.anchors.find((a) => !externallyCanonicalized.has(a.query));
    if (nonCanonical) {
      startWith = [nonCanonical.query];
      confidence = Math.min(confidence, 0.5);
    } else {
      // Every anchor is externally canonicalized — actionable on this page
      // is impossible without cannibalizing a sibling.
      kind = "cede";
      startWith = [];
      confidence = Math.min(confidence, 0.5);
    }
  }

  return {
    kind,
    recommendation: result.object.recommendation.trim(),
    confidence,
    startWith,
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
      ...summarizeTopicScores(input.members),
      aio_anchor_count: aioAnchorCount,
      aio_cited_count: aioCitedCount,
      aio_impression_share: Math.round(input.clusterAioImpressionShare * 1000) / 1000,
      ...summarizeHopelessQueries(input),
      external_canonical_anchor_count: input.anchors.filter((a) => a.external_canonical).length,
    },
    tokens: {
      input: result.usage?.inputTokens ?? 0,
      output: result.usage?.outputTokens ?? 0,
    },
  };
}

/**
 * Concurrency-controlled bulk classifier. Each prompt carries the page body
 * (~1k tokens) plus member queries and competing pages. Default 5 is sized for
 * Anthropic Tier 2+ (450k ITPM headroom); drop to 2 if you fall back to Tier 1
 * (50k ITPM) — at 5 the burst overruns the Tier 1 cap.
 */
export async function classifyClustersConcurrently(
  inputs: CoverageInput[],
  opts: { concurrency?: number; onResult?: (i: number, r: CoverageResult) => void } = {},
): Promise<CoverageResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 5);
  const results: CoverageResult[] = new Array(inputs.length);
  let next = 0;

  // Resolve once up front so the fail-soft fallback can't itself throw on
  // missing-env if resolveModelId() is the failure mode.
  let cachedModelId = "unknown";
  try {
    cachedModelId = resolveModelId();
  } catch {
    // Real call inside the worker will surface the same error and the
    // fallback below records it in the recommendation.
  }

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= inputs.length) return;
      const input = inputs[i];
      try {
        const r = await classifyClusterCoverage(input);
        results[i] = r;
        opts.onResult?.(i, r);
      } catch (err) {
        // Fail-soft: a single timeout/schema-reject/transient error shouldn't
        // abort the whole phase. Mark this cluster needs_review so an admin can
        // re-classify it later, and let the rest of the batch finish.
        const message = err instanceof Error ? err.message : String(err);
        const fallback: CoverageResult = {
          kind: "needs_review",
          recommendation: `Classification failed: ${message.slice(0, 200)}`,
          confidence: 0,
          startWith: [],
          modelId: cachedModelId,
          promptVersion: COVERAGE_PROMPT_VERSION,
          audit: {
            prompt_version: COVERAGE_PROMPT_VERSION,
            page: input.page,
            cluster_label: input.clusterLabel,
            canonical_query: input.canonicalQuery,
            member_count: input.members.length,
            body_chars_seen: 0,
            body_truncated: false,
            heading_count: input.headings.length,
            avg_position: input.avgPosition,
            weighted_ctr_pct: input.weightedCtrPct,
            expected_ctr_pct: input.expectedCtrPct,
            anchor_queries: input.anchors.map((a) => a.query),
            cannibal_member_count: input.members.filter(
              (m) => (m.competing_pages?.length ?? 0) > 0,
            ).length,
            ...summarizeTopicScores(input.members),
            aio_anchor_count: input.anchorAioPresence.filter((a) => a.aiOverview).length,
            aio_cited_count: input.anchorAioPresence.filter((a) => a.aiOverview && a.cited).length,
            aio_impression_share: Math.round(input.clusterAioImpressionShare * 1000) / 1000,
            ...summarizeHopelessQueries(input),
            external_canonical_anchor_count: input.anchors.filter((a) => a.external_canonical).length,
            error: message,
          },
          tokens: { input: 0, output: 0 },
        };
        results[i] = fallback;
        opts.onResult?.(i, fallback);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, worker);
  await Promise.all(workers);
  return results;
}
