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
// Model selection mirrors label.ts for the first pass: SEO_COVERAGE_MODEL
// takes precedence, then falls back to SEO_LABEL_MODEL so a single env can
// drive both. `SEO_COVERAGE_ESCALATION_MODEL` optionally enables a stronger
// second pass for ambiguous/high-risk clusters. The 'anthropic/' gateway
// prefix is stripped before handing to @ai-sdk/anthropic.

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { detectBrand } from "./brand-map";
import type { Heading, PageContentType } from "./classify";

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
      "1–3 actionable anchor queries the editor should target FIRST. Pick from the actionable anchor list. EXCLUDE any anchor the page already substantively covers AND any that should be ceded to a competing page. For ai_overview_loss, include the non-canonical AIO-suppressed anchor(s) that need source-friendly passage rewrites. Empty array is valid for kind=coverage_strong, wrong_page, or cede (nothing to start with on this page).",
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
// v14: move critical editor-safety rules out of prompt-only territory.
//     The prompt now separates actionable anchors from canonical-owned
//     deferrals and frames recommendations as HearingTracker editorial briefs
//     (first-hand evidence, audiologist/lab support, decision factors). Code
//     also validates canonical-anchor prose after the LLM call, preserves
//     non-canonical AIO anchors in start_with, and downgrades low-confidence
//     actionable advice to needs_review so authors do not receive weak tasks.
//     Ambiguous/high-risk first-pass results can optionally escalate to a
//     stronger coverage model via SEO_COVERAGE_ESCALATION_MODEL.
// v15: add a deterministic navigational-intent gate. Clusters whose DataForSEO
//     prior, anchors, or impression share are dominated by navigational
//     intent are forced to wrong_page/blocked so authors do not optimize
//     article copy for user-path queries.
// v16: add deterministic editor-facing audit fields: standalone-article
//     criteria, recommendation triggers, human gap checklist, explicit
//     AIO-as-SERP-feature naming, internal-link recommendations, and
//     prioritization hooks.
// v17: pass inferred page/content type into the prompt and audit, filter
//     under-qualified anchors such as "best overall", and treat canonical
//     overlap on broad/list pages as satisfied when the page already links
//     to the canonical owner.
export const COVERAGE_PROMPT_VERSION =
  process.env.SEO_COVERAGE_PROMPT_VERSION ?? "v17";

