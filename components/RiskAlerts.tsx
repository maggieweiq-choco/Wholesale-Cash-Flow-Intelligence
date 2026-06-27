"use client";

export type AlertSeverity = "critical" | "warning" | "info";

// Mirrors lib/projection.ts RiskAlert. Defined here so client components don't
// import the server-only projection module. source: "ai" -> "AI Alert" badge.
export interface RiskAlert {
  id: string;
  severity: AlertSeverity;
  source: "rule" | "ai";
  title: string;
  detail: string;
}

const SEVERITY: Record<AlertSeverity, { dot: string; ring: string }> = {
  critical: { dot: "bg-red-500", ring: "border-red-200 bg-red-50/60" },
  warning: { dot: "bg-amber-500", ring: "border-amber-200 bg-amber-50/60" },
  info: { dot: "bg-slate-400", ring: "border-slate-200 bg-white" },
};

const ORDER: AlertSeverity[] = ["critical", "warning", "info"];

export function RiskAlerts({ alerts }: { alerts: RiskAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
        No risk alerts right now.
      </div>
    );
  }

  const sorted = [...alerts].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));

  return (
    <div className="flex flex-col gap-2.5">
      {sorted.map((a) => {
        const s = SEVERITY[a.severity];
        return (
          <div key={a.id} className={`flex items-start gap-3 rounded-xl border p-4 ${s.ring}`}>
            <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${s.dot}`} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{a.title}</span>
                {a.source === "ai" && (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                    AI Alert
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
