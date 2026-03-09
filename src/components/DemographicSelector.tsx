"use client";

import type { Demographics } from "@/types";
import {
  AGE_OPTIONS,
  GENDER_OPTIONS,
  INCOME_OPTIONS,
  REGION_OPTIONS,
  ETHNICITY_OPTIONS,
} from "@/types";

interface Props {
  profiles: Demographics[];
  onChange: (profiles: Demographics[]) => void;
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select-field"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

const DEFAULT_PROFILE: Demographics = {
  age: AGE_OPTIONS[0],
  gender: GENDER_OPTIONS[0],
  income: INCOME_OPTIONS[2],
  region: REGION_OPTIONS[0],
  ethnicity: ETHNICITY_OPTIONS[0],
};

export default function DemographicSelector({ profiles, onChange }: Props) {
  const updateProfile = (
    index: number,
    field: keyof Demographics,
    value: string
  ) => {
    const updated = [...profiles];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addProfile = () => {
    onChange([...profiles, { ...DEFAULT_PROFILE }]);
  };

  const removeProfile = (index: number) => {
    if (profiles.length <= 1) return;
    onChange(profiles.filter((_, i) => i !== index));
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900">
          Target Audience
        </h2>
        <button
          type="button"
          onClick={addProfile}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          + Add segment
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Define the demographic profiles for your synthetic consumer panel. Each
        segment will be simulated independently.
      </p>

      <div className="space-y-6">
        {profiles.map((profile, i) => (
          <div
            key={i}
            className="relative rounded-xl border border-gray-100 bg-gray-50/50 p-5"
          >
            {profiles.length > 1 && (
              <button
                type="button"
                onClick={() => removeProfile(i)}
                className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove segment"
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
            )}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Segment {i + 1}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Select
                label="Age"
                value={profile.age}
                options={AGE_OPTIONS}
                onChange={(v) => updateProfile(i, "age", v)}
              />
              <Select
                label="Gender"
                value={profile.gender}
                options={GENDER_OPTIONS}
                onChange={(v) => updateProfile(i, "gender", v)}
              />
              <Select
                label="Income"
                value={profile.income}
                options={INCOME_OPTIONS}
                onChange={(v) => updateProfile(i, "income", v)}
              />
              <Select
                label="Region"
                value={profile.region}
                options={REGION_OPTIONS}
                onChange={(v) => updateProfile(i, "region", v)}
              />
              <Select
                label="Ethnicity"
                value={profile.ethnicity}
                options={ETHNICITY_OPTIONS}
                onChange={(v) => updateProfile(i, "ethnicity", v)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
