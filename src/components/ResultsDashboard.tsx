"use client";

import type { AnalysisResponse, PersonaResult } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  results: AnalysisResponse;
  onExport: () => void;
}

const LIKERT_LABELS = [
  "1 - Very Unlikely",
  "2 - Unlikely",
  "3 - Neutral",
  "4 - Likely",
  "5 - Very Likely",
];

const BAR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];

function PIGauge({ value }: { value: number }) {
  const percentage = ((value - 1) / 4) * 100;
  let colorClass = "text-red-500";
  if (value >= 4) colorClass = "text-green-600";
  else if (value >= 3) colorClass = "text-yellow-500";
  else if (value >= 2) colorClass = "text-orange-500";

  return (
    <div className="text-center">
      <div className={`text-6xl font-bold ${colorClass}`}>
        {value.toFixed(2)}
      </div>
      <div className="text-sm text-gray-500 mt-1">out of 5.00</div>
      <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
        <div
          className="h-3 rounded-full transition-all duration-1000"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e)`,
          }}
        />
      </div>
    </div>
  );
}

function DistributionChart({
  distribution,
}: {
  distribution: number[];
}) {
  const data = distribution.map((value, i) => ({
    name: LIKERT_LABELS[i],
    short: `Score ${i + 1}`,
    value: Math.round(value * 1000) / 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="short" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(1)}%`, "Probability"]}
          labelFormatter={(label) => {
            const idx = data.findIndex((d) => d.short === label);
            return idx >= 0 ? LIKERT_LABELS[idx] : label;
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function FeedbackSection({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className={`text-sm font-semibold ${color} mb-2`}>
        {title} ({items.length})
      </h4>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((item, i) => (
          <div
            key={i}
            className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-100"
          >
            &ldquo;{item}&rdquo;
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonaTable({ personas }: { personas: PersonaResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-2 font-semibold text-gray-600">
              #
            </th>
            <th className="text-left py-3 px-2 font-semibold text-gray-600">
              Demographics
            </th>
            <th className="text-center py-3 px-2 font-semibold text-gray-600">
              PI Score
            </th>
            <th className="text-left py-3 px-2 font-semibold text-gray-600">
              Response Preview
            </th>
          </tr>
        </thead>
        <tbody>
          {personas.map((p) => (
            <tr
              key={p.personaId}
              className="border-b border-gray-100 hover:bg-gray-50/50"
            >
              <td className="py-3 px-2 text-gray-400">{p.personaId}</td>
              <td className="py-3 px-2">
                <div className="flex flex-wrap gap-1">
                  {[
                    p.demographics.age,
                    p.demographics.gender,
                    p.demographics.income,
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-3 px-2 text-center">
                <span
                  className={`inline-block px-2 py-1 rounded-lg font-semibold text-xs ${
                    p.meanPI >= 3.5
                      ? "bg-green-100 text-green-700"
                      : p.meanPI >= 2.5
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {p.meanPI.toFixed(2)}
                </span>
              </td>
              <td className="py-3 px-2 text-gray-500 max-w-xs truncate">
                {p.rawResponse.slice(0, 120)}...
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResultsDashboard({ results, onExport }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Results</h2>
        <button onClick={onExport} className="btn-secondary text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Mean Purchase Intent
          </h3>
          <PIGauge value={results.overallMeanPI} />
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Response Distribution (1-5 Scale)
          </h3>
          <DistributionChart distribution={results.distributionAggregated} />
        </div>
      </div>

      {/* Qualitative feedback */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Qualitative Feedback
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeedbackSection
            title="Positive Intent"
            items={results.qualitativeFeedback.positive}
            color="text-green-700"
          />
          <FeedbackSection
            title="Neutral / Mixed"
            items={results.qualitativeFeedback.neutral}
            color="text-yellow-700"
          />
          <FeedbackSection
            title="Negative Intent"
            items={results.qualitativeFeedback.negative}
            color="text-red-700"
          />
        </div>
      </div>

      {/* Persona table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Individual Persona Results
        </h3>
        <PersonaTable personas={results.personas} />
      </div>
    </div>
  );
}
