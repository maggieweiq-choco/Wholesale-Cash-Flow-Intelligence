"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartPoint {
  date: string;
  balance: number;
  cashIn?: number;
  cashOut?: number;
}

export function CashflowChart({
  data,
  profitLine,
  breakDate,
  lowest,
}: {
  data: ChartPoint[];
  profitLine?: { date: string; accrualBalance: number }[];
  breakDate?: string | null;
  lowest?: { date: string; balance: number } | null;
}) {
  const hasFlows = data.some((d) => d.cashIn !== undefined || d.cashOut !== undefined);
  const profitByDate = new Map(profitLine?.map((p) => [p.date, p.accrualBalance]) ?? []);
  const chartData = data.map((d) => ({
    ...d,
    cashOutNeg: d.cashOut ? -d.cashOut : undefined,
    accrualBalance: profitByDate.get(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <ReferenceLine y={0} stroke="#cbd5e1" />
        {profitLine && <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
        {breakDate && (
          <ReferenceLine
            x={breakDate}
            stroke="#dc2626"
            strokeDasharray="4 4"
            label={{ value: "Breakpoint", fill: "#dc2626", fontSize: 11, position: "insideTopRight" }}
          />
        )}
        {lowest && <ReferenceDot x={lowest.date} y={lowest.balance} r={4} fill="#dc2626" stroke="none" />}
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === "cashOutNeg") return [`$${Math.abs(value).toLocaleString()}`, "Cash Out"];
            if (name === "cashIn") return [`$${Math.abs(value).toLocaleString()}`, "Cash In"];
            if (name === "accrualBalance") return [`$${Math.abs(value).toLocaleString()}`, "Accrual Profit"];
            return [`$${Math.abs(value).toLocaleString()}`, "Cash Balance"];
          }}
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
        />
        {hasFlows && <Bar dataKey="cashIn" fill="#10b981" fillOpacity={0.6} barSize={6} legendType="none" />}
        {hasFlows && <Bar dataKey="cashOutNeg" fill="#ef4444" fillOpacity={0.6} barSize={6} legendType="none" />}
        <Line type="monotone" dataKey="balance" name="Cash Balance" stroke="#0f172a" strokeWidth={2} dot={false} />
        {profitLine && (
          <Line type="monotone" dataKey="accrualBalance" name="Accrual Profit" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 3" />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
