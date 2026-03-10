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

const MAX_RETRIES = 5;

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("quota")
  );
}

async function withRetry<T>(fn: () => Promise<T>, paceMs: number = 0): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      if (paceMs > 0) await sleep(paceMs);
      return result;
    } catch (err: unknown) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES - 1) {
        const backoff = Math.pow(2, attempt) * 10_000 + Math.random() * 5_000;
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Single LLM call with retry.
 */
export async function generateOne(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string = "gemini-2.5-flash",
  paceMs: number = 0
): Promise<string> {
  const client = getClient(apiKey);
  return withRetry(async () => {
    const response = await client.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 256,
        systemInstruction: systemPrompt,
      },
    });
    return response.text ?? "";
  }, paceMs);
}

/**
 * Fire multiple LLM calls in parallel. Returns results in order.
 * Throws on any failure (including rate limits).
 */
export async function generateParallel(
  apiKey: string,
  calls: { systemPrompt: string; userPrompt: string }[]
): Promise<string[]> {
  const client = getClient(apiKey);
  const promises = calls.map((c) =>
    client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: c.userPrompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 256,
        systemInstruction: c.systemPrompt,
      },
    })
  );
  const responses = await Promise.all(promises);
  return responses.map((r) => r.text ?? "");
}

/**
 * Detect whether this API key has paid-tier rate limits
 * by making a fast, cheap probe call.
 */
export async function detectTier(apiKey: string): Promise<"paid" | "free"> {
  const client = getClient(apiKey);
  try {
    const fast = Array.from({ length: 3 }, () =>
      client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Say OK",
        config: { maxOutputTokens: 5 },
      })
    );
    await Promise.all(fast);
    return "paid";
  } catch (err: unknown) {
    if (isRateLimitError(err)) return "free";
    throw err;
  }
}

export async function getEmbeddingsBatch(
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  const client = getClient(apiKey);
  return withRetry(async () => {
    const response = await client.models.embedContent({
      model: "gemini-embedding-001",
      contents: texts,
    });
    return (response.embeddings ?? []).map((e) => e.values ?? []);
  }, 0);
}
