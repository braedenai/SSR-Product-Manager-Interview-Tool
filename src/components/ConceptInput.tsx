"use client";

interface Props {
  concept: string;
  onChange: (concept: string) => void;
}

export default function ConceptInput({ concept, onChange }: Props) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Product Concept
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Describe the product or service you want to test. Be as detailed as
        possible for better results.
      </p>
      <textarea
        value={concept}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., A smart water bottle that tracks your daily hydration, syncs with your phone via Bluetooth, and reminds you to drink water throughout the day. Priced at $45."
        rows={5}
        className="input-field resize-none"
      />
      <p className="text-xs text-gray-400 mt-2">
        {concept.length} characters
      </p>
    </div>
  );
}
