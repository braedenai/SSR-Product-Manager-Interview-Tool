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

async function withRetry<T>(
  fn: () => Promise<T>,
  paceMs: number = 0
): Promise<T> {
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

export interface ConcurrencyMode {
  parallel: boolean;
  paceMs: number;
}

/**
 * Try a batch of parallel calls. If any hit a rate limit,
 * signal that we need to fall back to sequential mode.
 */
export async function generatePersonaResponsesBatch(
  apiKey: string,
  calls: { systemPrompt: string; userPrompt: string }[],
  mode: ConcurrencyMode
): Promise<{ results: string[]; mode: ConcurrencyMode }> {
  const client = getClient(apiKey);
  let currentMode = { ...mode };

  if (currentMode.parallel) {
    try {
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
      return {
        results: responses.map((r) => r.text ?? ""),
        mode: currentMode,
      };
    } catch (err: unknown) {
      if (isRateLimitError(err)) {
        currentMode = { parallel: false, paceMs: 4500 };
        // Fall through to sequential below
      } else {
        throw err;
      }
    }
  }

  // Sequential with pacing and retry
  const results: string[] = [];
  for (const c of calls) {
    const text = await withRetry(async () => {
      const response = await client.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: c.userPrompt,
        config: {
          temperature: 0.5,
          maxOutputTokens: 256,
          systemInstruction: c.systemPrompt,
        },
      });
      return response.text ?? "";
    }, currentMode.paceMs);
    results.push(text);
  }

  return { results, mode: currentMode };
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
  });
}
