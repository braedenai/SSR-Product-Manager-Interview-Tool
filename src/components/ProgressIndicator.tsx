"use client";

interface Props {
  status: string;
  current: number;
  total: number;
}

export default function ProgressIndicator({ status, current, total }: Props) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative h-5 w-5">
          <div className="absolute inset-0 rounded-full border-2 border-brand-200" />
          <div className="absolute inset-0 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-gray-700">{status}</p>
      </div>
      {total > 0 && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-brand-600 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {current} of {total} personas complete ({percentage}%)
          </p>
        </>
      )}
    </div>
  );
}
