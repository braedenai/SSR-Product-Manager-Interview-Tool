"use client";

import { useState, useCallback } from "react";
import ApiKeyInput from "@/components/ApiKeyInput";
import ConceptInput from "@/components/ConceptInput";
import DemographicSelector from "@/components/DemographicSelector";
import PersonaCountSelector from "@/components/PersonaCountSelector";
import ModeToggle from "@/components/ModeToggle";
import CountdownTimer from "@/components/CountdownTimer";
import ResultsDashboard from "@/components/ResultsDashboard";
import type { Demographics, AnalysisResponse } from "@/types";
import {
  AGE_OPTIONS,
  GENDER_OPTIONS,
  INCOME_OPTIONS,
  REGION_OPTIONS,
  ETHNICITY_OPTIONS,
} from "@/types";

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
  const [quickMode, setQuickMode] = useState(true);
  const [appState, setAppState] = useState<AppState>("setup");
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");

  // Timer state
  const [timerPhase, setTimerPhase] = useState<"llm" | "embed" | "score" | "done">("llm");
  const [statusMessage, setStatusMessage] = useState("");
  const [totalCalls, setTotalCalls] = useState(0);
  const [completedCalls, setCompletedCalls] = useState(0);
  const [completedPersonas, setCompletedPersonas] = useState(0);
  const [isParallel, setIsParallel] = useState<boolean | null>(null);

  const canRun =
    apiKey.trim().length > 0 &&
    concept.trim().length > 10 &&
    profiles.length > 0;

  const runAnalysis = useCallback(async () => {
    setAppState("running");
    setError("");
    setResults(null);
    setTimerPhase("llm");
    setStatusMessage("Starting analysis...");
    setCompletedCalls(0);
    setCompletedPersonas(0);
    setIsParallel(null);
    setTotalCalls(personaCount * (quickMode ? 1 : 2));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          demographics: profiles,
          personaCount,
          apiKey,
          quickMode,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Analysis request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const { event, data } = JSON.parse(line.slice(6));

            switch (event) {
              case "phase":
                setTimerPhase(data.phase);
                setStatusMessage(data.message);
                if (data.totalCalls) setTotalCalls(data.totalCalls);
                break;
              case "progress":
                setCompletedCalls(data.completedCalls);
                setCompletedPersonas(data.completedPersonas);
                if (data.isParallel !== undefined)
                  setIsParallel(data.isParallel);
                break;
              case "complete":
                setTimerPhase("done");
                setStatusMessage("Analysis complete!");
                setResults(data);
                setTimeout(() => setAppState("results"), 800);
                break;
              case "error":
                throw new Error(data.message);
            }
          } catch (e) {
            if (
              e instanceof Error &&
              e.message !== "Unexpected end of JSON input"
            ) {
              throw e;
            }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unknown error occurred");
      setAppState("error");
    }
  }, [apiKey, concept, profiles, personaCount, quickMode]);

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
    setAppState("setup");
    setResults(null);
    setCompletedCalls(0);
    setCompletedPersonas(0);
    setTimerPhase("llm");
    setIsParallel(null);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PersonaCountSelector
                count={personaCount}
                onChange={setPersonaCount}
              />
              <ModeToggle quickMode={quickMode} onChange={setQuickMode} />
            </div>

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
            <CountdownTimer
              totalCalls={totalCalls}
              completedCalls={completedCalls}
              totalPersonas={personaCount}
              completedPersonas={completedPersonas}
              isParallel={isParallel}
              phase={timerPhase}
              statusMessage={statusMessage}
            />
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
            <button
              onClick={resetToSetup}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
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