function resolveModelId(): string {
  const raw = process.env.SEO_COVERAGE_MODEL ?? process.env.SEO_LABEL_MODEL;
  if (!raw) throw new Error("SEO_COVERAGE_MODEL or SEO_LABEL_MODEL must be set");
  return raw.replace(/^anthropic\//, "");
}

function resolveEscalationModelId(primaryModelId: string): string | null {
  const explicit = process.env.SEO_COVERAGE_ESCALATION_MODEL;
  if (explicit) return explicit.replace(/^anthropic\//, "");

  // Sensible convention for Anthropic model families used in this repo
  // (`claude-haiku-4-5` → `claude-sonnet-4-5`). If that derived model is not
  // available, the escalation call is caught and the first-pass result is used.
  if (/\bhaiku\b/i.test(primaryModelId)) {
    return primaryModelId.replace(/\bhaiku\b/i, "sonnet");
  }
  return null;
}

const SYSTEM_PROMPT = `You are an SEO content strategist deciding what an editor should do about a cluster of search queries that a specific page is partially ranking for.

You will be given:
- The page's URL, title, meta description, and heading outline.
- The page's inferred content type: best list/listicle, brand page, product review, comparison page, price/buying guide, general guide, generic article, or unknown. Use it as a routing constraint, not as a guess.
- The page's body text (may be truncated).
- A cluster of related Google Search Console queries the page ranks for in striking distance (positions 4–15), with TWO body-coverage signals per query: (a) "phrase×N in body" — exact-string occurrences of the literal query in the body text; (b) "topic NN%" — semantic max-cosine between the query embedding and the page's section embeddings (title, H1, every heading, body chunks). A topic score ≥55% means the page already has a section addressing that topic even if the literal phrase isn't there.
- Aggregate ranking and CTR metrics for the cluster.
- DataForSEO intent labels. Navigational-dominant clusters are blocked deterministically after classification; do not invent article-update work for user-path intent.
- Anchor queries — the cluster's deterministically ranked top 3–5 low-hanging-fruit queries (high volume / low difficulty / close to top of striking distance), split into actionable anchors and canonical-owned deferrals. The recommendation MUST explicitly name at least one actionable anchor when any exists.
- Cannibalization signals — for any cluster member that ALSO ranks in the LIVE top-20 organic SERP via another HearingTracker page, the competitor URL plus the queries that competitor currently wins (its strongest in-cluster rankings on this site). These are SERP-verified, not GSC-noise: a URL listed here is genuinely competing.
- AI Overview signals — for each anchor query, whether the live SERP shows an AI Overview panel and whether THIS page is cited as one of the AIO sources. AI Overviews suppress organic CTR by ~30–60%; if a majority of cluster impressions sit on AIO-present queries, the standard expected-CTR baseline overstates the achievable ceiling. The cluster summary "AIO on N of M anchors (P% of cluster impressions)" tells you how dominant the AIO suppression is.
- External canonical signals — for any anchor where a DIFFERENT HearingTracker URL ranks ≤10 in the live SERP, the anchor line carries an "EXTERNAL CANONICAL: <url> at #N" annotation. The canonical owner of the topic already exists on the site; recommending body additions, snippet changes, or start_with for that anchor on THIS page would cannibalize the canonical. Defer to the canonical instead.

Your job: pick exactly one of these eight editorial states, and write 1–3 short sentences telling the editor what to do. Optimize for meaningful HearingTracker article edits, not generic SEO activity.

Editorial quality bar:
- Page-type fit matters. A best list/listicle is allowed to mention product names, brands, and associated terms for products it evaluates; that overlap is not a cannibalization problem by itself. A brand page should own exact brand navigational/commercial queries. A product review should own exact product/model queries. A price/buying guide should own broad price/cost/insurance queries. If a query belongs to another page type, route it there instead of forcing the current page to target it.
- If the current page already links to the canonical owner for a product/brand/price topic, treat that as a valid internal-routing pattern unless the page is actively trying to rank for that canonical-owned term. Do not recommend "cede" merely because a broad best list mentions or links to products it must discuss.
- A useful edit adds decision-making value for hearing aid shoppers: audiologist/expert review, first-hand product testing, HearAdvisor/lab data, current price ranges, model/version differences, OTC vs prescription distinctions, fit/use-case guidance, return/warranty details, pros/cons, or a clear comparison table.
- Do not invent product or model names. Only name a product/model if it appears in the page text, URL, query list, canonical URL, or provided metadata. If the exact model is not present, refer to the brand or query instead and set lower confidence.
- Do NOT recommend adding generic explanatory copy when the topic is already semantically present. If the page covers the topic, the edit should improve evidence, freshness, structure, or search-result clarity.
- Do NOT treat AI Overview visibility as a separate hack. Use AIO only as a SERP diagnosis. The edit still has to make the page more useful and source-friendly for readers: direct answer, attributable facts, visible text, and structured evidence.
- Prefer fewer, higher-confidence tasks. If the evidence is ambiguous, set confidence <0.6; the system will route it to review rather than assigning it as an author task.

States (mutually exclusive — pick the BEST fit):
1. coverage_strong — The page already meaningfully answers the cluster's intent. Recommend monitoring; don't recommend body changes.
2. coverage_partial — The page touches on this topic but doesn't fully answer it. Recommend extending an existing section with the missing angles.
3. intent_gap — The page barely addresses this cluster's intent. Recommend adding a NEW section (or sub-page) on the topic.
4. wrong_page — The cluster is genuinely about a different topic that belongs on a different page (e.g. queries are about a different brand, product, or task that has no overlap with this page). Recommend writing elsewhere.
5. snippet_ctr — The body genuinely answers the queries AND average rank is reasonable (≤8) AND there's at least one query with a real CTR gap that AIO is NOT suppressing. The fix is title/meta/H1 search appeal, not new body copy. Use this sparingly — only when body coverage is clearly strong.
6. consolidate — Cannibalization is present (other pages compete for these queries) AND this page is the strongest target — same brand/topic, more depth. Recommend claiming the topic here and de-targeting the sibling pages (e.g. trim overlapping sections, internal-link toward this one).
7. cede — Cannibalization is present AND a sibling page looks like the stronger target. Recommend ceding here (don't add coverage on this page; let the sibling rank).
8. ai_overview_loss — The page ranks reasonably (≤8) but the live SERP shows an AI Overview AND this page is NOT cited in the AIO panel. The lever is passage-level GEO (rewrite content to match AIO-citation patterns: front-loaded factual answers near the top of the page, structured passages, source-friendly attribution, table-form data that mirrors AIO answer structure), NOT snippet rewriting and NOT body extensions. Recommendations should call out which anchors lose the click to AIO and propose a specific GEO change.

Decision guidance:
- Prefer coverage_partial over intent_gap when at least one heading or body passage already addresses a sibling angle of the cluster.
- Do NOT recommend article updates for navigational-dominant clusters. If the query intent is primarily to reach a login, brand site, store page, account page, support portal, or other destination, the correct outcome is to block article work and route the issue outside the content update queue.
- Do not target under-qualified modifier phrases such as "best overall" as standalone SEO work. They can describe a listicle slot, but they are not a search intent unless attached to a concrete topic like "hearing aids."
- On best lists, exact brand/product anchors without "best", "review", "compare", "vs", or a similar list/review modifier usually belong to the brand/product page. If the best list already links there, the correct outcome is monitor/valid overlap, not cede noise.
- On best lists, broad "hearing aids prices/cost" anchors usually belong to the dedicated cost/price guide unless the recommendation is about improving an existing comparison table's price fields, not adding a generic pricing section.
- Prefer wrong_page over cede when there is NO cannibalization signal — wrong_page means "not the right topic for this page," cede means "right topic, wrong page."
- Pick consolidate or cede ONLY when at least one anchor or member query has competing pages listed.
- Before recommending consolidate, you MUST acknowledge in the recommendation what each de-target sibling currently wins (cite a winning query by name). If ANY listed competitor wins an anchor-tier query (pos ≤10 AND KD ≤20), prefer coverage_strong or snippet_ctr instead — that sibling is doing its job and de-targeting it would forfeit real traffic.
- Use snippet_ctr only when ALL of: (a) coverage is genuinely strong, (b) at least one cluster member at pos ≤8 has a real per-query CTR gap (its own actual CTR is materially below the position-conditional expected CTR shown on its line), (c) AIO is NOT suppressing the dominant-impression queries — if AIO covers ≥50% of cluster impressions, the cluster's headline CTR gap is partly structural, AND (d) the "Hopeless queries" cluster-metric line shows none, OR shows a set covering <50% of cluster impressions. The cluster-weighted CTR gap alone is NOT sufficient justification — a snippet rewrite cannot move CTR on a query at pos ≥10. When recommending snippet_ctr, the prose MUST cite which page-1 query has the recoverable CTR gap and the title/meta angle that better reflects the page's actual evidence.
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
- Recommendations must reference at least one ACTIONABLE anchor query by name when any actionable anchor exists. If there are no actionable anchors, name the canonical-owned anchor only as a deferral.
- When recommending content additions, the named anchors should be queries the page does NOT already cover well. Use the "topic NN%" semantic score as semantic presence, not as proof of editorial excellence: ≥55% means the topic is already present (do NOT recommend generic new copy for it); 40–55% = marginal (an evidence-backed extension may help); <40% = topic genuinely missing (a new section may be warranted). The "phrase×N in body" count and "in heading" flag are *literal*-string signals — useful for snippet/title decisions but NEVER on their own a reason to claim a topic is missing. If a query has phrase×0 but topic ≥55%, the topic is semantically present; the fix (if any) should be title/meta wording, freshness, stronger evidence, or structure, not duplicate body content. If every high-priority anchor scores ≥55%, prefer coverage_strong (rank well already) or snippet_ctr (rank well + bad CTR).
- Use the per-query KD, volume, position, and impressions in the member/anchor lines to identify true low-hanging fruit. Call out specific queries by name in the recommendation, framed by why they're the easy wins (low KD, decent volume, already in striking distance).
- "start_with" output: pick the 1–3 actionable anchor queries the editor should attack FIRST. EXCLUDE any anchor whose topic the page already substantively covers (those need no new content), AND any anchor that should be ceded to a competing page. For ai_overview_loss, use the non-canonical AIO-suppressed anchor(s) that need source-friendly passage rewrites. The recommendation prose and start_with must be consistent — don't say "start with X" in the prose if X is excluded from start_with. Empty start_with is correct for coverage_strong, wrong_page, and cede.
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

const UNDERQUALIFIED_ANCHOR_TOKENS = new Set([
  "best",
  "top",
  "overall",
  "rated",
  "rating",
  "ratings",
  "review",
  "reviews",
  "recommended",
  "recommendation",
  "winner",
  "value",
  "choice",
  "pick",
]);

function simpleQueryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

export function isUnderqualifiedAnchorQuery(query: string): boolean {
  const tokens = simpleQueryTokens(query);
  if (tokens.length === 0 || tokens.length > 4) return false;
  const meaningfulTokens = tokens.filter((t) => !UNDERQUALIFIED_ANCHOR_TOKENS.has(t));
  return meaningfulTokens.length === 0;
}

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
  const scored = candidates
    .filter((c) => !isUnderqualifiedAnchorQuery(c.query))
    .map((c) => {
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

type EditorActionability = "ready" | "review" | "monitor" | "blocked";

const STANDALONE_MIN_IMPRESSIONS = Number(
  process.env.SEO_STANDALONE_ARTICLE_MIN_IMPRESSIONS ?? 350,
);
const STANDALONE_MIN_VOLUME = Number(
  process.env.SEO_STANDALONE_ARTICLE_MIN_VOLUME ?? 500,
);
const STANDALONE_MIN_MEMBER_COUNT = Number(
  process.env.SEO_STANDALONE_ARTICLE_MIN_MEMBERS ?? 4,
);

export type StandaloneArticleAudit = {
  recommended: boolean;
  score: number;
  reason: string;
  candidate_queries: string[];
  criteria: {
    not_navigational_gated: boolean;
    supported_intent: boolean;
    meaningful_demand: boolean;
    partial_subsection_coverage: boolean;
    dedicated_article_depth: boolean;
    no_existing_canonical: boolean;
  };
  evidence: {
    informational_or_commercial_queries: string[];
    total_impressions: number;
    total_volume: number;
    member_count: number;
    anchor_count: number;
    topic_score_median: number | null;
    topic_score_max: number | null;
    external_canonical_anchor_count: number;
  };
};

export type RecommendationTriggerAudit = {
  recommendation_trigger:
    | "content_gap"
    | "standalone_article_candidate"
    | "recoverable_ctr_gap"
    | "aio_present_on_serp_without_ht_source"
    | "cannibalization"
    | "external_canonical"
    | "navigational_intent_block"
    | "wrong_page_or_navigation"
    | "monitor"
    | "review_guardrail";
  freshness_trigger: {
    triggered: boolean;
    reason: string;
    signals: string[];
    content_age_days: number | null;
  };
  intent_trigger: {
    triggered: boolean;
    reason: string;
    intents: string[];
    navigational_gate: boolean;
  };
  content_gap_trigger: {
    triggered: boolean;
    reason: string;
    missing_or_marginal_queries: string[];
    median_topic_score: number | null;
  };
  serp_change_trigger: {
    triggered: boolean;
    reason: string;
    signals: string[];
  };
  confidence_rationale: string;
};

export type EditorGapChecklistItem = {
  id:
    | "fact_checking"
    | "new_information_news"
    | "testing_data"
    | "first_hand_user_feedback"
    | "formatting_readability"
    | "screenshots_media"
    | "compliance_review";
  label: string;
  status: "required" | "recommended" | "not_applicable";
  reason: string;
};

export type InternalLinkRecommendation = {
  source_page: string;
  target_page: string;
  suggested_anchor_text: string;
  reason: string;
  confidence: number;
  direction: "from_current_page" | "to_current_page" | "both";
};

export type AioSerpAudit = {
  aio_present_on_serp: boolean;
  aio_present_on_serp_queries: string[];
  aio_citation_seen: boolean;
  aio_citation_seen_queries: string[];
  ai_platform_citation_seen: null;
  citation_source: "google_serp_aio_sources" | null;
  note: string;
};

const AUTHOR_ACTIONABLE_KINDS = new Set<CoverageKind>([
  "coverage_partial",
  "intent_gap",
  "snippet_ctr",
  "consolidate",
  "ai_overview_loss",
]);

function pathFromCanonicalUrl(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url.replace(/^https?:\/\/[^/]+/i, "") || url;
  }
}

function normalizeInternalPath(value: string): string | null {
  const path = pathFromCanonicalUrl(value).split("#")[0].split("?")[0].replace(/\/+$/, "") || "/";
  return path.startsWith("/") ? path : null;
}

function pageTypeLabel(type: PageContentType | undefined): string {
  switch (type) {
    case "best_list": return "best list";
    case "brand_page": return "brand page";
    case "product_review": return "product review";
    case "comparison_page": return "comparison page";
    case "price_or_buying_guide": return "price/buying guide";
    case "general_guide": return "general guide";
    case "generic_article": return "article";
    default: return "page";
  }
}

function allowsSatisfiedCanonicalOverlap(type: PageContentType | undefined): boolean {
  return type === "best_list"
    || type === "comparison_page"
    || type === "general_guide"
    || type === "price_or_buying_guide"
    || type === "generic_article";
}

function linkedCanonicalTargets(
  anchors: CoverageAnchor[],
  outboundInternalLinks: string[] | null | undefined,
): string[] {
  const outbound = new Set(
    (outboundInternalLinks ?? [])
      .map(normalizeInternalPath)
      .filter((p): p is string => p !== null),
  );
  const linked = new Set<string>();
  for (const anchor of anchors) {
    const target = anchor.external_canonical?.url;
    if (!target) continue;
    const path = normalizeInternalPath(target);
    if (path && outbound.has(path)) linked.add(path);
  }
  return [...linked].sort();
}

function buildSatisfiedCanonicalOverlapRecommendation(
  input: CoverageInput,
  linkedTargets: string[],
): string {
  const targetText = linkedTargets.length > 0
    ? linkedTargets.slice(0, 4).join(", ")
    : "the canonical owner";
  return `Valid overlap for this ${pageTypeLabel(input.pageContentType)}: ${input.page} already links to ${targetText}. Keep the mentions contextual and do not expand this page to target those canonical-owned terms.`;
}

function splitRecommendationSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]?/g);
  return matches?.map((s) => s.trim()).filter(Boolean) ?? [text.trim()].filter(Boolean);
}

type CanonicalMentionViolation = {
  query: string;
  url: string;
  context: string;
};

type UnsupportedProductMention = {
  mention: string;
  context: string;
};

const PRODUCT_MENTION_BRANDS = [
  "Phonak",
  "Oticon",
  "ReSound",
  "Widex",
  "Signia",
  "Starkey",
  "Unitron",
  "Rexton",
  "Philips",
  "Jabra",
  "Beltone",
  "Miracle-Ear",
  "Audibel",
  "Audicus",
  "Eargo",
  "Lexie",
  "Sony",
  "Bose",
  "Sennheiser",
  "MDHearing",
  "Audien",
  "Lucid",
  "Nuheara",
];

function escapeRegExp(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function productEvidenceText(input: CoverageInput): string {
  return [
    input.page,
    input.pageTitle,
    input.metaDescription,
    input.bodyText,
    input.brand,
    input.retailer,
    input.productFamily,
    ...input.headings.map((h) => h.text),
    ...input.members.map((m) => m.query),
    ...input.anchors.map((a) => a.query),
    ...input.anchors.map((a) => a.external_canonical?.url ?? ""),
  ].filter(Boolean).join("\n").toLowerCase();
}

function findUnsupportedProductMentions(
  recommendation: string,
  input: CoverageInput,
): UnsupportedProductMention[] {
  const evidence = productEvidenceText(input);
  const brandPattern = PRODUCT_MENTION_BRANDS.map(escapeRegExp).join("|");
  const productish =
    String.raw`\b(?:${brandPattern})\s+(?:[A-Z][A-Za-z0-9+.-]*|[A-Z0-9]+-[A-Z0-9-]+)(?:\s+(?:[A-Z][A-Za-z0-9+.-]*|[A-Z0-9]+-[A-Z0-9-]+)){0,3}`;
  const regex = new RegExp(productish, "g");
  const violations: UnsupportedProductMention[] = [];
  const sentences = splitRecommendationSentences(recommendation);
  const seen = new Set<string>();

  for (const sentence of sentences) {
    for (const match of sentence.matchAll(regex)) {
      const mention = match[0].trim();
      const normalized = mention.toLowerCase();
      if (seen.has(normalized) || evidence.includes(normalized)) continue;
      seen.add(normalized);
      violations.push({
        mention,
        context: sentence.slice(0, 260),
      });
    }
  }
  return violations;
}

function findUnsafeCanonicalMentions(
  recommendation: string,
  anchors: CoverageAnchor[],
): CanonicalMentionViolation[] {
  const violations: CanonicalMentionViolation[] = [];
  const sentences = splitRecommendationSentences(recommendation);
  for (const anchor of anchors) {
    const ec = anchor.external_canonical;
    if (!ec) continue;
    const query = anchor.query.toLowerCase();
    const canonicalPath = pathFromCanonicalUrl(ec.url).toLowerCase();
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (!lower.includes(query)) continue;
      const allowed =
        lower.includes("defer")
        || lower.includes("canonical")
        || lower.includes("owned by")
        || lower.includes("de-target")
        || lower.includes("do not target")
        || lower.includes("do not optimize")
        || lower.includes("don't optimize")
        || (canonicalPath.length > 0 && lower.includes(canonicalPath));
      if (!allowed) {
        violations.push({
          query: anchor.query,
          url: ec.url,
          context: sentence.slice(0, 260),
        });
      }
    }
  }
  return violations;
}

function canonicalDeferralSummary(anchors: CoverageAnchor[]): string {
  return anchors
    .filter((a) => a.external_canonical)
    .map((a) => `"${a.query}" → ${pathFromCanonicalUrl(a.external_canonical!.url)}`)
    .join("; ");
}

function buildCanonicalCedeRecommendation(input: CoverageInput): string {
  const deferrals = canonicalDeferralSummary(input.anchors);
  return `Do not optimize ${input.page} for this cluster: ${deferrals}. These anchors already have canonical HearingTracker owners, so keep this page focused on its distinct reader job and route internal links toward the canonical pages.`;
}

function buildCanonicalReviewRecommendation(
  page: string,
  violations: CanonicalMentionViolation[],
): string {
  const deferrals = violations
    .slice(0, 3)
    .map((v) => `"${v.query}" → ${pathFromCanonicalUrl(v.url)}`)
    .join("; ");
  return `Review before assigning: the draft recommendation referenced canonical-owned anchors as action targets on ${page} (${deferrals}). Defer those anchors to their canonical pages and brief this page only on non-canonical reader needs.`;
}

function buildLowConfidenceRecommendation(recommendation: string): string {
  const cleaned = recommendation.replace(/^Review before assigning:\s*/i, "").trim();
  return `Review before assigning: classifier confidence is below the author-task threshold. ${cleaned}`;
}

function buildReviewRecommendation(reason: string, recommendation: string): string {
  const cleaned = recommendation.replace(/^Review before assigning:\s*/i, "").trim();
  return `Review before assigning: ${reason}. ${cleaned}`;
}

function buildUnsupportedProductReviewRecommendation(
  violations: UnsupportedProductMention[],
  recommendation: string,
): string {
  const mentions = violations.slice(0, 3).map((v) => `"${v.mention}"`).join(", ");
  const cleaned = recommendation.replace(/^Review before assigning:\s*/i, "").trim();
  return `Review before assigning: the draft named unsupported product/model ${mentions}. Verify product names against the source page or product catalog before assigning. ${cleaned}`;
}

function hasConcreteEditorialEvidence(recommendation: string): boolean {
  const lower = recommendation.toLowerCase();
  return [
    "price",
    "model",
    "models",
    "table",
    "comparison",
    "audiologist",
    "lab",
    "tested",
    "testing",
    "features",
    "battery",
    "warranty",
    "return",
    "otc",
    "prescription",
    "pros",
    "cons",
  ].some((needle) => lower.includes(needle));
}

function shouldAllowModerateConfidenceReady(args: {
  kind: CoverageKind;
  confidence: number;
  startWith: string[];
  recommendation: string;
  canonicalViolationCount: number;
  hasUnsafeGuardrail: boolean;
}): boolean {
  if (!AUTHOR_ACTIONABLE_KINDS.has(args.kind)) return false;
  if (args.confidence < 0.5 || args.confidence >= 0.6) return false;
  if (args.startWith.length === 0) return false;
  if (args.canonicalViolationCount > 0 || args.hasUnsafeGuardrail) return false;
  return hasConcreteEditorialEvidence(args.recommendation);
}

function shouldEscalateCoverage(args: {
  primaryModelId: string;
  escalationModelId: string | null;
  rawKind: CoverageKind;
  rawConfidence: number;
  cannibalMemberCount: number;
  externalCanonicalAnchorCount: number;
  everyAnchorIsExternalCanonical: boolean;
  nonCanonicalAioLossAnchorCount: number;
  aioAnchorCount: number;
  aioImpressionShare: number;
}): { escalate: boolean; reasons: string[] } {
  if (!args.escalationModelId || args.escalationModelId === args.primaryModelId) {
    return { escalate: false, reasons: [] };
  }
  if (args.everyAnchorIsExternalCanonical) {
    return { escalate: false, reasons: ["all anchors canonical; deterministic cede"] };
  }

  const reasons: string[] = [];
  if (args.rawConfidence >= 0.4 && args.rawConfidence < 0.6) {
    reasons.push("moderate first-pass confidence");
  }
  if (args.externalCanonicalAnchorCount > 0) {
    reasons.push("external canonical present");
  }
  if (args.cannibalMemberCount > 0) {
    reasons.push("SERP-verified cannibalization present");
  }
  if (args.nonCanonicalAioLossAnchorCount > 0) {
    reasons.push("non-canonical AIO loss present");
  }
  if (args.aioAnchorCount > 0 && args.aioImpressionShare >= 0.25) {
    reasons.push("AIO affects material impression share");
  }
  if (
    args.rawKind === "snippet_ctr" ||
    args.rawKind === "consolidate" ||
    args.rawKind === "cede" ||
    args.rawKind === "ai_overview_loss"
  ) {
    reasons.push(`high-risk first-pass kind: ${args.rawKind}`);
  }

  return { escalate: reasons.length > 0, reasons };
}

function deriveEditorActionability(args: {
  kind: CoverageKind;
  confidence: number;
  startWith: string[];
  canonicalViolationCount: number;
  allowModerateConfidenceReady?: boolean;
}): EditorActionability {
  if (args.kind === "needs_review" || args.canonicalViolationCount > 0) {
    return "review";
  }
  if (args.kind === "coverage_strong") return "monitor";
  if (args.kind === "cede" || args.kind === "wrong_page") return "blocked";
  if (args.allowModerateConfidenceReady) return "ready";
  if (args.confidence < 0.6) return "review";
  if (AUTHOR_ACTIONABLE_KINDS.has(args.kind) && args.startWith.length > 0) return "ready";
  return "review";
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

function intentTags(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .toLowerCase()
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasNavigationalIntent(raw: string | null | undefined): boolean {
  return intentTags(raw).includes("navigational");
}

function summarizeNavigationalIntent(input: CoverageInput): {
  gate: boolean;
  impression_share: number;
  supported_intent_share: number;
  anchor_queries: string[];
  member_queries: string[];
} {
  let totalImpressions = 0;
  let navigationalImpressions = 0;
  let supportedEditorialImpressions = 0;
  const navigationalMembers: string[] = [];
  const memberByQuery = new Map(input.members.map((m) => [m.query, m]));
  let topMember: CoverageMemberSignal | null = null;

  for (const m of input.members) {
    const imp = m.impressions ?? 0;
    totalImpressions += imp;
    if (!topMember || imp > (topMember.impressions ?? 0)) topMember = m;
    if (hasNavigationalIntent(m.dataforseo_intents)) {
      navigationalMembers.push(m.query);
      navigationalImpressions += imp;
    }
    if (hasStandaloneSupportedIntent(m.dataforseo_intents)) {
      supportedEditorialImpressions += imp;
    }
  }

  const impressionShare = totalImpressions > 0
    ? navigationalImpressions / totalImpressions
    : input.members.length > 0
      ? navigationalMembers.length / input.members.length
      : 0;
  const navigationalAnchors = input.anchors
    .filter((a) => hasNavigationalIntent(memberByQuery.get(a.query)?.dataforseo_intents))
    .map((a) => a.query);
  const supportedIntentShare = totalImpressions > 0
    ? supportedEditorialImpressions / totalImpressions
    : input.members.length > 0
      ? input.members.filter((m) => hasStandaloneSupportedIntent(m.dataforseo_intents)).length / input.members.length
      : 0;
  const priorIsNavigational = hasNavigationalIntent(input.dataForSeoIntentPrior);
  const allAnchorsNavigational =
    input.anchors.length > 0 && navigationalAnchors.length === input.anchors.length;
  const canonicalNavigational = hasNavigationalIntent(
    memberByQuery.get(input.canonicalQuery)?.dataforseo_intents,
  );
  const topNavigational = hasNavigationalIntent(topMember?.dataforseo_intents);
  const dominantNavigational =
    impressionShare >= 0.5 && supportedIntentShare < 0.25;
  const priorConfirmed =
    priorIsNavigational && impressionShare >= 0.45 && supportedIntentShare < 0.35;
  const navigationalHead =
    (priorIsNavigational || canonicalNavigational) && topNavigational && impressionShare >= 0.35 && supportedIntentShare < 0.35;

  return {
    gate: allAnchorsNavigational || dominantNavigational || priorConfirmed || navigationalHead,
    impression_share: Math.round(impressionShare * 1000) / 1000,
    supported_intent_share: Math.round(supportedIntentShare * 1000) / 1000,
    anchor_queries: navigationalAnchors,
    member_queries: navigationalMembers,
  };
}

function hasListOrReviewModifier(query: string): boolean {
  return /\b(best|top|review|reviews|compare|comparison|vs|versus)\b/i.test(query);
}

function isPriceIntentQuery(query: string): boolean {
  return /\b(price|prices|pricing|cost|costs|affordable|cheap|finance|financing|insurance|medicare)\b/i.test(query);
}

function bestListOffTypeSummary(input: CoverageInput): {
  gate: boolean;
  sample: string | null;
  reason: "exact_brand_or_product" | "broad_price_or_cost" | null;
  impression_share: number;
} {
  if (input.pageContentType !== "best_list") {
    return { gate: false, sample: null, reason: null, impression_share: 0 };
  }

  const offTypeQueries = new Set<string>();
  let reason: "exact_brand_or_product" | "broad_price_or_cost" | null = null;
  for (const m of input.members) {
    if (hasListOrReviewModifier(m.query)) continue;
    const brand = detectBrand(m.query);
    if (brand.is_branded || brand.retailer || brand.product_family) {
      offTypeQueries.add(m.query);
      reason ??= "exact_brand_or_product";
      continue;
    }
    if (isPriceIntentQuery(m.query)) {
      offTypeQueries.add(m.query);
      reason ??= "broad_price_or_cost";
    }
  }

  if (offTypeQueries.size === 0) {
    return { gate: false, sample: null, reason: null, impression_share: 0 };
  }

  const totalImpressions = totalMemberImpressions(input);
  const offTypeImpressions = input.members
    .filter((m) => offTypeQueries.has(m.query))
    .reduce((sum, m) => sum + (m.impressions ?? 0), 0);
  const impressionShare = totalImpressions > 0
    ? offTypeImpressions / totalImpressions
    : offTypeQueries.size / input.members.length;
  const anchorQueries = input.anchors.map((a) => a.query);
  const offTypeAnchorCount = anchorQueries.filter((q) => offTypeQueries.has(q)).length;
  const anchorDominant =
    anchorQueries.length > 0 && offTypeAnchorCount / anchorQueries.length >= 0.6;

  return {
    gate: impressionShare >= 0.5 || anchorDominant,
    sample: anchorQueries.find((q) => offTypeQueries.has(q)) ?? [...offTypeQueries][0] ?? null,
    reason,
    impression_share: Math.round(impressionShare * 1000) / 1000,
  };
}

function hasStandaloneSupportedIntent(raw: string | null | undefined): boolean {
  return intentTags(raw).some((tag) => {
    const normalized = tag.replace(/[_-]+/g, " ");
    return normalized === "informational"
      || normalized === "commercial"
      || normalized === "commercial investigation";
  });
}

function uniqueIntentTags(input: CoverageInput): string[] {
  const tags = new Set<string>();
  if (input.dataForSeoIntentPrior) {
    for (const tag of intentTags(input.dataForSeoIntentPrior)) tags.add(tag);
  }
  for (const m of input.members) {
    for (const tag of intentTags(m.dataforseo_intents)) tags.add(tag);
  }
  return [...tags].sort();
}

function totalMemberImpressions(input: CoverageInput): number {
  return input.members.reduce((sum, m) => sum + (m.impressions ?? 0), 0);
}

function totalMemberVolume(input: CoverageInput): number {
  return input.members.reduce((sum, m) => sum + (m.volume ?? 0), 0);
}

function topicScores(input: CoverageInput): number[] {
  return input.members
    .map((m) => m.topic_coverage_score)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
}

function medianTopicScore(input: CoverageInput): number | null {
  const scores = topicScores(input);
  if (scores.length === 0) return null;
  return Math.round(scores[Math.floor(scores.length / 2)] * 1000) / 1000;
}

function maxTopicScore(input: CoverageInput): number | null {
  const scores = topicScores(input);
  if (scores.length === 0) return null;
  return Math.round(scores[scores.length - 1] * 1000) / 1000;
}

function informationalOrCommercialQueries(input: CoverageInput): string[] {
  return input.members
    .filter((m) => hasStandaloneSupportedIntent(m.dataforseo_intents))
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
    .map((m) => m.query);
}

function scoreStandaloneArticleCandidate(args: {
  input: CoverageInput;
  kind: CoverageKind;
  navigationalGate: boolean;
  externalCanonicalAnchorCount: number;
}): StandaloneArticleAudit {
  const { input, kind, navigationalGate, externalCanonicalAnchorCount } = args;
  const totalImpressions = totalMemberImpressions(input);
  const totalVolume = totalMemberVolume(input);
  const medianScore = medianTopicScore(input);
  const maxScore = maxTopicScore(input);
  const supportedQueries = informationalOrCommercialQueries(input);
  const supportedIntent =
    hasStandaloneSupportedIntent(input.dataForSeoIntentPrior)
    || supportedQueries.length > 0;
  const meaningfulDemand =
    totalImpressions >= STANDALONE_MIN_IMPRESSIONS
    || totalVolume >= STANDALONE_MIN_VOLUME
    || input.members.length >= STANDALONE_MIN_MEMBER_COUNT + 1;
  const touchedByPage =
    maxScore != null && maxScore >= 0.4;
  const stillIncomplete =
    medianScore == null || medianScore < 0.62;
  const missingOrMarginalCount = input.members.filter(
    (m) => m.topic_coverage_score == null || m.topic_coverage_score < 0.55,
  ).length;
  const partialSubsectionCoverage =
    touchedByPage && stillIncomplete && missingOrMarginalCount >= 2;
  const dedicatedArticleDepth =
    input.members.length >= STANDALONE_MIN_MEMBER_COUNT
    && (input.anchors.length >= 2 || supportedQueries.length >= 2)
    && (totalImpressions >= Math.floor(STANDALONE_MIN_IMPRESSIONS * 0.6)
      || totalVolume >= Math.floor(STANDALONE_MIN_VOLUME * 0.6));
  const noExistingCanonical =
    externalCanonicalAnchorCount === 0
    && kind !== "coverage_strong"
    && kind !== "cede"
    && kind !== "wrong_page";

  const criteria = {
    not_navigational_gated: !navigationalGate,
    supported_intent: supportedIntent,
    meaningful_demand: meaningfulDemand,
    partial_subsection_coverage: partialSubsectionCoverage,
    dedicated_article_depth: dedicatedArticleDepth,
    no_existing_canonical: noExistingCanonical,
  };

  const score =
    (criteria.not_navigational_gated ? 15 : 0)
    + (criteria.supported_intent ? 15 : 0)
    + (criteria.meaningful_demand ? 20 : 0)
    + (criteria.partial_subsection_coverage ? 20 : 0)
    + (criteria.dedicated_article_depth ? 15 : 0)
    + (criteria.no_existing_canonical ? 15 : 0);

  const recommended =
    Object.values(criteria).every(Boolean)
    && kind !== "needs_review";

  const candidateQueries = (
    input.anchors.length > 0
      ? input.anchors.filter((a) => !a.external_canonical).map((a) => a.query)
      : supportedQueries
  ).slice(0, 4);

  const failed: string[] = [];
  if (!criteria.not_navigational_gated) failed.push("navigational intent dominates");
  if (!criteria.supported_intent) failed.push("intent is not informational or commercial investigation");
  if (!criteria.meaningful_demand) failed.push("demand is below the standalone threshold");
  if (!criteria.partial_subsection_coverage) failed.push("current page does not look like a partial subsection match");
  if (!criteria.dedicated_article_depth) failed.push("query set is too thin for a dedicated article");
  if (!criteria.no_existing_canonical) failed.push("an existing canonical or non-update verdict already owns the intent");
  if (kind === "needs_review") failed.push("classifier routed this to review");

  const demandLabel = `${totalImpressions.toLocaleString()} impressions/mo, ${totalVolume.toLocaleString()} search volume, ${input.members.length} related queries`;
  const topicLabel = medianScore == null
    ? "topic coverage unknown"
    : `median topic coverage ${Math.round(medianScore * 100)}%`;
  const reason = recommended
    ? `Standalone article candidate: ${candidateQueries.length > 0 ? `"${candidateQueries[0]}"` : input.canonicalQuery} has ${demandLabel}; this page only partially covers it (${topicLabel}) and no canonical page already satisfies the intent.`
    : `Keep as a page update or review item: ${failed.join("; ")}.`;

  return {
    recommended,
    score,
    reason,
    candidate_queries: candidateQueries,
    criteria,
    evidence: {
      informational_or_commercial_queries: supportedQueries.slice(0, 10),
      total_impressions: totalImpressions,
      total_volume: totalVolume,
      member_count: input.members.length,
      anchor_count: input.anchors.length,
      topic_score_median: medianScore,
      topic_score_max: maxScore,
      external_canonical_anchor_count: externalCanonicalAnchorCount,
    },
  };
}

function contentAgeDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function titleYearSignal(title: string | null | undefined): string | null {
  const years = (title ?? "").match(/\b20\d{2}\b/g);
  if (!years || years.length === 0) return null;
  const currentYear = new Date().getFullYear();
  const newest = Math.max(...years.map(Number));
  return newest < currentYear ? `title_year_${newest}` : null;
}

function clusterTextForRules(input: CoverageInput, recommendation = ""): string {
  return [
    input.pageTitle,
    input.clusterLabel,
    input.canonicalQuery,
    input.dataForSeoIntentPrior,
    recommendation,
    ...input.members.map((m) => `${m.query} ${m.dataforseo_intents ?? ""}`),
  ].filter(Boolean).join(" ").toLowerCase();
}

function buildAioSerpAudit(input: CoverageInput): AioSerpAudit {
  const aioPresent = input.anchorAioPresence.filter((a) => a.aiOverview);
  const cited = aioPresent.filter((a) => a.cited);
  return {
    aio_present_on_serp: aioPresent.length > 0,
    aio_present_on_serp_queries: aioPresent.map((a) => a.query),
    aio_citation_seen: cited.length > 0,
    aio_citation_seen_queries: cited.map((a) => a.query),
    ai_platform_citation_seen: null,
    citation_source: aioPresent.length > 0 ? "google_serp_aio_sources" : null,
    note: "AIO fields describe Google SERP feature/source data only. AI platform citation tracking is not implemented.",
  };
}

function buildRecommendationTriggers(args: {
  input: CoverageInput;
  kind: CoverageKind;
  confidence: number;
  navigationalGate: boolean;
  externalCanonicalAnchorCount: number;
  nonCanonicalAioLossAnchors: string[];
  cannibalMemberCount: number;
  standaloneArticle: StandaloneArticleAudit;
}): RecommendationTriggerAudit {
  const {
    input,
    kind,
    confidence,
    navigationalGate,
    externalCanonicalAnchorCount,
    nonCanonicalAioLossAnchors,
    cannibalMemberCount,
    standaloneArticle,
  } = args;
  const ageDays = contentAgeDays(input.pageContentModifiedAt);
  const freshnessSignals: string[] = [];
  if (ageDays != null && ageDays > 365) freshnessSignals.push("content_age_over_365_days");
  const yearSignal = titleYearSignal(input.pageTitle);
  if (yearSignal) freshnessSignals.push(yearSignal);
  const ruleText = clusterTextForRules(input);
  if (/\b(latest|newest|current|updated|202[5-9]|price|prices|cost|models?)\b/.test(ruleText)) {
    freshnessSignals.push("query_or_topic_requires_current_details");
  }

  const missingOrMarginal = input.members
    .filter((m) => m.topic_coverage_score == null || m.topic_coverage_score < 0.55)
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
    .map((m) => m.query)
    .slice(0, 5);
  const contentGapTriggered =
    kind === "coverage_partial"
    || kind === "intent_gap"
    || standaloneArticle.recommended
    || missingOrMarginal.length >= 2;

  const serpSignals: string[] = [];
  const aioAudit = buildAioSerpAudit(input);
  if (aioAudit.aio_present_on_serp) serpSignals.push("aio_present_on_serp");
  if (nonCanonicalAioLossAnchors.length > 0) serpSignals.push("aio_present_without_this_page_as_serp_source");
  if (externalCanonicalAnchorCount > 0) serpSignals.push("external_canonical_page_in_top_10");
  if (cannibalMemberCount > 0) serpSignals.push("serp_verified_cannibalization");
  if (input.hopelessQueries.length > 0) serpSignals.push("ctr_gap_structural_from_position");

  const recommendationTrigger: RecommendationTriggerAudit["recommendation_trigger"] =
    navigationalGate ? "navigational_intent_block"
      : standaloneArticle.recommended ? "standalone_article_candidate"
      : kind === "coverage_partial" || kind === "intent_gap" ? "content_gap"
      : kind === "snippet_ctr" ? "recoverable_ctr_gap"
      : kind === "ai_overview_loss" ? "aio_present_on_serp_without_ht_source"
      : kind === "consolidate" ? "cannibalization"
      : kind === "cede" ? "external_canonical"
      : kind === "wrong_page" ? "wrong_page_or_navigation"
      : kind === "coverage_strong" ? "monitor"
      : "review_guardrail";

  const intents = uniqueIntentTags(input);
  const supportedIntent = hasStandaloneSupportedIntent(input.dataForSeoIntentPrior)
    || input.members.some((m) => hasStandaloneSupportedIntent(m.dataforseo_intents));

  return {
    recommendation_trigger: recommendationTrigger,
    freshness_trigger: {
      triggered: freshnessSignals.length > 0 && kind !== "coverage_strong",
      reason: freshnessSignals.length > 0
        ? "Freshness-sensitive terms or page age mean a human should verify current facts."
        : "No deterministic freshness signal found in the cluster pass.",
      signals: [...new Set(freshnessSignals)],
      content_age_days: ageDays,
    },
    intent_trigger: {
      triggered: navigationalGate || supportedIntent,
      reason: navigationalGate
        ? "Navigational intent blocks article-update work."
        : supportedIntent
          ? "Informational or commercial investigation intent supports editorial work."
          : "No supported editorial intent signal found.",
      intents,
      navigational_gate: navigationalGate,
    },
    content_gap_trigger: {
      triggered: contentGapTriggered,
      reason: contentGapTriggered
        ? "Topic coverage scores show missing or marginal coverage on material member queries."
        : "Topic coverage scores do not show a material body gap.",
      missing_or_marginal_queries: missingOrMarginal,
      median_topic_score: medianTopicScore(input),
    },
    serp_change_trigger: {
      triggered: serpSignals.length > 0,
      reason: serpSignals.length > 0
        ? "Live SERP-derived features affected the recommendation. AIO is feature/source data, not AI-platform citation tracking."
        : "No live SERP feature or canonicalization trigger affected this recommendation.",
      signals: [...new Set(serpSignals)],
    },
    confidence_rationale: confidence >= 0.8
      ? "High confidence: deterministic guardrails and classifier output agree."
      : confidence >= 0.6
        ? "Author-ready confidence, but the checklist should still be completed before publishing."
        : "Low confidence: routed to editor review before assigning or publishing.",
  };
}

function buildEditorGapChecklist(args: {
  input: CoverageInput;
  kind: CoverageKind;
  editorActionability: EditorActionability;
  triggers: RecommendationTriggerAudit;
  standaloneArticle: StandaloneArticleAudit;
  recommendation: string;
}): EditorGapChecklistItem[] {
  const { input, kind, editorActionability, triggers, standaloneArticle, recommendation } = args;
  const text = clusterTextForRules(input, recommendation);
  const actionable = editorActionability === "ready" || kind === "coverage_partial" || kind === "intent_gap" || standaloneArticle.recommended;
  const productOrComparison = /\b(best|review|reviews|compare|comparison|vs|model|models|brand|otc|prescription|features?|battery|warranty|return|price|cost)\b/.test(text)
    || Boolean(input.brand || input.productFamily || input.retailer);
  const medicalOrCompliance = /\b(fda|medical|doctor|audiologist|hearing loss|tinnitus|medicare|insurance|otc|prescription|legal|law|compliance)\b/.test(text);
  const howToOrMedia = /\b(screenshot|screenshots|app|setup|pair|how to|step|table|chart|comparison|features?)\b/.test(text);

  return [
    {
      id: "fact_checking",
      label: "Fact checking",
      status: actionable ? "required" : "recommended",
      reason: "The system cannot verify factual accuracy, prices, warranties, dates, or source claims.",
    },
    {
      id: "new_information_news",
      label: "New information/news",
      status: triggers.freshness_trigger.triggered ? "required" : actionable ? "recommended" : "not_applicable",
      reason: triggers.freshness_trigger.triggered
        ? "Freshness signals were detected; check for recent product, policy, price, or news changes."
        : "No freshness signal was detected, but recent market changes may still matter.",
    },
    {
      id: "testing_data",
      label: "Testing data",
      status: productOrComparison && actionable ? "required" : actionable ? "recommended" : "not_applicable",
      reason: "The system cannot confirm first-party testing, HearAdvisor/lab data, measurements, or product-handling evidence.",
    },
    {
      id: "first_hand_user_feedback",
      label: "First-hand user feedback",
      status: productOrComparison && actionable ? "required" : actionable ? "recommended" : "not_applicable",
      reason: "The system cannot verify customer interviews, audiologist notes, or hands-on usage feedback.",
    },
    {
      id: "formatting_readability",
      label: "Formatting/readability",
      status: actionable ? "required" : "recommended",
      reason: "The system cannot judge final scanability, section order, table clarity, or whether the edit reads naturally.",
    },
    {
      id: "screenshots_media",
      label: "Screenshots/media",
      status: howToOrMedia && actionable ? "required" : actionable ? "recommended" : "not_applicable",
      reason: "The system cannot capture screenshots, product photos, diagrams, or verify media recency.",
    },
    {
      id: "compliance_review",
      label: "Compliance/medical/legal review",
      status: medicalOrCompliance && actionable ? "required" : medicalOrCompliance ? "recommended" : "not_applicable",
      reason: "The system cannot clear medical, legal, FDA/OTC, insurance, or claims-compliance risk.",
    },
  ];
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
  dataforseo_intents?: string | null;
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
  pageContentModifiedAt?: string | null;
  pageContentType?: PageContentType;
  pageContentTypeSignals?: string[];
  outboundInternalLinks?: string[];

  clusterLabel: string;
  canonicalQuery: string;
  isBranded: boolean;
  brand: string | null;
  retailer: string | null;
  productFamily: string | null;
  dataForSeoIntentPrior: string | null;

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

  /**
   * Deterministic link recommendations generated from the site link graph and
   * query/topic overlap before the LLM call. These are audit data, not model
   * prose, so editors can see why a link was proposed.
   */
  internalLinkRecommendations?: InternalLinkRecommendation[];
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
    page_content_type?: PageContentType;
    page_content_type_signals?: string[];
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
    canonical_owned_anchor_queries?: string[];
    actionable_anchor_queries?: string[];
    canonical_targets_already_linked?: string[];
    /** Navigational-intent hard gate (v15+). */
      navigational_intent_gate?: boolean;
      navigational_impression_share?: number;
      supported_editorial_intent_share?: number;
      navigational_anchor_queries?: string[];
    best_list_page_type_gate?: boolean;
    best_list_page_type_gate_reason?: string | null;
    best_list_page_type_gate_query?: string | null;
    best_list_page_type_gate_impression_share?: number;
    standalone_article?: StandaloneArticleAudit;
    recommendation_audit?: RecommendationTriggerAudit;
    editor_gap_checklist?: EditorGapChecklistItem[];
    internal_link_recommendations?: InternalLinkRecommendation[];
    aio_serp?: AioSerpAudit;
    aio_present_on_serp?: boolean;
    aio_present_on_serp_queries?: string[];
    aio_citation_seen?: boolean;
    aio_citation_seen_queries?: string[];
    ai_platform_citation_seen?: null;
    citation_source?: "google_serp_aio_sources" | null;
    noncanonical_aio_loss_anchor_count?: number;
    canonical_mention_violation_count?: number;
    canonical_mention_violations?: CanonicalMentionViolation[];
    unsupported_product_mention_count?: number;
    unsupported_product_mentions?: UnsupportedProductMention[];
    editor_actionability?: EditorActionability;
    guardrails?: string[];
    primary_model_id?: string;
    escalation_model_id?: string | null;
    escalation_attempted?: boolean;
    escalation_used?: boolean;
    escalation_reasons?: string[];
    escalation_error?: string;
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
    if (m.dataforseo_intents) flags.push(`intent ${m.dataforseo_intents}`);
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
    `Inferred content type: ${input.pageContentType ?? "unknown"}${input.pageContentTypeSignals?.length ? ` (${input.pageContentTypeSignals.join("; ")})` : ""}`,
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
  if (input.dataForSeoIntentPrior) userParts.push(`DataForSEO intent prior: ${input.dataForSeoIntentPrior}`);

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

  const canonicalOwnedAnchors = input.anchors.filter((a) => a.external_canonical);
  const actionableAnchors = input.anchors.filter((a) => !a.external_canonical);

  if (input.anchors.length > 0) {
    if (actionableAnchors.length > 0) {
      userParts.push(
        "",
        `Actionable anchor queries (top ${actionableAnchors.length} non-canonical anchors by volume / kd / striking distance — recommendation MUST name at least one when assigning work on this page):`,
        ...actionableAnchors.map((a) => {
          const m = memberByQuery.get(a.query);
          const aioFlag = formatAioFlag(a.query);
          const suffixPart = aioFlag ? ` — ${aioFlag}` : "";
          return m
            ? `- "${a.query}"  (${formatStats(m)})${suffixPart}`
            : `- "${a.query}"  (priority ${a.score.toFixed(1)})${suffixPart}`;
        }),
      );
    } else {
      userParts.push(
        "",
        "Actionable anchor queries: NONE. Every priority anchor is owned by another HearingTracker canonical or no viable anchor was selected. Do not invent a page-level action for this URL.",
      );
    }

    if (canonicalOwnedAnchors.length > 0) {
      userParts.push(
        "",
        `Canonical-owned anchors (DO NOT TARGET on this page — mention only as explicit deferrals):`,
        ...canonicalOwnedAnchors.map((a) => {
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
    }
  } else {
    userParts.push(
      "",
      "Anchor queries: NONE selected (every member is either zero-volume, missing KD, or outside striking distance). Do NOT invent anchor queries; recommend based on cluster-level signals only and leave start_with empty.",
    );
  }

  const aioAnchorCount = input.anchorAioPresence.filter((a) => a.aiOverview).length;
  const aioCitedCount = input.anchorAioPresence.filter((a) => a.aiOverview && a.cited).length;
  const aioImpSharePct = Math.round(input.clusterAioImpressionShare * 100);
  const validAnchors = new Set(input.anchors.map((a) => a.query));
  // Anchors whose topic is owned by another HearingTracker page in the
  // live SERP. These must NEVER appear in start_with — the prose can name
  // them as "defer to canonical" but we do not let the editor click into
  // an action that would cannibalize a sibling.
  const externallyCanonicalized = new Set(
    canonicalOwnedAnchors.map((a) => a.query),
  );
  const nonCanonicalAioLossAnchors = input.anchorAioPresence
    .filter((a) => a.aiOverview && !a.cited && !externallyCanonicalized.has(a.query))
    .map((a) => a.query)
    .filter((q) => validAnchors.has(q));
  const externalCanonicalAnchorCount = canonicalOwnedAnchors.length;
  const everyAnchorIsExternalCanonical =
    input.anchors.length > 0 && externalCanonicalAnchorCount === input.anchors.length;
  const canonicalTargetsLinked = linkedCanonicalTargets(
    canonicalOwnedAnchors,
    input.outboundInternalLinks,
  );
  const everyCanonicalTargetAlreadyLinked =
    externalCanonicalAnchorCount > 0
    && canonicalTargetsLinked.length === new Set(
      canonicalOwnedAnchors
        .map((a) => a.external_canonical?.url)
        .filter((u): u is string => typeof u === "string")
        .map(normalizeInternalPath)
        .filter((p): p is string => p !== null),
    ).size;
  const navigationalSummary = summarizeNavigationalIntent(input);
  const bestListOffType = bestListOffTypeSummary(input);

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
    `- canonical target links: ${canonicalTargetsLinked.length > 0 ? canonicalTargetsLinked.join(", ") : "none detected from this page"}`,
    `- navigational intent: ${navigationalSummary.gate ? `blocked (${Math.round(navigationalSummary.impression_share * 100)}% impression share)` : "not dominant"}`,
    `- best-list page fit: ${bestListOffType.gate ? `blocked for ${bestListOffType.reason} intent (${Math.round(bestListOffType.impression_share * 100)}% impression share)` : "no deterministic page-type block"}`,
    `- AI Overview: ${aioAnchorCount > 0
        ? `present on ${aioAnchorCount} of ${input.anchorAioPresence.length} anchors (HT cited on ${aioCitedCount}); ${aioImpSharePct}% of cluster impressions on AIO-present anchors`
        : "absent from all anchors with SERP data"}`,
    `- Hopeless queries (pos ≥10, dominate impressions): ${hopelessLine}`,
  );

  const prompt = userParts.join("\n");

  // 60s per-call cap so a single hung request can't block the whole phase.
  const primaryResult = await generateObject({
    model: anthropic(modelId),
    schema: CoverageSchema,
    system: SYSTEM_PROMPT,
    prompt,
    abortSignal: AbortSignal.timeout(60_000),
  });

  const escalationModelId = resolveEscalationModelId(modelId);
  const rawConfidence = Math.max(0, Math.min(1, primaryResult.object.confidence));
  const escalationDecision = shouldEscalateCoverage({
    primaryModelId: modelId,
    escalationModelId,
    rawKind: primaryResult.object.kind,
    rawConfidence,
    cannibalMemberCount,
    externalCanonicalAnchorCount,
    everyAnchorIsExternalCanonical,
    nonCanonicalAioLossAnchorCount: nonCanonicalAioLossAnchors.length,
    aioAnchorCount,
    aioImpressionShare: input.clusterAioImpressionShare,
  });
  let result = primaryResult;
  let selectedModelId = modelId;
  let escalationAttempted = false;
  let escalationUsed = false;
  let escalationError: string | undefined;
  let totalInputTokens = primaryResult.usage?.inputTokens ?? 0;
  let totalOutputTokens = primaryResult.usage?.outputTokens ?? 0;

  if (escalationDecision.escalate && escalationModelId) {
    escalationAttempted = true;
    try {
      const escalatedResult = await generateObject({
        model: anthropic(escalationModelId),
        schema: CoverageSchema,
        system: SYSTEM_PROMPT,
        prompt,
        abortSignal: AbortSignal.timeout(60_000),
      });
      result = escalatedResult;
      selectedModelId = escalationModelId;
      escalationUsed = true;
      totalInputTokens += escalatedResult.usage?.inputTokens ?? 0;
      totalOutputTokens += escalatedResult.usage?.outputTokens ?? 0;
    } catch (err) {
      escalationError = err instanceof Error ? err.message : String(err);
    }
  }

  // Defensive normalization. The prompt states these rules but the model
  // doesn't always honor them; we enforce here so DB invariants hold.
  let kind: CoverageKind = result.object.kind;
  let confidence = Math.max(0, Math.min(1, result.object.confidence));
  let recommendation = result.object.recommendation.trim();
  let startWith = (result.object.start_with ?? [])
    .filter((q) => validAnchors.has(q) && !externallyCanonicalized.has(q))
    .slice(0, 3);

  if (recommendation.length > 650 && AUTHOR_ACTIONABLE_KINDS.has(kind)) {
    confidence = Math.min(confidence, 0.55);
  }

  // Hard canonical gate. If every priority anchor already has a different
  // HT page ranking top-10, no author task should be created on this URL,
  // regardless of what the model inferred from body coverage.
  if (everyAnchorIsExternalCanonical) {
    startWith = [];
    confidence = Math.max(confidence, 0.85);
    if (
      everyCanonicalTargetAlreadyLinked
      && allowsSatisfiedCanonicalOverlap(input.pageContentType)
    ) {
      kind = "coverage_strong";
      recommendation = buildSatisfiedCanonicalOverlapRecommendation(input, canonicalTargetsLinked);
    } else {
      kind = "cede";
      recommendation = buildCanonicalCedeRecommendation(input);
    }
  }

  if (navigationalSummary.gate) {
    const sample =
      navigationalSummary.anchor_queries[0]
      ?? navigationalSummary.member_queries[0]
      ?? input.canonicalQuery;
    kind = "wrong_page";
    startWith = [];
    confidence = Math.max(confidence, 0.85);
    recommendation = `Do not target this article for "${sample}": the cluster is dominated by navigational intent. Monitor the query or route any user-path fix outside the article update queue.`;
  }

  if (bestListOffType.gate && !navigationalSummary.gate) {
    const sample = bestListOffType.sample ?? input.canonicalQuery;
    const destination = bestListOffType.reason === "broad_price_or_cost"
      ? "a dedicated price or cost guide"
      : "the dedicated brand or product page";
    kind = "wrong_page";
    startWith = [];
    confidence = Math.max(confidence, 0.85);
    recommendation = `Do not target this best list for "${sample}": that intent belongs on ${destination}. Keep any mention as comparison context and link to the canonical owner instead of expanding the listicle around this term.`;
  }

  // (a) consolidate / cede require a real cannibalization signal. If the model
  //     picks them without one, downgrade to needs_review so an admin can
  //     re-categorize rather than silently mislabel.
  if (
    kind === "consolidate"
    && cannibalMemberCount === 0
  ) {
    kind = "needs_review";
    confidence = Math.min(confidence, 0.4);
  }
  if (
    kind === "cede"
    && cannibalMemberCount === 0
    && externalCanonicalAnchorCount === 0
  ) {
    kind = "needs_review";
    confidence = Math.min(confidence, 0.4);
  }

  // (a2) ai_overview_loss requires AIO presence on at least one anchor — and
  //      strictly speaking, on at least one NON-canonical anchor where THIS
  //      page is NOT cited. Canonical-owned AIO gaps belong to their canonical
  //      pages, not this URL.
  if (kind === "ai_overview_loss" && nonCanonicalAioLossAnchors.length === 0) {
    kind = "needs_review";
    confidence = Math.min(confidence, 0.4);
  }

  // (b) coverage_strong / wrong_page / cede should have empty start_with.
  //     ai_overview_loss keeps the non-canonical AIO-loss anchors visible so
  //     empty start_with really means "nothing to attack here."
  if (
    kind === "coverage_strong" ||
    kind === "wrong_page" ||
    kind === "cede"
  ) {
    startWith = [];
  } else if (kind === "ai_overview_loss") {
    startWith = nonCanonicalAioLossAnchors.slice(0, 3);
  }

  // (c) actionable kinds should have at least one start_with anchor (the prose
  //     names one). If the model returned an empty list (or every pick was
  //     invalid, or every pick was externally canonicalized), walk forward
  //     through `input.anchors` to find the first un-canonicalized one. If
  //     none exists, every anchor's topic is owned by another HT page and
  //     the right verdict is `cede` regardless of what the model picked.
  const actionableKinds: CoverageKind[] = [
    "coverage_partial",
    "intent_gap",
    "snippet_ctr",
    "consolidate",
    "ai_overview_loss",
  ];
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

  let canonicalMentionViolations = findUnsafeCanonicalMentions(
    recommendation,
    input.anchors,
  );
  const unsafeCanonicalMentionViolations = canonicalMentionViolations;
  const unsafeCanonicalMentionCount = canonicalMentionViolations.length;
  if (canonicalMentionViolations.length > 0) {
    kind = "needs_review";
    startWith = [];
    confidence = Math.min(confidence, 0.4);
    recommendation = buildCanonicalReviewRecommendation(input.page, canonicalMentionViolations);
  }

  let unsupportedProductMentions = findUnsupportedProductMentions(recommendation, input);
  const unsafeUnsupportedProductMentions = unsupportedProductMentions;
  const unsafeUnsupportedProductMentionCount = unsupportedProductMentions.length;
  if (unsupportedProductMentions.length > 0) {
    kind = "needs_review";
    startWith = [];
    confidence = Math.min(confidence, 0.4);
    recommendation = buildUnsupportedProductReviewRecommendation(
      unsupportedProductMentions,
      recommendation,
    );
  }

  const hasUnsafeGuardrail =
    unsafeCanonicalMentionCount > 0
    || unsafeUnsupportedProductMentionCount > 0
    || (kind === "needs_review" && confidence <= 0.4);
  const allowModerateConfidenceReady = shouldAllowModerateConfidenceReady({
    kind,
    confidence,
    startWith,
    recommendation,
    canonicalViolationCount: unsafeCanonicalMentionCount,
    hasUnsafeGuardrail,
  });

  if (
    AUTHOR_ACTIONABLE_KINDS.has(kind)
    && confidence < 0.6
    && !allowModerateConfidenceReady
  ) {
    kind = "needs_review";
    startWith = [];
    recommendation = buildLowConfidenceRecommendation(recommendation);
  }

  if (kind === "needs_review") {
    startWith = [];
    if (!recommendation.startsWith("Review before assigning:")) {
      recommendation = buildReviewRecommendation(
        "classifier routed this cluster to review instead of an author-ready task",
        recommendation,
      );
    }
    // Re-run after wrapping the prose; the wrapper may repeat canonical query
    // text in the diagnostic clause and should still be audited.
    canonicalMentionViolations = findUnsafeCanonicalMentions(
      recommendation,
      input.anchors,
    );
    if (canonicalMentionViolations.length > 0) {
      recommendation = buildCanonicalReviewRecommendation(input.page, canonicalMentionViolations);
    }
    if (unsafeUnsupportedProductMentionCount === 0) {
      unsupportedProductMentions = findUnsupportedProductMentions(recommendation, input);
      if (unsupportedProductMentions.length > 0) {
        recommendation = buildUnsupportedProductReviewRecommendation(
          unsupportedProductMentions,
          recommendation,
        );
      }
    }
  }

  const guardrails: string[] = [];
  if (externalCanonicalAnchorCount > 0) {
    guardrails.push(`${externalCanonicalAnchorCount} canonical-owned anchor(s) excluded from author targets`);
  }
  if (canonicalTargetsLinked.length > 0) {
    guardrails.push(`${canonicalTargetsLinked.length} canonical target(s) already linked from this page`);
  }
  if (nonCanonicalAioLossAnchors.length > 0) {
    guardrails.push(`${nonCanonicalAioLossAnchors.length} non-canonical AIO-loss anchor(s) available for source-friendly rewrites`);
  }
  if (navigationalSummary.gate) {
    guardrails.push("navigational intent blocked from author targets");
  }
  if (bestListOffType.gate) {
    guardrails.push("best-list page type blocked exact brand/product or broad price intent");
  }
  if (unsafeCanonicalMentionCount > 0) {
    guardrails.push("canonical-owned anchor appeared in action prose; routed to review");
  }
  if (unsafeUnsupportedProductMentionCount > 0) {
    guardrails.push("unsupported product/model name appeared in prose; routed to review");
  }
  if (confidence < 0.6 && !allowModerateConfidenceReady) {
    guardrails.push("confidence below author-task threshold");
  }
  if (allowModerateConfidenceReady) {
    guardrails.push("moderate confidence accepted: concrete non-canonical author task");
  }
  const editorActionability = deriveEditorActionability({
    kind,
    confidence,
    startWith,
    canonicalViolationCount: unsafeCanonicalMentionCount,
    allowModerateConfidenceReady,
  });
  const standaloneArticle = scoreStandaloneArticleCandidate({
    input,
    kind,
    navigationalGate: navigationalSummary.gate,
    externalCanonicalAnchorCount,
  });
  const recommendationAudit = buildRecommendationTriggers({
    input,
    kind,
    confidence,
    navigationalGate: navigationalSummary.gate,
    externalCanonicalAnchorCount,
    nonCanonicalAioLossAnchors,
    cannibalMemberCount,
    standaloneArticle,
  });
  const editorGapChecklist = buildEditorGapChecklist({
    input,
    kind,
    editorActionability,
    triggers: recommendationAudit,
    standaloneArticle,
    recommendation,
  });
  const aioSerpAudit = buildAioSerpAudit(input);
  const internalLinkRecommendations = (input.internalLinkRecommendations ?? [])
    .slice(0, 6);

  return {
    kind,
    recommendation,
    confidence,
    startWith,
    modelId: selectedModelId,
    promptVersion: COVERAGE_PROMPT_VERSION,
    audit: {
      prompt_version: COVERAGE_PROMPT_VERSION,
      page: input.page,
      page_content_type: input.pageContentType,
      page_content_type_signals: input.pageContentTypeSignals ?? [],
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
      external_canonical_anchor_count: externalCanonicalAnchorCount,
      canonical_owned_anchor_queries: canonicalOwnedAnchors.map((a) => a.query),
      actionable_anchor_queries: actionableAnchors.map((a) => a.query),
      canonical_targets_already_linked: canonicalTargetsLinked,
      navigational_intent_gate: navigationalSummary.gate,
      navigational_impression_share: navigationalSummary.impression_share,
      supported_editorial_intent_share: navigationalSummary.supported_intent_share,
      navigational_anchor_queries: navigationalSummary.anchor_queries,
      best_list_page_type_gate: bestListOffType.gate,
      best_list_page_type_gate_reason: bestListOffType.reason,
      best_list_page_type_gate_query: bestListOffType.sample,
      best_list_page_type_gate_impression_share: bestListOffType.impression_share,
      standalone_article: standaloneArticle,
      recommendation_audit: recommendationAudit,
      editor_gap_checklist: editorGapChecklist,
      internal_link_recommendations: internalLinkRecommendations,
      aio_serp: aioSerpAudit,
      aio_present_on_serp: aioSerpAudit.aio_present_on_serp,
      aio_present_on_serp_queries: aioSerpAudit.aio_present_on_serp_queries,
      aio_citation_seen: aioSerpAudit.aio_citation_seen,
      aio_citation_seen_queries: aioSerpAudit.aio_citation_seen_queries,
      ai_platform_citation_seen: aioSerpAudit.ai_platform_citation_seen,
      citation_source: aioSerpAudit.citation_source,
      noncanonical_aio_loss_anchor_count: nonCanonicalAioLossAnchors.length,
      canonical_mention_violation_count: unsafeCanonicalMentionCount,
      canonical_mention_violations: unsafeCanonicalMentionViolations,
      unsupported_product_mention_count: unsafeUnsupportedProductMentionCount,
      unsupported_product_mentions: unsafeUnsupportedProductMentions,
      editor_actionability: editorActionability,
      guardrails,
      primary_model_id: modelId,
      escalation_model_id: escalationModelId,
      escalation_attempted: escalationAttempted,
      escalation_used: escalationUsed,
      escalation_reasons: escalationDecision.reasons,
      escalation_error: escalationError,
    },
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
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
        const canonicalOwned = input.anchors.filter((a) => a.external_canonical);
        const actionable = input.anchors.filter((a) => !a.external_canonical);
        const canonicalSet = new Set(canonicalOwned.map((a) => a.query));
        const nonCanonicalAioLossAnchors = input.anchorAioPresence
          .filter((a) => a.aiOverview && !a.cited && !canonicalSet.has(a.query))
          .map((a) => a.query);
        const nonCanonicalAioLossCount = nonCanonicalAioLossAnchors.length;
        const cannibalMemberCount = input.members.filter(
          (m) => (m.competing_pages?.length ?? 0) > 0,
        ).length;
        const navigationalSummary = summarizeNavigationalIntent(input);
        const standaloneArticle = scoreStandaloneArticleCandidate({
          input,
          kind: "needs_review",
          navigationalGate: navigationalSummary.gate,
          externalCanonicalAnchorCount: canonicalOwned.length,
        });
        const recommendationAudit = buildRecommendationTriggers({
          input,
          kind: "needs_review",
          confidence: 0,
          navigationalGate: navigationalSummary.gate,
          externalCanonicalAnchorCount: canonicalOwned.length,
          nonCanonicalAioLossAnchors,
          cannibalMemberCount,
          standaloneArticle,
        });
        const editorGapChecklist = buildEditorGapChecklist({
          input,
          kind: "needs_review",
          editorActionability: "review",
          triggers: recommendationAudit,
          standaloneArticle,
          recommendation: message,
        });
        const aioSerpAudit = buildAioSerpAudit(input);
        const internalLinkRecommendations = (input.internalLinkRecommendations ?? [])
          .slice(0, 6);
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
            cannibal_member_count: cannibalMemberCount,
            ...summarizeTopicScores(input.members),
            aio_anchor_count: input.anchorAioPresence.filter((a) => a.aiOverview).length,
            aio_cited_count: input.anchorAioPresence.filter((a) => a.aiOverview && a.cited).length,
            aio_impression_share: Math.round(input.clusterAioImpressionShare * 1000) / 1000,
            ...summarizeHopelessQueries(input),
            external_canonical_anchor_count: canonicalOwned.length,
            canonical_owned_anchor_queries: canonicalOwned.map((a) => a.query),
            actionable_anchor_queries: actionable.map((a) => a.query),
            navigational_intent_gate: navigationalSummary.gate,
            navigational_impression_share: navigationalSummary.impression_share,
            supported_editorial_intent_share: navigationalSummary.supported_intent_share,
            navigational_anchor_queries: navigationalSummary.anchor_queries,
            standalone_article: standaloneArticle,
            recommendation_audit: recommendationAudit,
            editor_gap_checklist: editorGapChecklist,
            internal_link_recommendations: internalLinkRecommendations,
            aio_serp: aioSerpAudit,
            aio_present_on_serp: aioSerpAudit.aio_present_on_serp,
            aio_present_on_serp_queries: aioSerpAudit.aio_present_on_serp_queries,
            aio_citation_seen: aioSerpAudit.aio_citation_seen,
            aio_citation_seen_queries: aioSerpAudit.aio_citation_seen_queries,
            ai_platform_citation_seen: aioSerpAudit.ai_platform_citation_seen,
            citation_source: aioSerpAudit.citation_source,
            noncanonical_aio_loss_anchor_count: nonCanonicalAioLossCount,
            canonical_mention_violation_count: 0,
            canonical_mention_violations: [],
            editor_actionability: "review",
            guardrails: ["classification failed"],
            primary_model_id: cachedModelId,
            escalation_model_id: null,
            escalation_attempted: false,
            escalation_used: false,
            escalation_reasons: [],
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
