import type { CollectionsItem } from "@/agents/receivables-agent";

export function ReceivablesTable({ items }: { items: CollectionsItem[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-zinc-500">
          <th className="py-2">Invoice</th>
          <th className="py-2">Customer</th>
          <th className="py-2">Amount</th>
          <th className="py-2">Days Overdue</th>
          <th className="py-2">Priority</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.invoiceId} className="border-t border-zinc-200">
            <td className="py-2">{item.invoiceId}</td>
            <td className="py-2">{item.customerId}</td>
            <td className="py-2">${item.amount.toLocaleString()}</td>
            <td className="py-2">{item.daysOverdue}</td>
            <td className="py-2">{item.priorityScore.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
