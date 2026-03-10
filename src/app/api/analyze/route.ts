import { NextRequest } from "next/server";
import { generatePersonaResponse, getEmbeddings } from "@/lib/gemini";
import { buildPersonaSystemPrompt, buildElicitationPrompt } from "@/lib/personas";
import { REFERENCE_ANCHOR_SETS } from "@/lib/reference-anchors";
import { computeSSRScore, meanPurchaseIntent } from "@/lib/ssr-engine";
import type { Demographics, PersonaResult } from "@/types";

export const maxDuration = 300;

interface AnalyzeBody {
  concept: string;
  demographics: Demographics[];
  personaCount: number;
  apiKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeBody = await request.json();
    const { concept, demographics, personaCount, apiKey } = body;

    if (!concept || !apiKey || !demographics || demographics.length === 0) {
      return Response.json(
        { error: "Missing required fields: concept, apiKey, and at least one demographic profile." },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
          );
        }

        try {
          // Step 1: Embed all reference anchor sets (6 sets × 5 anchors = 30 embeddings)
          send("status", "Embedding reference anchor statements...");
          const allAnchors = REFERENCE_ANCHOR_SETS.flat();
          const allAnchorEmbeddings = await getEmbeddings(apiKey, allAnchors);

          // Reshape into [6][5][dim]
          const anchorSetEmbeddings: number[][][] = [];
          let idx = 0;
          for (let s = 0; s < REFERENCE_ANCHOR_SETS.length; s++) {
            const setEmbeddings: number[][] = [];
            for (let r = 0; r < 5; r++) {
              setEmbeddings.push(allAnchorEmbeddings[idx++]);
            }
            anchorSetEmbeddings.push(setEmbeddings);
          }

          send("status", "Reference anchors embedded. Starting persona simulations (pacing requests to stay within API rate limits)...");

          // Build the list of personas to simulate
          const personaProfiles: Demographics[] = [];
          for (let i = 0; i < personaCount; i++) {
            personaProfiles.push(demographics[i % demographics.length]);
          }

          const personas: PersonaResult[] = [];

          for (let i = 0; i < personaProfiles.length; i++) {
            const demo = personaProfiles[i];
            send("progress", {
              current: i + 1,
              total: personaProfiles.length,
              message: `Simulating persona ${i + 1} of ${personaProfiles.length}...`,
            });

            const systemPrompt = buildPersonaSystemPrompt(demo);
            const elicitationPrompt = buildElicitationPrompt(concept);

            // n=2 samples per persona, averaged
            const sample1 = await generatePersonaResponse(apiKey, systemPrompt, elicitationPrompt);
            const sample2 = await generatePersonaResponse(apiKey, systemPrompt, elicitationPrompt);

            const combinedResponse = `${sample1} ${sample2}`;

            // Embed the combined response
            const responseEmbeddings = await getEmbeddings(apiKey, [combinedResponse]);
            const responseEmbedding = responseEmbeddings[0];

            // Compute SSR score
            const likertDist = computeSSRScore(responseEmbedding, anchorSetEmbeddings, 1);
            const pi = meanPurchaseIntent(likertDist);

            const personaResult: PersonaResult = {
              personaId: i + 1,
              demographics: demo,
              rawResponse: combinedResponse,
              likertDistribution: likertDist,
              meanPI: Math.round(pi * 100) / 100,
            };

            personas.push(personaResult);
            send("persona_complete", personaResult);
          }

          // Aggregate results
          const overallMeanPI =
            Math.round(
              (personas.reduce((sum, p) => sum + p.meanPI, 0) / personas.length) * 100
            ) / 100;

          const distributionAggregated = [0, 0, 0, 0, 0];
          for (const p of personas) {
            for (let r = 0; r < 5; r++) {
              distributionAggregated[r] += p.likertDistribution[r] / personas.length;
            }
          }

          // Categorize qualitative feedback
          const positive: string[] = [];
          const negative: string[] = [];
          const neutral: string[] = [];

          for (const p of personas) {
            if (p.meanPI >= 3.5) {
              positive.push(p.rawResponse);
            } else if (p.meanPI <= 2.5) {
              negative.push(p.rawResponse);
            } else {
              neutral.push(p.rawResponse);
            }
          }

          send("complete", {
            personas,
            overallMeanPI,
            distributionAggregated,
            qualitativeFeedback: { positive, negative, neutral },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error occurred";
          send("error", { message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
