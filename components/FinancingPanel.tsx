import type { FinancingRecommendation } from "@/agents/financing-agent";

export function FinancingPanel({ recommendation }: { recommendation: FinancingRecommendation }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Projected gap:{" "}
        <span className="font-semibold text-slate-900">${recommendation.gapAmount.toLocaleString()}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {recommendation.options.map((option) => (
          <div
            key={option.optionType}
            className={`relative rounded-xl border p-4 ${
              option.recommended ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
            }`}
          >
            {option.recommended && (
              <span className="absolute -top-2.5 right-4 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Recommended
              </span>
            )}
            <p className="font-medium capitalize text-slate-900">{option.optionType.replace("_", " ")}</p>
            <p className="mt-1 text-sm text-slate-600">
              ${option.amount.toLocaleString()} · {option.durationDays}d
            </p>
            <p className="text-sm text-slate-600">Cost: ${option.estimatedCost.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
