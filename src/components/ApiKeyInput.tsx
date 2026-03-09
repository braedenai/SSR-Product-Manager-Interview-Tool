"use client";

import { useState } from "react";

interface Props {
  apiKey: string;
  onChange: (key: string) => void;
}

export default function ApiKeyInput({ apiKey, onChange }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Google AI API Key
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Your key is sent directly to Google&apos;s API and never stored on our servers.
      </p>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your Gemini API key..."
          className="input-field pr-20"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Get a free key at{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:underline"
        >
          aistudio.google.com/apikey
        </a>
      </p>
    </div>
  );
}
