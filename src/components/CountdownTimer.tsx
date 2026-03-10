"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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

  // Color transitions based on progress
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
