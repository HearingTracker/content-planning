// Per-page query clustering + cross-sync cluster matching.
//
// Phase 1A flow:
//   1. detectBrand() splits queries into mutually-exclusive groups (branded
//      groups by brand; generic queries in their own group). Queries with
//      different group_keys never cluster together.
//   2. Within each group, single-linkage cosine clustering at threshold ~0.55
//      (configurable via SEO_CLUSTER_COSINE_THRESHOLD).
//   3. Each cluster's centroid = l2-normalized mean of member embeddings.
//      Canonical query (medoid) = member with highest cosine to the centroid.
//   4. matchClusters() binds new candidate clusters to existing rows on the
//      same page using a 3-tier procedure (auto / review / new). The decision
//      preserves user state on opportunities by reusing existing cluster ids
//      where binding is confident.

import { detectBrand, type BrandDetection } from "./brand-map";

// ─── Vector helpers ─────────────────────────────────────────────────────────

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function magnitude(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function cosine(a: number[], b: number[]): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  return dot(a, b) / (ma * mb);
}

export function meanCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) throw new Error("meanCentroid requires at least 1 vector");
  const dim = vectors[0].length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) throw new Error("centroid: dimension mismatch across members");
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  for (let i = 0; i < dim; i++) sum[i] /= vectors.length;
  return sum;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ─── Clustering ─────────────────────────────────────────────────────────────

export type ClusterableQuery = {
  query: string;
  embedding: number[];
};

export type ClusterMember<Q extends ClusterableQuery = ClusterableQuery> = Q & {
  similarity_to_centroid: number;
};

export type Cluster<Q extends ClusterableQuery = ClusterableQuery> = {
  brand: string | null;
  retailer: string | null;
  product_family: string | null;
  is_branded: boolean;
  group_key: string | null;
  members: ClusterMember<Q>[];
  centroid: number[];
  /** Member with highest cosine similarity to the centroid. */
  canonical_query: string;
};

/**
 * Single-linkage cosine clustering via union-find. For all pairs (i, j) with
 * cosine ≥ threshold, union their components. Each component becomes one
 * cluster. O(N²) — fine for the page-level N we expect (typically <50).
 */
function unionFindCluster<Q extends ClusterableQuery>(
  items: Q[],
  threshold: number,
): Q[][] {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosine(items[i].embedding, items[j].embedding) >= threshold) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, Q[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(items[i]);
    groups.set(root, list);
  }
  return [...groups.values()];
}

function buildCluster<Q extends ClusterableQuery>(
  members: Q[],
  detection: BrandDetection,
): Cluster<Q> {
  const centroid = meanCentroid(members.map((m) => m.embedding));
  const decorated: ClusterMember<Q>[] = members.map((m) => ({
    ...m,
    similarity_to_centroid: cosine(m.embedding, centroid),
  }));
  decorated.sort((a, b) => b.similarity_to_centroid - a.similarity_to_centroid);

  return {
    brand: detection.brand,
    retailer: detection.retailer,
    product_family: detection.product_family,
    is_branded: detection.is_branded,
    group_key: detection.group_key,
    members: decorated,
    centroid,
    canonical_query: decorated[0].query, // medoid: highest sim to centroid
  };
}

/**
 * Cluster the queries for one page. Group by brand axis first, then run
 * single-linkage cosine clustering within each group.
 */
export function clusterPageQueries<Q extends ClusterableQuery>(
  queries: Q[],
  config: { threshold: number },
): Cluster<Q>[] {
  if (queries.length === 0) return [];

  // Group by brand-axis key (or 'generic' for no detection).
  const groups = new Map<string, { detection: BrandDetection; items: Q[] }>();
  for (const q of queries) {
    const detection = detectBrand(q.query);
    const key = detection.group_key ?? "__generic__";
    const bucket = groups.get(key);
    if (bucket) bucket.items.push(q);
    else groups.set(key, { detection, items: [q] });
  }

  const clusters: Cluster<Q>[] = [];
  for (const { detection, items } of groups.values()) {
    const groupClusters = unionFindCluster(items, config.threshold);
    for (const members of groupClusters) {
      clusters.push(buildCluster(members, detection));
    }
  }
  return clusters;
}

// ─── Cluster matching across syncs ──────────────────────────────────────────

export type ExistingClusterForMatch = {
  id: number;
  current_centroid: number[];
  original_centroid: number[];
  member_queries: Set<string>;
  label: string;
  label_embedding?: number[];
  is_branded: boolean;
  brand: string | null;
  retailer: string | null;
  product_family: string | null;
  coverage_kind?: string | null;
  coverage_recommendation?: string | null;
  coverage_confidence?: number | null;
  coverage_model?: string | null;
  coverage_prompt_v?: string | null;
  coverage_input_digest?: Record<string, unknown> | null;
  coverage_classified_at?: string | null;
  start_with_queries?: string[] | null;
  coverage_cache_key?: string | null;
  coverage_classified_in_job_id?: number | null;
  faq_gaps?: Array<{ question: string; covered: boolean; volume: number | null }> | null;
  competitor_realism?: { verdict: string; reasoning: string } | null;
};

