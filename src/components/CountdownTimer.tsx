"use client";

import { useState, useEffect, useRef, useCallback } from "react";

function FreeTierNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Free tier detected — running slower
            </p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Your API key is on Google&apos;s free tier, which limits requests
              to ~15/min. Enable billing to run 100x faster (your free credits
              still apply):
            </p>
            <ol className="text-xs text-amber-700 mt-2 space-y-1 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline"
                >
                  aistudio.google.com/apikey
                </a>
              </li>
              <li>Click your API key, then &quot;Set up billing&quot;</li>
              <li>
                Add a payment method (you won&apos;t be charged if you have
                free credits)
              </li>
              <li>Re-run your analysis — it&apos;ll finish in seconds</li>
            </ol>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-amber-400 hover:text-amber-600 flex-shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface Props {
  /** Total LLM calls to make */
  totalCalls: number;
  /** Number of LLM calls completed so far */
  completedCalls: number;
  /** Total personas */
  totalPersonas: number;
  /** Completed personas */
  completedPersonas: number;
  /** Whether we're running in parallel mode */
  isParallel: boolean | null;
  /** Current phase: llm, embed, score, done */
  phase: "llm" | "embed" | "score" | "done";
  /** Status message from the server */
  statusMessage: string;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const CIRCLE_RADIUS = 54;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export default function CountdownTimer({
  totalCalls,
  completedCalls,
  totalPersonas,
  completedPersonas,
  isParallel,
  phase,
  statusMessage,
}: Props) {
  const [estimatedTotalSec, setEstimatedTotalSec] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const lastCallTimestamps = useRef<number[]>([]);

  // Set initial estimate when component mounts or params change
  useEffect(() => {
    if (estimatedTotalSec === 0) {
      // Initial optimistic estimate assuming parallel
      const baseEstimate = isParallel !== false
        ? Math.max(5, totalCalls * 0.3 + 3)
        : totalCalls * 5 + 3;
      setEstimatedTotalSec(baseEstimate);
      setRemainingSec(baseEstimate);
      startTimeRef.current = Date.now();
    }
  }, [totalCalls, isParallel, estimatedTotalSec]);

  // Recalculate estimate when progress updates come in
  const recalculate = useCallback(() => {
    if (completedCalls === 0 || phase !== "llm") return;

    lastCallTimestamps.current.push(Date.now());
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const avgTimePerCall = elapsed / completedCalls;
    const remainingCalls = totalCalls - completedCalls;
    const estimatedLLMRemaining = remainingCalls * avgTimePerCall;
    // Embedding + scoring is fast: ~2-3 seconds
    const estimatedPostProcessing = 3;
    const newRemaining = estimatedLLMRemaining + estimatedPostProcessing;
    const newTotal = elapsed + newRemaining;

    setEstimatedTotalSec(newTotal);
    setRemainingSec(Math.max(0, newRemaining));
  }, [completedCalls, totalCalls, phase]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  // Handle phase transitions
  useEffect(() => {
    if (phase === "embed") setRemainingSec(2);
    if (phase === "score") setRemainingSec(0.5);
    if (phase === "done") setRemainingSec(0);
  }, [phase]);

  // Tick down every second
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Progress for the circular arc (0 = full circle, 1 = empty)
  const progress =
    estimatedTotalSec > 0
      ? Math.min(1, 1 - remainingSec / estimatedTotalSec)
      : 0;
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const strokeColor =
    progress < 0.33
      ? "#4c6ef5"
      : progress < 0.66
        ? "#4c6ef5"
        : progress < 0.9
          ? "#22c55e"
          : "#16a34a";

  return (
    <div className="card">
      {isParallel === false && !noticeDismissed && (
        <FreeTierNotice onDismiss={() => setNoticeDismissed(true)} />
      )}
      <div className="flex items-center gap-8">
        {/* Circular timer */}
        <div className="relative flex-shrink-0">
          <svg width="132" height="132" viewBox="0 0 132 132">
            {/* Background circle */}
            <circle
              cx="66"
              cy="66"
              r={CIRCLE_RADIUS}
              fill="none"
              stroke="#f0f0f0"
              strokeWidth="8"
            />
            {/* Progress arc */}
            <circle
              cx="66"
              cy="66"
              r={CIRCLE_RADIUS}
              fill="none"
              stroke={strokeColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCLE_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 66 66)"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          {/* Time remaining in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {remainingSec > 0 ? (
              <>
                <span className="text-2xl font-bold text-gray-900 tabular-nums">
                  {formatTime(remainingSec)}
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                  remaining
                </span>
              </>
            ) : phase !== "done" ? (
              <>
                <span className="text-sm font-semibold text-brand-600">
                  Finishing
                </span>
                <span className="text-[10px] text-gray-400">up...</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-green-600">
                Done
              </span>
            )}
          </div>
        </div>

        {/* Status info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 mb-3">
            {statusMessage}
          </p>

          {/* Progress bar */}
          {phase === "llm" && totalCalls > 0 && (
            <div className="mb-3">
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-brand-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.round((completedCalls / totalCalls) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-400">
                  {completedPersonas} of {totalPersonas} personas
                </span>
                <span className="text-xs text-gray-400">
                  {completedCalls} of {totalCalls} API calls
                </span>
              </div>
            </div>
          )}

          {/* Mode indicator */}
          {isParallel !== null && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isParallel ? "bg-green-500" : "bg-yellow-500"
                }`}
              />
              <span className="text-xs text-gray-400">
                {isParallel
                  ? "Parallel mode — running at full speed"
                  : "Sequential mode — pacing to stay within rate limits"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
