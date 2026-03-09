/**
 * Semantic Similarity Rating (SSR) Scoring Engine
 *
 * Implements the exact mathematical pipeline from the PRD:
 * 1. Cosine similarity between response and reference vectors
 * 2. Variance adjustment (subtract min)
 * 3. Normalize to PMF (sum = 1)
 * 4. Temperature scaling (T = 1)
 */

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

/**
 * Compute the Likert PMF for a single response against a single anchor set.
 *
 * @param responseEmbedding - embedding vector of the LLM response
 * @param anchorEmbeddings  - 5 embedding vectors for the anchor set (index 0 = score 1, index 4 = score 5)
 * @param temperature       - temperature scaling parameter (default 1)
 */
function computePMFForAnchorSet(
  responseEmbedding: number[],
  anchorEmbeddings: number[][],
  temperature: number = 1
): number[] {
  // Step 1: Cosine similarity
  const similarities = anchorEmbeddings.map((anchor) =>
    cosineSimilarity(anchor, responseEmbedding)
  );

  // Step 2: Variance adjustment — subtract minimum
  const minSim = Math.min(...similarities);
  const adjusted = similarities.map((s) => s - minSim);

  // Step 3: Normalize to PMF
  const sumAdj = adjusted.reduce((a, b) => a + b, 0);
  let pmf: number[];
  if (sumAdj === 0) {
    pmf = adjusted.map(() => 1 / 5);
  } else {
    pmf = adjusted.map((v) => v / sumAdj);
  }

  // Step 4: Temperature scaling — p(r)^(1/T), then re-normalize
  if (temperature !== 1 && temperature > 0) {
    const scaled = pmf.map((p) => Math.pow(Math.max(p, 1e-12), 1 / temperature));
    const scaledSum = scaled.reduce((a, b) => a + b, 0);
    pmf = scaled.map((v) => v / scaledSum);
  }

  return pmf;
}

/**
 * Full SSR scoring: averages the PMF across all m=6 anchor sets
 * as specified in the PRD.
 */
export function computeSSRScore(
  responseEmbedding: number[],
  anchorSetEmbeddings: number[][][],
  temperature: number = 1
): number[] {
  const m = anchorSetEmbeddings.length;
  const pmfs = anchorSetEmbeddings.map((anchorSet) =>
    computePMFForAnchorSet(responseEmbedding, anchorSet, temperature)
  );

  // Average across all anchor sets
  const averaged = [0, 0, 0, 0, 0];
  for (const pmf of pmfs) {
    for (let r = 0; r < 5; r++) {
      averaged[r] += pmf[r] / m;
    }
  }

  return averaged;
}

/**
 * Calculate the mean purchase intent from a Likert PMF.
 * Likert scale is 1-5, so E[X] = sum(r * p(r)) for r=1..5
 */
export function meanPurchaseIntent(pmf: number[]): number {
  let mean = 0;
  for (let r = 0; r < 5; r++) {
    mean += (r + 1) * pmf[r];
  }
  return mean;
}
