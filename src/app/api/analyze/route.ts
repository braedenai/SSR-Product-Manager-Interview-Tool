import { NextRequest } from "next/server";
import { generatePersonaResponse, getEmbeddings } from "@/lib/gemini";
import { buildPersonaSystemPrompt, buildElicitationPrompt } from "@/lib/personas";
import { REFERENCE_ANCHOR_SETS } from "@/lib/reference-anchors";
import { computeSSRScore, meanPurchaseIntent } from "@/lib/ssr-engine";
import {
  createJob,
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
}

async function runAnalysis(jobId: string, body: AnalyzeBody) {
  const { concept, demographics, personaCount, apiKey } = body;

  try {
    updateJobStatus(jobId, "Embedding reference anchor statements...");
    const allAnchors = REFERENCE_ANCHOR_SETS.flat();
    const allAnchorEmbeddings = await getEmbeddings(apiKey, allAnchors);

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
      updateJobProgress(
        jobId,
        i + 1,
        personaProfiles.length,
        `Simulating persona ${i + 1} of ${personaProfiles.length}...`
      );

      const systemPrompt = buildPersonaSystemPrompt(demo);
      const elicitationPrompt = buildElicitationPrompt(concept);

      const sample1 = await generatePersonaResponse(apiKey, systemPrompt, elicitationPrompt);
      const sample2 = await generatePersonaResponse(apiKey, systemPrompt, elicitationPrompt);

      const combinedResponse = `${sample1} ${sample2}`;

      const responseEmbeddings = await getEmbeddings(apiKey, [combinedResponse]);
      const responseEmbedding = responseEmbeddings[0];

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    failJob(jobId, message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeBody = await request.json();
    const { concept, apiKey, demographics, personaCount } = body;

    if (!concept || !apiKey || !demographics || demographics.length === 0) {
      return Response.json(
        { error: "Missing required fields: concept, apiKey, and at least one demographic profile." },
        { status: 400 }
      );
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    createJob(jobId, personaCount);

    runAnalysis(jobId, body);

    return Response.json({ jobId });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
