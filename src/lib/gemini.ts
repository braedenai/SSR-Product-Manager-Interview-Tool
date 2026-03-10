import { GoogleGenerativeAI } from "@google/generative-ai";

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(apiKey: string): GoogleGenerativeAI {
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

export async function generatePersonaResponse(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const genAI = getGenAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 256,
    },
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

export async function getEmbedding(
  apiKey: string,
  text: string
): Promise<number[]> {
  const genAI = getGenAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-embedding-001",
  });

  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function getEmbeddings(
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  const results = await Promise.all(
    texts.map((text) => getEmbedding(apiKey, text))
  );
  return results;
}
