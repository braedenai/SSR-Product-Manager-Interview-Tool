"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  status: string;
  current: number;
  total: number;
  startTime: number;
}

const ANCHOR_OVERHEAD_S = 60;
const BASE_PER_PERSONA_S = 15;

function formatTime(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CountdownTimer({
  status,
  current,
  total,
  startTime,
}: Props) {
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(false);
  const avgPerPersona = useRef(BASE_PER_PERSONA_S);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedS = (now - startTime) / 1000;

  if (current >= 2) {
    avgPerPersona.current = elapsedS / current;
  }

  const remaining = current > 0
    ? Math.max(0, (total - current) * avgPerPersona.current)
    : Math.max(0, ANCHOR_OVERHEAD_S + total * BASE_PER_PERSONA_S - elapsedS);

  const initialEstimate = ANCHOR_OVERHEAD_S + total * BASE_PER_PERSONA_S;
  const progress = Math.min(1, elapsedS / Math.max(initialEstimate, 1));
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const RADIUS = 54;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const arcOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Circular arc */}
        <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="#4c6ef5"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={arcOffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">
              {formatTime(remaining)}
            </span>
            <span className="text-xs text-gray-400">remaining</span>
          </div>
        </div>

        {/* Text info */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
            <div className="relative h-4 w-4">
              <div className="absolute inset-0 rounded-full border-2 border-brand-200" />
              <div className="absolute inset-0 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-medium text-gray-700 truncate">{status}</p>
          </div>

          {total > 0 && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1.5">
                <div
                  className="bg-brand-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {current} of {total} personas complete ({percentage}%)
              </p>
            </>
          )}

          <p className="text-xs text-gray-400 mt-1">
            Elapsed: {formatTime(elapsedS)}
            {current >= 2 && (
              <span> &middot; ~{Math.round(avgPerPersona.current)}s per persona</span>
            )}
          </p>
        </div>
      </div>

      {/* Free tier notice */}
      {!dismissed && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
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
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              Free tier rate limits apply
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              API calls are paced to stay within Gemini free tier limits.
              Processing may take longer with larger panel sizes.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
