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

export async function generatePersonaResponse(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = getClient(apiKey);
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userPrompt,
    config: {
      temperature: 0.5,
      maxOutputTokens: 256,
      systemInstruction: systemPrompt,
    },
  });
  return response.text ?? "";
}

export async function getEmbedding(
  apiKey: string,
  text: string
): Promise<number[]> {
  const client = getClient(apiKey);
  const response = await client.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });
  return response.embeddings?.[0]?.values ?? [];
}

export async function getEmbeddings(
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  const client = getClient(apiKey);
  const response = await client.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
  });
  return (response.embeddings ?? []).map((e) => e.values ?? []);
}
