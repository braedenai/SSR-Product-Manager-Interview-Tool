"use client";

interface Props {
  quickMode: boolean;
  onChange: (quick: boolean) => void;
}

export default function ModeToggle({ quickMode, onChange }: Props) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Analysis Mode
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Quick mode uses 1 sample per persona for faster results. Precise mode
        uses 2 samples and averages them for higher statistical stability.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-xl border-2 p-4 text-left transition-all ${
            quickMode
              ? "border-brand-600 bg-brand-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 ${quickMode ? "text-brand-600" : "text-gray-400"}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd"
              />
            </svg>
            <span className={`font-semibold text-sm ${quickMode ? "text-brand-700" : "text-gray-700"}`}>
              Quick
            </span>
          </div>
          <p className="text-xs text-gray-500">
            1 sample per persona &middot; ~2x faster
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-xl border-2 p-4 text-left transition-all ${
            !quickMode
              ? "border-brand-600 bg-brand-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 ${!quickMode ? "text-brand-600" : "text-gray-400"}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className={`font-semibold text-sm ${!quickMode ? "text-brand-700" : "text-gray-700"}`}>
              Precise
            </span>
          </div>
          <p className="text-xs text-gray-500">
            2 samples per persona &middot; Higher accuracy
          </p>
        </button>
      </div>
    </div>
  );
}
