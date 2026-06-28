import type { FinancingRecommendation, LoanScenario } from "@/agents/financing-agent";

const OPTION_LABELS: Record<LoanScenario["optionType"], string> = {
  bank_loan: "Bank Loan",
  ar_finance: "AR Finance",
  liquidate: "Liquidate Inventory",
};

function computeMetrics(opt: LoanScenario) {
  const costPerDollar = opt.amount > 0 ? opt.estimatedCost / opt.amount : null;
  // liquidate is a one-time haircut — not a time-priced instrument, don't annualize
  const apr =
    opt.optionType !== "liquidate" && costPerDollar !== null
      ? costPerDollar * (365 / opt.durationDays)
      : null;
  return { costPerDollar, apr };
}

function pct(n: number, decimals = 1) {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function FinancingPanel({ recommendation }: { recommendation: FinancingRecommendation }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Projected gap:{" "}
        <span className="font-semibold text-slate-900">${recommendation.gapAmount.toLocaleString()}</span>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Option</th>
              <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">Cash Raised</th>
              <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">Cost per $1</th>
              <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">Liquidity Days</th>
              <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-slate-400">APR (true financing only)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recommendation.options.map((opt) => {
              const { costPerDollar, apr } = computeMetrics(opt);
              return (
                <tr
                  key={opt.optionType}
                  className={opt.recommended ? "bg-slate-50" : ""}
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${opt.recommended ? "text-slate-900" : "text-slate-700"}`}>
                        {OPTION_LABELS[opt.optionType]}
                      </span>
                      {opt.recommended && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">Est. cost ${opt.estimatedCost.toLocaleString()}</p>
                  </td>
                  <td className="py-3 pr-4 text-right font-medium text-slate-900">
                    {opt.amount > 0 ? `$${opt.amount.toLocaleString()}` : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {costPerDollar !== null ? (
                      <span className="font-medium text-slate-900">{pct(costPerDollar, 2)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-700">{opt.durationDays}d</td>
                  <td className="py-3 text-right">
                    {apr !== null ? (
                      <span className="font-semibold text-slate-900">{pct(apr, 1)}</span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">one-time haircut, not annualized</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        APR = (cost ÷ raised) × (365 ÷ days). Liquidation is a one-time discount on inventory value — annualizing it would be misleading.
      </p>
    </div>
  );
}
