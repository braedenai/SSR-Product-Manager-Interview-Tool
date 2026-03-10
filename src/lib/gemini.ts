import { GoogleGenAI } from "@google/genai";

let clientInstance: GoogleGenAI | null = null;
let currentKey: string = "";

function getClient(apiKey: string): GoogleGenAI {
  if (!clientInstance || currentKey !== apiKey) {
    clientInstance = new GoogleGenAI({ apiKey });
    currentKey = apiKey;
  }
  return clientInstance;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LLM_MODEL = "gemini-3.1-flash-lite-preview";
const EMBED_MODEL = "gemini-embedding-001";
const MAX_RETRIES = 4;

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
}

export interface CallResult {
  text: string;
  hitRateLimit: boolean;
}

/**
 * Single LLM call with short retry backoffs.
 * Returns the result plus whether it encountered a rate limit (even if retried successfully).
 */
export async function generateOne(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<CallResult> {
  const client = getClient(apiKey);
  let hitRateLimit = false;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: LLM_MODEL,
        contents: userPrompt,
        config: {
          temperature: 0.5,
          maxOutputTokens: 256,
          systemInstruction: systemPrompt,
        },
      });
      return { text: response.text ?? "", hitRateLimit };
    } catch (err: unknown) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES - 1) {
        hitRateLimit = true;
        const backoff = 5_000 + attempt * 4_000 + Math.random() * 2_000;
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

export async function getEmbeddingsBatch(
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  const client = getClient(apiKey);
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.embedContent({
        model: EMBED_MODEL,
        contents: texts,
      });
      return (response.embeddings ?? []).map((e) => e.values ?? []);
    } catch (err: unknown) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES - 1) {
        const backoff = 5_000 + attempt * 4_000 + Math.random() * 2_000;
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}
