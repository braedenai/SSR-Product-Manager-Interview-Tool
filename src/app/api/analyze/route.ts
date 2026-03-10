import { NextRequest } from "next/server";
import { generatePersonaResponse, getEmbeddings } from "@/lib/gemini";
import { buildPersonaSystemPrompt, buildElicitationPrompt } from "@/lib/personas";
import { REFERENCE_ANCHOR_SETS } from "@/lib/reference-anchors";
import { computeSSRScore, meanPurchaseIntent } from "@/lib/ssr-engine";
import {
  createJob,
  getJob,
  updateJobStatus,
  updateJobProgress,
  addPersonaResult,
  completeJob,
  failJob,
} from "@/lib/job-store";
import type { Demographics, PersonaResult } from "@/types";

export const maxDuration = 300;

interface AnalyzeBody {
  concept: string;
  demographics: Demographics[];
  personaCount: number;
  apiKey: string;
  jobId: string;
}

async function runAnalysis(jobId: string, body: AnalyzeBody) {
  const { concept, demographics, personaCount, apiKey } = body;

  try {
    console.log(`[analyze] Starting analysis for job ${jobId} (${personaCount} personas)`);

    updateJobStatus(jobId, "Embedding reference anchor statements...");
    const allAnchors = REFERENCE_ANCHOR_SETS.flat();
    console.log(`[analyze] Embedding ${allAnchors.length} anchor statements...`);
    const allAnchorEmbeddings = await getEmbeddings(apiKey, allAnchors);
    console.log(`[analyze] Anchor embeddings complete (${allAnchorEmbeddings.length} vectors)`);

    const anchorSetEmbeddings: number[][][] = [];
    let idx = 0;
    for (let s = 0; s < REFERENCE_ANCHOR_SETS.length; s++) {
      const setEmbeddings: number[][] = [];
      for (let r = 0; r < 5; r++) {
        setEmbeddings.push(allAnchorEmbeddings[idx++]);
      }
      anchorSetEmbeddings.push(setEmbeddings);
    }

    updateJobStatus(jobId, "Reference anchors embedded. Starting persona simulations...");

    const personaProfiles: Demographics[] = [];
    for (let i = 0; i < personaCount; i++) {
      personaProfiles.push(demographics[i % demographics.length]);
    }

    const personas: PersonaResult[] = [];

    for (let i = 0; i < personaProfiles.length; i++) {
      const demo = personaProfiles[i];
      console.log(`[analyze] Starting persona ${i + 1}/${personaProfiles.length}`);
      updateJobProgress(
        jobId,
        i + 1,
        personaProfiles.length,
        `Simulating persona ${i + 1} of ${personaProfiles.length}...`
      );

      const systemPrompt = buildPersonaSystemPrompt(demo);
      const elicitationPrompt = buildElicitationPrompt(concept);

      const sample1 = await generatePersonaResponse(apiKey, systemPrompt, elicitationPrompt);
      console.log(`[analyze] Persona ${i + 1} sample 1 done (${sample1.length} chars)`);
      const sample2 = await generatePersonaResponse(apiKey, systemPrompt, elicitationPrompt);
      console.log(`[analyze] Persona ${i + 1} sample 2 done (${sample2.length} chars)`);

      const combinedResponse = `${sample1} ${sample2}`;

      const responseEmbeddings = await getEmbeddings(apiKey, [combinedResponse]);
      const responseEmbedding = responseEmbeddings[0];
      console.log(`[analyze] Persona ${i + 1} embedding done (${responseEmbedding.length} dims)`);

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
      addPersonaResult(jobId, personaResult);
    }

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
      if (p.meanPI >= 3.5) {
        positive.push(p.rawResponse);
      } else if (p.meanPI <= 2.5) {
        negative.push(p.rawResponse);
      } else {
        neutral.push(p.rawResponse);
      }
    }

    completeJob(jobId, {
      personas,
      overallMeanPI,
      distributionAggregated,
      qualitativeFeedback: { positive, negative, neutral },
    });
    console.log(`[analyze] Job ${jobId} finished successfully`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    console.error(`[analyze] Job ${jobId} FAILED:`, message);
    if (err instanceof Error && err.stack) {
      console.error(`[analyze] Stack:`, err.stack);
    }
    failJob(jobId, message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeBody = await request.json();
    const { concept, apiKey, demographics, personaCount, jobId } = body;

    console.log(`[analyze POST] Received request: jobId=${jobId}, personaCount=${personaCount}`);

    if (!concept || !apiKey || !demographics || demographics.length === 0 || !jobId) {
      console.error(`[analyze POST] Validation failed: concept=${!!concept}, apiKey=${!!apiKey}, demographics=${demographics?.length}, jobId=${!!jobId}`);
      return Response.json(
        { error: "Missing required fields: concept, apiKey, jobId, and at least one demographic profile." },
        { status: 400 }
      );
    }

    createJob(jobId, personaCount);

    await runAnalysis(jobId, body);

    const job = getJob(jobId);
    console.log(`[analyze POST] Returning response for ${jobId}, status=${job?.status}`);
    return Response.json({ jobId, status: job?.status ?? "completed" });
  } catch (err) {
    console.error(`[analyze POST] Unhandled error:`, err);
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
