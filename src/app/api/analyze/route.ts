import { NextRequest } from "next/server";
import {
  generatePersonaResponsesBatch,
  getEmbeddingsBatch,
  ConcurrencyMode,
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
        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
          );
        }

        try {
          // Build persona profiles
          const personaProfiles: Demographics[] = [];
          for (let i = 0; i < personaCount; i++) {
            personaProfiles.push(demographics[i % demographics.length]);
          }

          const elicitationPrompt = buildElicitationPrompt(concept);

          // Build all LLM calls upfront
          const allCalls: { systemPrompt: string; userPrompt: string }[] = [];
          for (const demo of personaProfiles) {
            const systemPrompt = buildPersonaSystemPrompt(demo);
            for (let s = 0; s < samplesPerPersona; s++) {
              allCalls.push({ systemPrompt, userPrompt: elicitationPrompt });
            }
          }

          // Phase 1: LLM elicitation — try parallel, fall back to sequential
          send("phase", {
            phase: "llm",
            message: "Generating persona responses...",
            totalCalls: allCalls.length,
          });

          let mode: ConcurrencyMode = { parallel: true, paceMs: 0 };
          const allResponses: string[] = [];
          const PARALLEL_BATCH_SIZE = 10;

          const startTime = Date.now();

          if (mode.parallel) {
            // Fire in batches of PARALLEL_BATCH_SIZE
            for (let i = 0; i < allCalls.length; i += PARALLEL_BATCH_SIZE) {
              const batch = allCalls.slice(i, i + PARALLEL_BATCH_SIZE);
              const { results, mode: newMode } =
                await generatePersonaResponsesBatch(apiKey, batch, mode);
              mode = newMode;
              allResponses.push(...results);

              const completedPersonas = Math.floor(
                allResponses.length / samplesPerPersona
              );

              send("progress", {
                phase: "llm",
                completedCalls: allResponses.length,
                totalCalls: allCalls.length,
                completedPersonas,
                totalPersonas: personaCount,
                elapsedMs: Date.now() - startTime,
                isParallel: mode.parallel,
              });

              // If we fell back to sequential, remaining are already done inside the batch call
              if (!mode.parallel) break;
            }

            // If we fell back mid-way, handle remaining calls sequentially
            if (!mode.parallel && allResponses.length < allCalls.length) {
              const remaining = allCalls.slice(allResponses.length);
              const { results } = await generatePersonaResponsesBatch(
                apiKey,
                remaining,
                mode
              );
              allResponses.push(...results);
            }
          }

          // Group responses by persona
          const personaResponses: string[] = [];
          for (let i = 0; i < personaCount; i++) {
            const start = i * samplesPerPersona;
            const samples = allResponses.slice(
              start,
              start + samplesPerPersona
            );
            personaResponses.push(samples.join(" "));
          }

          // Phase 2: Batch embed all persona responses in one call
          send("phase", {
            phase: "embed",
            message: "Computing semantic embeddings...",
          });

          const responseEmbeddings = await getEmbeddingsBatch(
            apiKey,
            personaResponses
          );

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

          // Aggregate results
          const overallMeanPI =
            Math.round(
              (personas.reduce((sum, p) => sum + p.meanPI, 0) /
                personas.length) *
                100
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
