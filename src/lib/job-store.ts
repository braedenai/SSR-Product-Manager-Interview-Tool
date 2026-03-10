import type { PersonaResult, AnalysisResponse } from "@/types";

export interface JobState {
  status: "running" | "completed" | "error";
  statusMessage: string;
  progress: { current: number; total: number };
  completedPersonas: PersonaResult[];
  results: AnalysisResponse | null;
  error: string | null;
  createdAt: number;
}

// Attach to globalThis so the Map survives Next.js dev-mode HMR and
// is shared across independently-compiled API route modules.
const globalForJobs = globalThis as unknown as {
  __synthpanel_jobs: Map<string, JobState> | undefined;
};

if (!globalForJobs.__synthpanel_jobs) {
  globalForJobs.__synthpanel_jobs = new Map<string, JobState>();
}

const jobs = globalForJobs.__synthpanel_jobs;

const JOB_TTL_MS = 30 * 60 * 1000;

function pruneStaleJobs() {
  const now = Date.now();
  const stale: string[] = [];
  jobs.forEach((job, id) => {
    if (now - job.createdAt > JOB_TTL_MS) stale.push(id);
  });
  stale.forEach((id) => jobs.delete(id));
}

export function createJob(jobId: string, total: number): void {
  pruneStaleJobs();
  jobs.set(jobId, {
    status: "running",
    statusMessage: "Initializing analysis pipeline...",
    progress: { current: 0, total },
    completedPersonas: [],
    results: null,
    error: null,
    createdAt: Date.now(),
  });
  console.log(`[job-store] Created job ${jobId} (total=${total}, map size=${jobs.size})`);
}

export function getJob(jobId: string): JobState | undefined {
  const job = jobs.get(jobId);
  if (!job) {
    console.log(`[job-store] getJob(${jobId}) -> NOT FOUND (map size=${jobs.size}, keys=[${Array.from(jobs.keys()).join(", ")}])`);
  }
  return job;
}

export function updateJobStatus(jobId: string, message: string): void {
  const job = jobs.get(jobId);
  if (job) job.statusMessage = message;
}

export function updateJobProgress(
  jobId: string,
  current: number,
  total: number,
  message: string
): void {
  const job = jobs.get(jobId);
  if (job) {
    job.progress = { current, total };
    job.statusMessage = message;
    console.log(`[job-store] Progress ${jobId}: ${current}/${total}`);
  }
}

export function addPersonaResult(jobId: string, persona: PersonaResult): void {
  const job = jobs.get(jobId);
  if (job) {
    job.completedPersonas.push(persona);
    console.log(`[job-store] Persona ${persona.personaId} complete (PI=${persona.meanPI})`);
  }
}

export function completeJob(jobId: string, results: AnalysisResponse): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = "completed";
    job.results = results;
    job.statusMessage = "Analysis complete.";
    console.log(`[job-store] Job ${jobId} COMPLETED (mean PI=${results.overallMeanPI})`);
  }
}

export function failJob(jobId: string, errorMessage: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = "error";
    job.error = errorMessage;
    job.statusMessage = "Analysis failed.";
    console.error(`[job-store] Job ${jobId} FAILED: ${errorMessage}`);
  }
}
