"use client";

import { useState, useCallback, useRef } from "react";
import ApiKeyInput from "@/components/ApiKeyInput";
import ConceptInput from "@/components/ConceptInput";
import DemographicSelector from "@/components/DemographicSelector";
import PersonaCountSelector from "@/components/PersonaCountSelector";
import ProgressIndicator from "@/components/ProgressIndicator";
import ResultsDashboard from "@/components/ResultsDashboard";
import type { Demographics, AnalysisResponse, PersonaResult } from "@/types";
import {
  AGE_OPTIONS,
  GENDER_OPTIONS,
  INCOME_OPTIONS,
  REGION_OPTIONS,
  ETHNICITY_OPTIONS,
} from "@/types";

const POLL_INTERVAL_MS = 2500;

type AppState = "setup" | "running" | "results" | "error";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [concept, setConcept] = useState("");
  const [profiles, setProfiles] = useState<Demographics[]>([
    {
      age: AGE_OPTIONS[1],
      gender: GENDER_OPTIONS[0],
      income: INCOME_OPTIONS[2],
      region: REGION_OPTIONS[0],
      ethnicity: ETHNICITY_OPTIONS[0],
    },
  ]);
  const [personaCount, setPersonaCount] = useState(10);
  const [appState, setAppState] = useState<AppState>("setup");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [completedPersonas, setCompletedPersonas] = useState<PersonaResult[]>(
    []
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canRun =
    apiKey.trim().length > 0 &&
    concept.trim().length > 10 &&
    profiles.length > 0;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      let consecutiveErrors = 0;

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/analyze/status?jobId=${encodeURIComponent(jobId)}`
          );

          if (!res.ok) {
            consecutiveErrors++;
            if (consecutiveErrors >= 5) {
              stopPolling();
              setError("Lost connection to analysis job.");
              setAppState("error");
            }
            return;
          }

          consecutiveErrors = 0;
          const data = await res.json();

          setStatus(data.statusMessage);
          setProgress(data.progress);
          setCompletedPersonas(data.completedPersonas);

          if (data.status === "completed" && data.results) {
            stopPolling();
            setResults(data.results);
            setAppState("results");
          } else if (data.status === "error") {
            stopPolling();
            setError(data.error || "Analysis failed on the server.");
            setAppState("error");
          }
        } catch {
          consecutiveErrors++;
          if (consecutiveErrors >= 5) {
            stopPolling();
            setError("Network error while polling for results.");
            setAppState("error");
          }
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const runAnalysis = useCallback(async () => {
    setAppState("running");
    setError("");
    setCompletedPersonas([]);
    setProgress({ current: 0, total: personaCount });
    setStatus("Initializing analysis pipeline...");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          demographics: profiles,
          personaCount,
          apiKey,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Analysis request failed");
      }

      const { jobId } = await response.json();
      if (!jobId) throw new Error("No job ID returned from server");

      startPolling(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unknown error occurred");
      setAppState("error");
    }
  }, [apiKey, concept, profiles, personaCount, startPolling]);

  const handleExport = useCallback(async () => {
    if (!results) return;

    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personas: results.personas }),
    });

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "synthpanel-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const resetToSetup = () => {
    stopPolling();
    setAppState("setup");
    setResults(null);
    setCompletedPersonas([]);
    setProgress({ current: 0, total: 0 });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-white"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">SynthPanel</h1>
              <p className="text-xs text-gray-500">
                AI Purchase Intent Analysis
              </p>
            </div>
          </div>
          {appState === "results" && (
            <button onClick={resetToSetup} className="btn-secondary text-sm">
              New Analysis
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {appState === "setup" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Test your product concept
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto">
                Describe your product, pick your target audience, and get
                instant purchase intent scores from AI-simulated consumer
                personas.
              </p>
            </div>

            <ApiKeyInput apiKey={apiKey} onChange={setApiKey} />
            <ConceptInput concept={concept} onChange={setConcept} />
            <DemographicSelector profiles={profiles} onChange={setProfiles} />
            <PersonaCountSelector
              count={personaCount}
              onChange={setPersonaCount}
            />

            <div className="flex justify-center pt-4">
              <button
                onClick={runAnalysis}
                disabled={!canRun}
                className="btn-primary text-base px-10 py-4"
              >
                Run Analysis
              </button>
            </div>
            {!canRun && (
              <p className="text-center text-sm text-gray-400">
                {!apiKey.trim()
                  ? "Enter your Google AI API key to get started."
                  : concept.trim().length <= 10
                    ? "Add a product concept description (at least 10 characters)."
                    : "Add at least one demographic segment."}
              </p>
            )}
          </div>
        )}

        {appState === "running" && (
          <div className="space-y-6">
            <ProgressIndicator
              status={status}
              current={progress.current}
              total={progress.total}
            />

            {completedPersonas.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Completed Personas
                </h3>
                <div className="space-y-2">
                  {completedPersonas.map((p) => (
                    <div
                      key={p.personaId}
                      className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-600">
                        Persona {p.personaId} &middot;{" "}
                        {p.demographics.age}, {p.demographics.gender},{" "}
                        {p.demographics.region}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          p.meanPI >= 3.5
                            ? "text-green-600"
                            : p.meanPI >= 2.5
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        PI: {p.meanPI.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {appState === "results" && results && (
          <ResultsDashboard results={results} onExport={handleExport} />
        )}

        {appState === "error" && (
          <div className="card border-red-200 bg-red-50">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Analysis Failed
            </h3>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button onClick={resetToSetup} className="btn-primary bg-red-600 hover:bg-red-700">
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-gray-400">
          SynthPanel &mdash; AI-powered purchase intent analysis. Results are
          simulated and should not replace real consumer research.
        </div>
      </footer>
    </div>
  );
}
