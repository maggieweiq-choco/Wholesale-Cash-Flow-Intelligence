import type { FinancingRecommendation } from "@/agents/financing-agent";

export function FinancingPanel({ recommendation }: { recommendation: FinancingRecommendation }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Projected gap: <span className="font-medium text-zinc-900">${recommendation.gapAmount.toLocaleString()}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {recommendation.options.map((option) => (
          <div
            key={option.optionType}
            className={`rounded-lg border p-4 ${option.recommended ? "border-blue-600 bg-blue-50" : "border-zinc-200"}`}
          >
            <p className="font-medium capitalize">{option.optionType.replace("_", " ")}</p>
            <p className="text-sm text-zinc-600">${option.amount.toLocaleString()} · {option.durationDays}d</p>
            <p className="text-sm text-zinc-600">Cost: ${option.estimatedCost.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
