"use client";

interface Props {
  count: number;
  onChange: (count: number) => void;
}

export default function PersonaCountSelector({ count, onChange }: Props) {
  const options = [5, 10, 15, 20, 30, 50];

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Panel Size
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        How many synthetic consumers to simulate. More personas = higher
        statistical reliability but longer runtime and more API usage.
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              count === n
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {n} personas
          </button>
        ))}
      </div>
    </div>
  );
}
