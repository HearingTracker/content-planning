// Batch embedding for SEO query clustering.
//
// Phase 1A uses OpenAI text-embedding-3-small at 1536 dimensions. The model
// and dimensions are a *versioned pair*: changing dimensions is a documented
// migration event (re-embed everything, change vector(N) columns), not a
// silent env swap. We assert this at boot and at every batch.

import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

// Known native dimensions per model. If you add a model, add it here.
const MODEL_NATIVE_DIM: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

export type EmbeddingConfig = {
  provider: "openai";
  model: string;
  dimensions: number;
};

function readConfig(): EmbeddingConfig {
  const provider = process.env.SEO_EMBEDDING_PROVIDER;
  const model = process.env.SEO_EMBEDDING_MODEL;
  const dimRaw = process.env.SEO_EMBEDDING_DIMENSIONS;

  if (!provider) throw new Error("SEO_EMBEDDING_PROVIDER not set");
  if (!model) throw new Error("SEO_EMBEDDING_MODEL not set");
  if (!dimRaw) throw new Error("SEO_EMBEDDING_DIMENSIONS not set");
  if (provider !== "openai") {
    throw new Error(`Unsupported SEO_EMBEDDING_PROVIDER='${provider}' (only 'openai' wired in 1A)`);
  }

  const dimensions = Number(dimRaw);
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error(`SEO_EMBEDDING_DIMENSIONS='${dimRaw}' is not a positive integer`);
  }

  const nativeDim = MODEL_NATIVE_DIM[model];
  if (nativeDim == null) {
    throw new Error(
      `Unknown embedding model '${model}'. Add it to MODEL_NATIVE_DIM in lib/seo/embed.ts.`,
    );
  }
  if (nativeDim !== dimensions) {
    throw new Error(
      `Embedding dimension mismatch: model '${model}' is ${nativeDim}-dimensional but ` +
        `SEO_EMBEDDING_DIMENSIONS=${dimensions}. Changing dimensions requires a migration ` +
        `(re-embed everything; alter vector(N) columns).`,
    );
  }

  return { provider: "openai", model, dimensions };
}

// OpenAI embeddings endpoint accepts large batches; in practice we stay well
// under the limit, but chunk defensively in case the query universe grows.
const BATCH_SIZE = 256;

export type EmbeddingResult = {
  embeddings: number[][];
  config: EmbeddingConfig;
  inputTokens: number;
};

export async function embedQueries(values: string[]): Promise<EmbeddingResult> {
  const config = readConfig();
  if (values.length === 0) {
    return { embeddings: [], config, inputTokens: 0 };
  }

  const embeddings: number[][] = [];
  let inputTokens = 0;

  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const chunk = values.slice(i, i + BATCH_SIZE);
    const result = await embedMany({
      model: openai.textEmbeddingModel(config.model),
      values: chunk,
    });
    if (result.embeddings.length !== chunk.length) {
      throw new Error(
        `Embedding count mismatch on batch ${i}: requested ${chunk.length}, got ${result.embeddings.length}`,
      );
    }
    for (const e of result.embeddings) {
      if (e.length !== config.dimensions) {
        throw new Error(
          `Returned embedding has ${e.length} dimensions, expected ${config.dimensions}`,
        );
      }
      embeddings.push(e);
    }
    if (result.usage?.tokens) inputTokens += result.usage.tokens;
  }

  return { embeddings, config, inputTokens };
}

// Postgres `vector` type accepts a string formatted like '[0.1,0.2,…]'.
// Helpers for serializing/parsing keep this concern out of the call sites.
export function vectorToPgLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export function pgLiteralToVector(s: string): number[] {
  if (!s.startsWith("[") || !s.endsWith("]")) {
    throw new Error(`Invalid pg vector literal: ${s.slice(0, 40)}…`);
  }
  return s
    .slice(1, -1)
    .split(",")
    .map((n) => Number(n));
}
