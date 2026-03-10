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

const jobs = new Map<string, JobState>();

const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

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
}

export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId);
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
  }
}

export function addPersonaResult(jobId: string, persona: PersonaResult): void {
  const job = jobs.get(jobId);
  if (job) job.completedPersonas.push(persona);
}

export function completeJob(jobId: string, results: AnalysisResponse): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = "completed";
    job.results = results;
    job.statusMessage = "Analysis complete.";
  }
}

export function failJob(jobId: string, errorMessage: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = "error";
    job.error = errorMessage;
    job.statusMessage = "Analysis failed.";
  }
}
