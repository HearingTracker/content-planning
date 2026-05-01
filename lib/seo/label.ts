// Cluster labeling via Haiku.
//
// One LLM call per cluster: takes the member queries + Ahrefs intent prior +
// brand/retailer context and returns a short editorial label. Structured
// output (Zod) so we never parse strings. Audit digest captures what the
// model saw, for the 1A.5 admin review screen and future prompt iteration.
//
// Model selection: SEO_LABEL_MODEL is gateway-style ('anthropic/claude-haiku-4-5')
// but we route directly through @ai-sdk/anthropic in 1A since the project
// uses ANTHROPIC_API_KEY rather than AI_GATEWAY_API_KEY. Provider prefix is
// stripped at runtime; switch to AI Gateway when the key lands.

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

const LabelSchema = z.object({
  label: z
    .string()
    .min(2)
    .max(80)
    .describe(
      "3–7 word natural-language topic label, naturally written, specific. Examples: 'Phonak hearing aid pricing', 'Best hearing aids for severe loss', 'How to clean hearing aids'.",
    ),
});

export const LABEL_PROMPT_VERSION =
  process.env.SEO_LABEL_PROMPT_VERSION ?? "v1";

function resolveModelId(): string {
  const raw = process.env.SEO_LABEL_MODEL;
  if (!raw) throw new Error("SEO_LABEL_MODEL not set");
  // Direct Anthropic provider takes the bare model id.
  return raw.replace(/^anthropic\//, "");
}

const SYSTEM_PROMPT = `You are a content strategist labeling search-query clusters for editorial planning.

Given a group of related search queries from Google Search Console, write a short topic label (3–7 words, natural language) that describes what this cluster of queries is collectively asking about.

Rules:
- Topical or action-oriented (e.g., "Phonak hearing aid pricing", "How to clean hearing aids")
- Naturally written. Not keyword-stuffed.
- Specific enough to distinguish from neighboring topics on the same page.
- Not just a paraphrase of one query — describe what the *group* is asking about.
- Title Case for noun-phrase topics; sentence case for question/action labels.
- Do NOT include the words "queries", "search", "topic", or "cluster" in the label.
- If a brand or retailer context is provided, incorporate it naturally when relevant.`;

export type LabelInput = {
  memberQueries: string[];
  ahrefsIntentPrior?: string | null;
  brand?: string | null;
  retailer?: string | null;
  productFamily?: string | null;
};

export type LabelResult = {
  label: string;
  modelId: string;
  promptVersion: string;
  audit: {
    prompt_version: string;
    member_count: number;
    ahrefs_intent_prior: string | null;
    brand: string | null;
    retailer: string | null;
    product_family: string | null;
    member_queries: string[];
  };
  tokens: { input: number; output: number };
};

export async function labelCluster(input: LabelInput): Promise<LabelResult> {
  if (input.memberQueries.length === 0) {
    throw new Error("labelCluster: memberQueries cannot be empty");
  }

  const modelId = resolveModelId();
  const userLines: string[] = [];
  userLines.push("Member queries:");
  for (const q of input.memberQueries) userLines.push(`- ${q}`);
  if (input.brand) userLines.push(`\nBrand context: ${input.brand}`);
  if (input.retailer) userLines.push(`Retailer context: ${input.retailer}`);
  if (input.productFamily) userLines.push(`Product family: ${input.productFamily}`);
  if (input.ahrefsIntentPrior) {
    userLines.push(`Ahrefs intent prior: ${input.ahrefsIntentPrior}`);
  }

  const result = await generateObject({
    model: anthropic(modelId),
    schema: LabelSchema,
    system: SYSTEM_PROMPT,
    prompt: userLines.join("\n"),
  });

  return {
    label: result.object.label.trim(),
    modelId,
    promptVersion: LABEL_PROMPT_VERSION,
    audit: {
      prompt_version: LABEL_PROMPT_VERSION,
      member_count: input.memberQueries.length,
      ahrefs_intent_prior: input.ahrefsIntentPrior ?? null,
      brand: input.brand ?? null,
      retailer: input.retailer ?? null,
      product_family: input.productFamily ?? null,
      member_queries: input.memberQueries,
    },
    tokens: {
      input: result.usage?.inputTokens ?? 0,
      output: result.usage?.outputTokens ?? 0,
    },
  };
}

/**
 * Concurrency-controlled bulk label runner. Phase 1A typically labels ~20–80
 * clusters per sync; concurrency=5 keeps latency reasonable without flooding
 * the provider. Returns results in the same order as input.
 */
export async function labelClustersConcurrently(
  inputs: LabelInput[],
  opts: { concurrency?: number; onResult?: (i: number, r: LabelResult) => void } = {},
): Promise<LabelResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 5);
  const results: LabelResult[] = new Array(inputs.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= inputs.length) return;
      const r = await labelCluster(inputs[i]);
      results[i] = r;
      opts.onResult?.(i, r);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, worker);
  await Promise.all(workers);
  return results;
}
