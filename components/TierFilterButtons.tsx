"use client";

import type { SkuTier } from "@/lib/sku-tiers";

const TIERS: SkuTier[] = ["A", "B", "C", "D"];

// Multi-select tier filter: click a tier to toggle it in/out of the
// selection, click "All Tiers" to clear the selection back to everything.
export function TierFilterButtons({
  selected,
  onChange,
}: {
  selected: Set<SkuTier>;
  onChange: (next: Set<SkuTier>) => void;
}) {
  function toggle(tier: SkuTier) {
    const next = new Set(selected);
    if (next.has(tier)) next.delete(tier);
    else next.add(tier);
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
        All Tiers
      </button>
      {TIERS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => toggle(t)}
          className={`rounded px-3 py-1 text-xs font-medium ${
            selected.has(t) ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Tier {t}
        </button>
      ))}
    </div>
  );
}