export type CandidateForMatch = {
  centroid: number[];
  members: Set<string>;
  label: string;
  label_embedding?: number[];
  is_branded: boolean;
  brand: string | null;
  retailer: string | null;
  product_family: string | null;
};

export type MatchDecision = "auto" | "review" | "new";

export type MatchResult = {
  candidate_index: number;
  decision: MatchDecision;
  matched_id: number | null;
  score: number | null;
  components: { centroid: number; jaccard: number; label: number | null } | null;
  /** True if `current_centroid` matched well but `original_centroid` had drifted
   *  past driftThreshold — auto-match was rejected, decision forced to 'review'. */
  drift_rejected: boolean;
};

export type MatchConfig = {
  /** ≥ this combined score → auto-match */
  autoThreshold: number;
  /** ≥ this combined score → match-but-flag for admin review */
  reviewThreshold: number;
  /** If candidate-vs-original_centroid cosine drops below this, refuse auto-match */
  driftThreshold: number;
  /** Component weights — must sum to 1.0 */
  weights: { centroid: number; jaccard: number; label: number };
};

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  autoThreshold: 0.72,
  reviewThreshold: 0.55,
  driftThreshold: 0.45,
  weights: { centroid: 0.6, jaccard: 0.3, label: 0.1 },
};

function pairableByAxis(
  candidate: CandidateForMatch,
  existing: ExistingClusterForMatch,
): boolean {
  if (candidate.is_branded !== existing.is_branded) return false;
  if (candidate.brand !== existing.brand) return false;
  if (candidate.retailer !== existing.retailer) return false;
  if (candidate.product_family !== existing.product_family) return false;
  return true;
}

function scoreMatch(
  candidate: CandidateForMatch,
  existing: ExistingClusterForMatch,
  weights: MatchConfig["weights"],
): { score: number; components: { centroid: number; jaccard: number; label: number | null } } {
  const centroidSim = cosine(candidate.centroid, existing.current_centroid);
  const jaccardSim = jaccard(candidate.members, existing.member_queries);
  const labelSim =
    candidate.label_embedding && existing.label_embedding
      ? cosine(candidate.label_embedding, existing.label_embedding)
      : null;

  // If we have no label embedding, redistribute label weight onto centroid.
  const wCentroid = labelSim == null ? weights.centroid + weights.label : weights.centroid;
  const wJaccard = weights.jaccard;
  const wLabel = labelSim == null ? 0 : weights.label;

  const score =
    wCentroid * centroidSim + wJaccard * jaccardSim + wLabel * (labelSim ?? 0);

  return {
    score,
    components: { centroid: centroidSim, jaccard: jaccardSim, label: labelSim },
  };
}

/**
 * Bind candidate clusters to existing cluster rows. Greedy: for each
 * candidate, find best-scoring eligible existing cluster on the same brand
 * axis. Above autoThreshold → auto-match (with drift check); above
 * reviewThreshold → match but flag for review; otherwise → new cluster.
 *
 * Each existing cluster can match at most one candidate. Candidates are
 * processed in input order; if your input ordering matters (it shouldn't
 * for correctness, only for which cluster keeps which id), pass them sorted
 * by score or member_count first.
 */
export function matchClusters(
  candidates: CandidateForMatch[],
  existing: ExistingClusterForMatch[],
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): MatchResult[] {
  const taken = new Set<number>();
  const results: MatchResult[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    let best: { ex: ExistingClusterForMatch; score: number; components: ReturnType<typeof scoreMatch>["components"] } | null = null;

    for (const ex of existing) {
      if (taken.has(ex.id)) continue;
      if (!pairableByAxis(cand, ex)) continue;
      const { score, components } = scoreMatch(cand, ex, config.weights);
      if (!best || score > best.score) best = { ex, score, components };
    }

    if (!best || best.score < config.reviewThreshold) {
      results.push({
        candidate_index: i,
        decision: "new",
        matched_id: null,
        score: null,
        components: null,
        drift_rejected: false,
      });
      continue;
    }

    let decision: MatchDecision = best.score >= config.autoThreshold ? "auto" : "review";
    let driftRejected = false;
    if (decision === "auto") {
      const driftSim = cosine(cand.centroid, best.ex.original_centroid);
      if (driftSim < config.driftThreshold) {
        decision = "review";
        driftRejected = true;
      }
    }

    taken.add(best.ex.id);
    results.push({
      candidate_index: i,
      decision,
      matched_id: best.ex.id,
      score: best.score,
      components: best.components,
      drift_rejected: driftRejected,
    });
  }

  return results;
}
