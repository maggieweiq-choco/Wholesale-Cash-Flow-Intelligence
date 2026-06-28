import type { PayablesItem } from "@/agents/payables-agent";

export function PayablesTable({ items }: { items: PayablesItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No upcoming bills.</p>;
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4">Bill</th>
          <th className="py-2 pr-4">Vendor</th>
          <th className="py-2 pr-4">Amount</th>
          <th className="py-2 pr-4">Due In</th>
          <th className="py-2">
            <span
              className="cursor-help border-b border-dotted border-slate-400"
              title="Priority is a sorting score, not a dollar amount. It combines bill amount and due-date urgency; higher scores should be paid first."
            >
              Priority
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.billId} className="border-b border-slate-100 last:border-0">
            <td className="py-3 pr-4 font-medium text-slate-900">{item.billId}</td>
            <td className="py-3 pr-4 text-slate-600">{item.vendorId}</td>
            <td className="py-3 pr-4 text-slate-600">${item.amount.toLocaleString()}</td>
            <td className="py-3 pr-4">
              <DueBadge days={item.daysUntilDue} />
            </td>
            <td className="py-3 font-medium text-slate-900">{item.priorityScore.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-slate-200">
          <td className="py-3 pr-4 font-semibold text-slate-900" colSpan={2}>
            Total
          </td>
          <td className="py-3 pr-4 font-semibold text-slate-900">${total.toLocaleString()}</td>
          <td className="py-3 pr-4" />
          <td className="py-3" />
        </tr>
      </tfoot>
    </table>
  );
}

function DueBadge({ days }: { days: number }) {
  const tone = days <= 0 ? "bg-red-50 text-red-700" : days <= 14 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  const label = days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`;

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}
