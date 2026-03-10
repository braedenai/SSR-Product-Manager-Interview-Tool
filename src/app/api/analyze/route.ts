import { NextRequest } from "next/server";
import {
  detectTier,
  generateOne,
  generateParallel,
  getEmbeddingsBatch,
} from "@/lib/gemini";
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

          // Build persona profiles and all calls
          const personaProfiles: Demographics[] = [];
          for (let i = 0; i < personaCount; i++) {
            personaProfiles.push(demographics[i % demographics.length]);
          }
          const elicitationPrompt = buildElicitationPrompt(concept);
          const totalCalls = personaCount * samplesPerPersona;

          const allCalls: { systemPrompt: string; userPrompt: string }[] = [];
          for (const demo of personaProfiles) {
            const sp = buildPersonaSystemPrompt(demo);
            for (let s = 0; s < samplesPerPersona; s++) {
              allCalls.push({ systemPrompt: sp, userPrompt: elicitationPrompt });
            }
          }

          // Keepalive ping every 10s to prevent connection timeout
          keepaliveTimer = setInterval(() => {
            send("ping", { ts: Date.now() });
          }, 10_000);

          // Detect tier
          send("phase", {
            phase: "llm",
            message: "Detecting API tier...",
            totalCalls,
          });

          const tier = await detectTier(apiKey);
          const isParallel = tier === "paid";

          send("phase", {
            phase: "llm",
            message: isParallel
              ? "Paid tier detected — running at full speed..."
              : "Free tier detected — pacing requests...",
            totalCalls,
          });

          // Phase 1: LLM elicitation
          const allResponses: string[] = [];

          if (isParallel) {
            // Paid tier: fire in parallel batches of 10
            const BATCH = 10;
            for (let i = 0; i < allCalls.length; i += BATCH) {
              const batch = allCalls.slice(i, i + BATCH);
              const results = await generateParallel(apiKey, batch);
              allResponses.push(...results);

              send("progress", {
                completedCalls: allResponses.length,
                totalCalls,
                completedPersonas: Math.floor(allResponses.length / samplesPerPersona),
                totalPersonas: personaCount,
                elapsedMs: Date.now() - startTime,
                isParallel: true,
              });
            }
          } else {
            // Free tier: sequential with pacing, progress after every call
            for (let i = 0; i < allCalls.length; i++) {
              const c = allCalls[i];
              const text = await generateOne(
                apiKey,
                c.systemPrompt,
                c.userPrompt,
                "gemini-2.0-flash-lite",
                4500
              );
              allResponses.push(text);

              send("progress", {
                completedCalls: allResponses.length,
                totalCalls,
                completedPersonas: Math.floor(allResponses.length / samplesPerPersona),
                totalPersonas: personaCount,
                elapsedMs: Date.now() - startTime,
                isParallel: false,
              });
            }
          }

          // Group responses by persona
          const personaResponses: string[] = [];
          for (let i = 0; i < personaCount; i++) {
            const start = i * samplesPerPersona;
            const samples = allResponses.slice(start, start + samplesPerPersona);
            personaResponses.push(samples.join(" "));
          }

          // Phase 2: Batch embed all persona responses
          send("phase", {
            phase: "embed",
            message: "Computing semantic embeddings...",
          });

          const responseEmbeddings = await getEmbeddingsBatch(apiKey, personaResponses);

          // Phase 3: Score all personas (pure math, instant)
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
