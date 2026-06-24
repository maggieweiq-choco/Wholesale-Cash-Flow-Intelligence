import type { CollectionsItem } from "@/agents/receivables-agent";

export function ReceivablesTable({ items }: { items: CollectionsItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No overdue invoices.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4">Invoice</th>
          <th className="py-2 pr-4">Customer</th>
          <th className="py-2 pr-4">Amount</th>
          <th className="py-2 pr-4">Days Overdue</th>
          <th className="py-2">Priority</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.invoiceId} className="border-b border-slate-100 last:border-0">
            <td className="py-3 pr-4 font-medium text-slate-900">{item.invoiceId}</td>
            <td className="py-3 pr-4 text-slate-600">{item.customerId}</td>
            <td className="py-3 pr-4 text-slate-600">${item.amount.toLocaleString()}</td>
            <td className="py-3 pr-4">
              <OverdueBadge days={item.daysOverdue} />
            </td>
            <td className="py-3 font-medium text-slate-900">{item.priorityScore.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OverdueBadge({ days }: { days: number }) {
  const tone =
    days >= 30
      ? "bg-red-50 text-red-700"
      : days >= 7
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{days}d</span>
  );
}
