"use client";

import type { PurchasingItem } from "@/agents/purchasing-agent";

type Urgency = PurchasingItem["urgency"];

const URGENCIES: Urgency[] = ["reorder_now", "reorder_soon", "healthy"];

const URGENCY_LABEL: Record<Urgency, string> = {
  reorder_now: "Reorder now",
  reorder_soon: "Reorder soon",
  healthy: "Healthy",
};

// Multi-select urgency filter — same toggle pattern as TierFilterButtons.
export function UrgencyFilterButtons({
  selected,
  onChange,
}: {
  selected: Set<Urgency>;
  onChange: (next: Set<Urgency>) => void;
}) {
  function toggle(urgency: Urgency) {
    const next = new Set(selected);
    if (next.has(urgency)) next.delete(urgency);
    else next.add(urgency);
    onChange(next);
  }

  return (
    <div className="flex rounded-md border border-slate-300 p-0.5">
      <button
        type="button"
        onClick={() => onChange(new Set())}
        className={`rounded px-3 py-1 text-xs font-medium ${
          selected.size === 0 ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        All Urgency
      </button>
      {URGENCIES.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => toggle(u)}
          className={`rounded px-3 py-1 text-xs font-medium ${
            selected.has(u) ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {URGENCY_LABEL[u]}
        </button>
      ))}
    </div>
  );
}
