import { NextRequest } from "next/server";
import { getJob } from "@/lib/job-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return Response.json({ error: "Missing jobId parameter" }, { status: 400 });
  }

  const job = getJob(jobId);

  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json({
    status: job.status,
    statusMessage: job.statusMessage,
    progress: job.progress,
    completedPersonas: job.completedPersonas,
    results: job.results,
    error: job.error,
  });
}
