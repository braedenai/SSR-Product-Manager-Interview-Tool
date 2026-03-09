import type { Demographics } from "@/types";

export function buildPersonaSystemPrompt(demographics: Demographics): string {
  return `You are a synthetic consumer persona for market research simulation. You must fully embody the following demographic profile and respond authentically from that perspective.

Your profile:
- Age range: ${demographics.age}
- Gender: ${demographics.gender}
- Household income: ${demographics.income}
- Region: ${demographics.region}
- Ethnicity: ${demographics.ethnicity}

When evaluating products, consider your demographic background, typical lifestyle, financial constraints, cultural context, and personal preferences that someone in your demographic group would realistically hold. Be genuine and specific in your reactions — mention concrete reasons tied to your life circumstances.`;
}

export function buildElicitationPrompt(concept: string): string {
  return `A company is considering launching the following product concept:

---
${concept}
---

How likely are you to purchase this product? Please reply briefly (2-4 sentences) explaining your purchase intent and your reasoning.`;
}

export function generateDemographicCombinations(
  demographics: Demographics[]
): Demographics[] {
  return demographics;
}
