import { getCompanyData } from "@/lib/queries";
import { BASELINE_DAILY_OPEX, scheduledOutflowEvents } from "@/lib/scheduled-outflows";

export interface ProjectionDay {
  date: string;
  dayIndex: number;
  cashIn: number;
  cashOut: number;
  balance: number;
  gap: number; // balance when negative, else 0
}

export interface ProfitDay {
  date: string;
  accrualBalance: number; // openingCash + cumulative(daily gross profit - amortized daily opex)
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface RiskAlert {
  id: string;
  severity: AlertSeverity;
  source: "rule" | "ai";
  title: string;
  detail: string;
}

export interface Projection {
  openingCash: number;
  horizonDays: number;
  days: ProjectionDay[];
  profitDays: ProfitDay[]; // accrual-basis P&L line, same horizon, same opening point
  lowestBalance: number;
  lowestBalanceDate: string | null;
  firstBreakDate: string | null;
  worstGap: number; // most negative balance reached, <= 0
  overdueTotal: number; // AR excluded from inflow under the Option-A rule
  alerts: RiskAlert[]; // rule-based only; AI alerts get merged in by the API layer
}

export interface ProjectionOptions {
  horizonDays?: number;
  extraInflows?: { dayOffset: number; amount: number }[];
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOffset(today: string, iso: string): number {
  return Math.round((new Date(iso).getTime() - new Date(today).getTime()) / 86_400_000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function money(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
}

const MIN_HORIZON_DAYS = 30;

export async function computeProjection(
  companyId: string,
  openingCash = 50_000,
  opts: ProjectionOptions = {}
): Promise<Projection> {
  const { invoices, customers, sales, inventory: inv } = await getCompanyData(companyId);
  const today = new Date().toISOString().slice(0, 10);
  const custById = new Map(customers.map((c) => [c.id, c]));

  const unpaid = invoices.filter((inv) => inv.status !== "paid");

  const countedInflows: { date: string; amount: number }[] = [];
  const overdueByCustomer = new Map<string, number>();
  const outstandingByCustomer = new Map<string, number>();

  for (const inv of unpaid) {
    const amount = Number(inv.amount);
    const avgLate = Math.round(Number(custById.get(inv.customerId)?.avgDaysLate ?? 0));
    const expected = addDays(inv.dueAt, avgLate);

    outstandingByCustomer.set(
      inv.customerId,
      (outstandingByCustomer.get(inv.customerId) ?? 0) + amount
    );

    if (expected >= today) {
      countedInflows.push({ date: expected, amount });
    } else {
      overdueByCustomer.set(
        inv.customerId,
        (overdueByCustomer.get(inv.customerId) ?? 0) + amount
      );
    }
  }

  const lastInflowOffset = countedInflows.reduce(
    (max, f) => Math.max(max, dayOffset(today, f.date)),
    0
  );
  const lastOutflowOffset = scheduledOutflowEvents(today, 3650).reduce(
    (max, e) => Math.max(max, dayOffset(today, e.date)),
    0
  );
  const horizonDays =
    opts.horizonDays ?? Math.max(MIN_HORIZON_DAYS, lastInflowOffset, lastOutflowOffset);

  const inByDate = new Map<string, number>();
  for (const f of countedInflows) {
    inByDate.set(f.date, (inByDate.get(f.date) ?? 0) + f.amount);
  }
  for (const e of opts.extraInflows ?? []) {
    if (e.dayOffset >= 0 && e.dayOffset <= horizonDays) {
      const date = addDays(today, e.dayOffset);
      inByDate.set(date, (inByDate.get(date) ?? 0) + e.amount);
    }
  }

  const outflowEvents = scheduledOutflowEvents(today, horizonDays);
  const outByDate = new Map<string, number>();
  for (const e of outflowEvents) {
    outByDate.set(e.date, (outByDate.get(e.date) ?? 0) + e.amount);
  }

  const days: ProjectionDay[] = [];
  let balance = openingCash;
  let lowestBalance = openingCash;
  let lowestBalanceDate: string | null = null;
  let firstBreakDate: string | null = null;

  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(today, i);
    const cashIn = inByDate.get(date) ?? 0;
    const cashOut = (outByDate.get(date) ?? 0) + BASELINE_DAILY_OPEX;
    balance = round2(balance + cashIn - cashOut);

    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestBalanceDate = date;
    }
    if (firstBreakDate === null && balance < 0) firstBreakDate = date;

    days.push({
      date,
      dayIndex: i,
      cashIn: round2(cashIn),
      cashOut: round2(cashOut),
      balance,
      gap: balance < 0 ? balance : 0,
    });
  }

  const worstGap = Math.min(0, lowestBalance);
  const overdueTotal = [...overdueByCustomer.values()].reduce((a, b) => a + b, 0);

  // Profit line: accrual P&L starting from the same openingCash.
  // Gross profit per day = Σ_sku (revenue − unitCost × soldQty) for that soldAt date.
  // Opex is amortized daily (payroll spread evenly; supplier PO is a balance-sheet item, excluded).
  const unitCostBySku = new Map(inv.map((r) => [r.sku, Number(r.unitCost ?? 0)]));
  const dailyGrossProfit = new Map<string, number>();
  for (const row of sales) {
    const gp = Number(row.revenue ?? 0) - (unitCostBySku.get(row.sku) ?? 0) * row.soldQty;
    dailyGrossProfit.set(row.soldAt, (dailyGrossProfit.get(row.soldAt) ?? 0) + gp);
  }
  const payrollTotal = outflowEvents
    .filter((e) => e.label === "Payroll")
    .reduce((s, e) => s + e.amount, 0);
  const amortizedDailyOpex = BASELINE_DAILY_OPEX + payrollTotal / (horizonDays + 1);

  const profitDays: ProfitDay[] = [];
  let accrualBal = openingCash;
  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(today, i);
    accrualBal = round2(accrualBal + (dailyGrossProfit.get(date) ?? 0) - amortizedDailyOpex);
    profitDays.push({ date, accrualBalance: accrualBal });
  }

