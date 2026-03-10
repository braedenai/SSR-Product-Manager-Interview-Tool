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

const RATE_LIMIT_DELAY_MS = 4500;
const MAX_RETRIES = 5;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      await sleep(RATE_LIMIT_DELAY_MS);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        message.includes("429") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("quota");

      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const backoff = Math.pow(2, attempt) * 10_000 + Math.random() * 5_000;
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

export async function generatePersonaResponse(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = getClient(apiKey);
  return withRetry(async () => {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: userPrompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 256,
        systemInstruction: systemPrompt,
      },
    });
    return response.text ?? "";
  });
}

export async function getEmbedding(
  apiKey: string,
  text: string
): Promise<number[]> {
  const client = getClient(apiKey);
  return withRetry(async () => {
    const response = await client.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
    });
    return response.embeddings?.[0]?.values ?? [];
  });
}

export async function getEmbeddings(
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
