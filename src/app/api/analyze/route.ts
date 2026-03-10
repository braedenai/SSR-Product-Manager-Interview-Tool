import { NextRequest } from "next/server";
import { generateOne, getEmbeddingsBatch } from "@/lib/gemini";
import {
  buildPersonaSystemPrompt,
  buildElicitationPrompt,
} from "@/lib/personas";
import { computeSSRScore, meanPurchaseIntent } from "@/lib/ssr-engine";
import type { Demographics, PersonaResult } from "@/types";
import cachedAnchors from "@/lib/anchor-embeddings.json";

export const maxDuration = 300;

interface AnalyzeBody {
  concept: string;
  demographics: Demographics[];
  personaCount: number;
  apiKey: string;
  quickMode: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeBody = await request.json();
    const { concept, demographics, personaCount, apiKey, quickMode } = body;

    if (!concept || !apiKey || !demographics || demographics.length === 0) {
      return Response.json(
        {
          error:
            "Missing required fields: concept, apiKey, and at least one demographic profile.",
        },
        { status: 400 }
      );
    }

    const samplesPerPersona = quickMode ? 1 : 2;
    const anchorSetEmbeddings = cachedAnchors as number[][][];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
          );
        }

        try {
          const startTime = Date.now();

          // Build persona profiles
          const personaProfiles: Demographics[] = [];
          for (let i = 0; i < personaCount; i++) {
            personaProfiles.push(demographics[i % demographics.length]);
          }

          const elicitationPrompt = buildElicitationPrompt(concept);
          const totalCalls = personaCount * samplesPerPersona;

          // Build all calls
          const allCalls: { systemPrompt: string; userPrompt: string }[] = [];
          for (const demo of personaProfiles) {
            const sp = buildPersonaSystemPrompt(demo);
            for (let s = 0; s < samplesPerPersona; s++) {
              allCalls.push({ systemPrompt: sp, userPrompt: elicitationPrompt });
            }
          }

          // Keepalive every 8 seconds
          keepaliveTimer = setInterval(() => {
            send("ping", { ts: Date.now() });
          }, 8_000);

          send("phase", {
            phase: "llm",
            message: "Generating persona responses...",
            totalCalls,
          });

          // Adaptive pacing: start conservative, speed up if no rate limits hit
          let paceMs = 5000;
          let consecutiveSuccess = 0;
          const allResponses: string[] = [];
          let everHitRateLimit = false;

          for (let i = 0; i < allCalls.length; i++) {
            const c = allCalls[i];
            const { text, hitRateLimit } = await generateOne(
              apiKey,
              c.systemPrompt,
              c.userPrompt
            );
            allResponses.push(text);

            if (hitRateLimit) {
              everHitRateLimit = true;
              consecutiveSuccess = 0;
              paceMs = Math.min(paceMs + 2000, 8000);
            } else {
              consecutiveSuccess++;
              if (consecutiveSuccess >= 3 && paceMs > 1000) {
                paceMs = Math.max(paceMs - 1000, 500);
              }
            }

            send("progress", {
              completedCalls: allResponses.length,
              totalCalls,
              completedPersonas: Math.floor(allResponses.length / samplesPerPersona),
              totalPersonas: personaCount,
              elapsedMs: Date.now() - startTime,
              isParallel: false,
              isRateLimited: everHitRateLimit,
            });

            // Pace before next call (skip after last one)
            if (i < allCalls.length - 1) {
              await new Promise((r) => setTimeout(r, paceMs));
            }
          }

          // Group responses by persona
          const personaResponses: string[] = [];
          for (let i = 0; i < personaCount; i++) {
            const start = i * samplesPerPersona;
            const samples = allResponses.slice(start, start + samplesPerPersona);
            personaResponses.push(samples.join(" "));
          }

          // Phase 2: Batch embed
          send("phase", {
            phase: "embed",
            message: "Computing semantic embeddings...",
          });

          const responseEmbeddings = await getEmbeddingsBatch(apiKey, personaResponses);

          // Phase 3: Score (instant math)
          send("phase", {
            phase: "score",
            message: "Calculating purchase intent scores...",
          });

          const personas: PersonaResult[] = [];
          for (let i = 0; i < personaCount; i++) {
            const likertDist = computeSSRScore(
              responseEmbeddings[i],
              anchorSetEmbeddings,
              1
            );
            const pi = meanPurchaseIntent(likertDist);
            personas.push({
              personaId: i + 1,
              demographics: personaProfiles[i],
              rawResponse: personaResponses[i],
              likertDistribution: likertDist,
              meanPI: Math.round(pi * 100) / 100,
            });
          }

          // Aggregate
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

          const positive: string[] = [];
          const negative: string[] = [];
          const neutral: string[] = [];
          for (const p of personas) {
            if (p.meanPI >= 3.5) positive.push(p.rawResponse);
            else if (p.meanPI <= 2.5) negative.push(p.rawResponse);
            else neutral.push(p.rawResponse);
          }

          send("complete", {
            personas,
            overallMeanPI,
            distributionAggregated,
            qualitativeFeedback: { positive, negative, neutral },
            totalElapsedMs: Date.now() - startTime,
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Unknown error occurred";
          send("error", { message });
        } finally {
          if (keepaliveTimer) clearInterval(keepaliveTimer);
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