  const alerts: RiskAlert[] = [];

  if (firstBreakDate) {
    alerts.push({
      id: "cash-break",
      severity: "critical",
      source: "rule",
      title: "Cash Breakpoint",
      detail: `Balance is projected to fall below zero on ${firstBreakDate} (day ${dayOffset(today, firstBreakDate)}), reaching a low of ${money(lowestBalance)}${lowestBalanceDate ? ` (${lowestBalanceDate})` : ""}.`,
    });
  }

  const next30 = outflowEvents.filter((e) => dayOffset(today, e.date) <= 30);
  if (next30.length) {
    const sum = next30.reduce((s, e) => s + e.amount, 0);
    const list = next30.map((e) => `${e.label} ${money(e.amount)} (${e.date})`).join(", ");
    alerts.push({
      id: "outflow-cluster",
      severity: "warning",
      source: "rule",
      title: "Large Outflow Cluster",
      detail: `There are ${money(sum)} of scheduled outflows in the next 30 days: ${list}. They are concentrated before major receivables arrive, making them a direct cause of the breakpoint.`,
    });
  }

  if (overdueTotal > 0) {
    const topOverdue = [...overdueByCustomer.entries()].sort((a, b) => b[1] - a[1])[0];
    const topName = topOverdue ? custById.get(topOverdue[0])?.name ?? topOverdue[0] : "";
    const coverNote =
      worstGap < 0
        ? `Recovering roughly half of it (${money(overdueTotal / 2)}) would cover the ${money(Math.abs(worstGap))} gap.`
        : `This is an overdue cash source that is intentionally excluded from the projection.`;
    alerts.push({
      id: "overdue-ar",
      severity: "warning",
      source: "rule",
      title: "Overdue Receivables Uncollected",
      detail: `${money(overdueTotal)} of receivables remain unpaid beyond the customers' normal payment window and are conservatively excluded from the projection${topOverdue ? `, with ${topName} accounting for ${money(topOverdue[1])}` : ""}. ${coverNote}`,
    });
  }

  const totalOutstanding = [...outstandingByCustomer.values()].reduce((a, b) => a + b, 0);
  if (totalOutstanding > 0) {
    const ranked = [...outstandingByCustomer.entries()].sort((a, b) => b[1] - a[1]);
    const top2 = ranked.slice(0, 2);
    const top2Sum = top2.reduce((s, [, v]) => s + v, 0);
    const share = top2Sum / totalOutstanding;
    if (top2.length === 2 && share >= 0.5) {
      const names = top2
        .map(([id, v]) => `${custById.get(id)?.name ?? id} (${money(v)})`)
        .join(", ");
      alerts.push({
        id: "concentration",
        severity: "warning",
        source: "rule",
        title: "Customer Concentration Risk",
        detail: `The top two customers, ${names}, account for ${Math.round(share * 100)}% of outstanding receivables. A delay from either one would materially widen the gap.`,
      });
    }
  }

  return {
    openingCash,
    horizonDays,
    days,
    profitDays,
    lowestBalance,
    lowestBalanceDate,
    firstBreakDate,
    worstGap,
    overdueTotal,
    alerts,
  };
}
