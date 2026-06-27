// Known, scheduled cash outflows that don't live in the sales/invoice tables:
// payroll, committed supplier POs, fixed operating costs. Both the deterministic
// projection and the rule-based risk alerts read from here.
//
// All timing is expressed as an OFFSET IN DAYS from "today" (the day the
// projection runs), so the demo curve stays identical no matter when you run it.
// Tune the numbers here to reshape the projection — nothing else needs to change.

export interface RecurringOutflow {
  label: string;
  amount: number;
  intervalDays: number;    // e.g. 14 = biweekly
  firstOffsetDays: number; // first occurrence, days from today
  occurrences: number;     // hard cap on how many times it repeats
}

export interface OneTimeOutflow {
  label: string;
  amount: number;
  offsetDays: number; // days from today
}

export interface OutflowEvent {
  date: string; // YYYY-MM-DD
  label: string;
  amount: number;
}

// Flat daily operating cost applied every day of the horizon.
export const BASELINE_DAILY_OPEX = 800;

// 3 payroll runs (days 9, 23, 37) sized to produce the ~-$27k trough.
export const RECURRING_OUTFLOWS: RecurringOutflow[] = [
  { label: "Payroll", amount: 14_000, intervalDays: 14, firstOffsetDays: 9, occurrences: 3 },
];

export const ONE_TIME_OUTFLOWS: OneTimeOutflow[] = [
  { label: "Supplier restock (PO)", amount: 60_000, offsetDays: 16 },
];

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Expands the config into concrete dated events between today (inclusive) and
// today + horizonDays. The projection just sums these by day; the risk-alert
// layer uses the labels to explain *why* a given day is heavy.
export function scheduledOutflowEvents(today: string, horizonDays: number): OutflowEvent[] {
  const events: OutflowEvent[] = [];

  for (const r of RECURRING_OUTFLOWS) {
    for (let i = 0; i < r.occurrences; i++) {
      const offset = r.firstOffsetDays + i * r.intervalDays;
      if (offset >= 0 && offset <= horizonDays) {
        events.push({ date: addDays(today, offset), label: r.label, amount: r.amount });
      }
    }
  }

  for (const o of ONE_TIME_OUTFLOWS) {
    if (o.offsetDays >= 0 && o.offsetDays <= horizonDays) {
      events.push({ date: addDays(today, o.offsetDays), label: o.label, amount: o.amount });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}