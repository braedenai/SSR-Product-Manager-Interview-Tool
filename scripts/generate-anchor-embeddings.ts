/**
 * One-time script to pre-compute reference anchor embeddings.
 * Run: npx tsx scripts/generate-anchor-embeddings.ts
 * Requires GOOGLE_API_KEY env var.
 */
import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "fs";
import { join } from "path";

const REFERENCE_ANCHOR_SETS: string[][] = [
  [
    "I would absolutely not buy this product. It has no appeal to me whatsoever and I see zero value in it.",
    "I am unlikely to purchase this product. It does not seem like something I need or want.",
    "I am neutral about this product. I might consider buying it under certain circumstances, but I am not strongly inclined either way.",
    "I would likely purchase this product. It seems useful and appeals to my needs.",
    "I would definitely buy this product. It is exactly what I have been looking for and I see tremendous value in it.",
  ],
  [
    "This product is completely irrelevant to my life. I cannot imagine any scenario where I would spend money on it.",
    "This product does not really interest me. I would probably pass on it if I saw it in a store.",
    "This product is somewhat interesting. I could see myself maybe buying it if the price were right.",
    "This product is quite appealing to me. I would seriously consider purchasing it in the near future.",
    "This product is a must-have for me. I would buy it immediately without hesitation.",
  ],
  [
    "I strongly dislike this concept and would never consider purchasing it. It seems like a waste of money.",
    "I have little interest in this product. It is not something I would prioritize spending on.",
    "I have mixed feelings about this product. There are some aspects I like but also some concerns.",
    "I find this product attractive and would be willing to pay for it. It addresses a real need I have.",
    "I am extremely enthusiastic about this product. I would purchase it right away and recommend it to others.",
  ],
  [
    "There is no chance I would buy this. The concept fails to address any problem I have or desire I hold.",
    "I doubt I would purchase this product. It seems marginally useful but not enough to justify the cost.",
    "I am on the fence about this product. It has potential but I would need to learn more before deciding.",
    "I am positively inclined toward buying this product. It seems well-designed and beneficial.",
    "I am completely sold on this product. It is innovative, valuable, and I would buy it at full price today.",
  ],
  [
    "This product does not resonate with me at all. I would actively avoid buying it.",
    "I am not particularly drawn to this product. It might work for some people, but not for me.",
    "This product is okay. I can see its merits but also its drawbacks, so I am undecided.",
    "This product looks promising and I would most likely purchase it if given the opportunity.",
    "This product is outstanding. I have a strong desire to purchase it and see it as a great investment.",
  ],
  [
    "I feel strongly negative about this product. Purchasing it would be the last thing on my mind.",
    "This product is below average in my view. I would not go out of my way to buy it.",
    "This product is decent. I neither love it nor dislike it, and my purchase decision would depend on context.",
    "This product is above average and I feel good about potentially buying it. It meets several of my criteria.",
    "This product is exceptional. I would buy it in a heartbeat and feel confident it is worth every penny.",
  ],
];

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("Set GOOGLE_API_KEY env var");
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });
  const allTexts = REFERENCE_ANCHOR_SETS.flat();

  console.log(`Embedding ${allTexts.length} anchor statements...`);
  const response = await client.models.embedContent({
    model: "gemini-embedding-001",
    contents: allTexts,
  });

  const allVectors = (response.embeddings ?? []).map((e) => e.values ?? []);

  // Reshape into [6][5][dim]
  const shaped: number[][][] = [];
  let idx = 0;
  for (let s = 0; s < 6; s++) {
    const set: number[][] = [];
    for (let r = 0; r < 5; r++) {
      set.push(allVectors[idx++]);
    }
    shaped.push(set);
  }

  const outPath = join(__dirname, "..", "src", "lib", "anchor-embeddings.json");
  writeFileSync(outPath, JSON.stringify(shaped));
  console.log(`Wrote ${outPath} (${allVectors[0].length} dimensions per vector)`);
}

main().catch(console.error);
