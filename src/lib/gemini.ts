import { GoogleGenerativeAI } from "@google/generative-ai";

let genAIInstance: GoogleGenerativeAI | null = null;
let cachedApiKey: string | null = null;

function getGenAI(apiKey: string): GoogleGenerativeAI {
  if (!genAIInstance || cachedApiKey !== apiKey) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
    cachedApiKey = apiKey;
  }
  return genAIInstance;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRIES = 4;
const BACKOFFS = [5000, 9000, 13000, 20000];

let callDelay = 1500;
const MIN_DELAY = 500;
const MAX_DELAY = 8000;
let lastCallTs = 0;

async function paceCall(): Promise<void> {
  const elapsed = Date.now() - lastCallTs;
  if (lastCallTs > 0 && elapsed < callDelay) {
    const wait = callDelay - elapsed;
    await sleep(wait);
  }
  lastCallTs = Date.now();
}

function adaptPacing(hitLimit: boolean): void {
  const prev = callDelay;
  if (hitLimit) {
    callDelay = Math.min(callDelay * 1.5, MAX_DELAY);
  } else {
    callDelay = Math.max(callDelay * 0.85, MIN_DELAY);
  }
  if (Math.abs(prev - callDelay) > 50) {
    console.log(`[gemini] Pacing adjusted: ${Math.round(prev)}ms -> ${Math.round(callDelay)}ms`);
  }
}

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|503|rate|quota|RESOURCE_EXHAUSTED|overloaded|too many|capacity/i.test(
    msg
  );
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await paceCall();
      const result = await fn();
      adaptPacing(false);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isRetryable(err) || attempt === MAX_RETRIES) {
        console.error(`[gemini] ${label} FAILED (attempt ${attempt + 1}/${MAX_RETRIES + 1}, non-retryable): ${msg}`);
        throw err;
      }
      const backoff = BACKOFFS[attempt] ?? 20000;
      console.warn(`[gemini] ${label} retryable error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), waiting ${backoff}ms: ${msg}`);
      adaptPacing(true);
      await sleep(backoff);
    }
  }
  throw new Error("Max retries exceeded");
}

export async function generatePersonaResponse(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return withRetry("generateContent", async () => {
    const genAI = getGenAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-04-17",
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 256,
      },
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  });
}

export async function getEmbedding(
  apiKey: string,
  text: string
): Promise<number[]> {
  return withRetry("embedContent", async () => {
    const genAI = getGenAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "text-embedding-004",
    });
    const result = await model.embedContent(text);
    return result.embedding.values;
  });
}

export async function getEmbeddings(
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(await getEmbedding(apiKey, texts[i]));
  }
  return results;
}
