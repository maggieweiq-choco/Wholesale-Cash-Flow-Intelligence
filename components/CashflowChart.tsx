"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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
}

// Works for both the projection and the forecast — any series of {date, balance}.
// breakDate draws the red breakpoint marker; lowest pins the trough.
export function CashflowChart({
  data,
  breakDate,
  lowest,
}: {
  data: ChartPoint[];
  breakDate?: string | null;
  lowest?: { date: string; balance: number } | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
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
          formatter={(value: number) => [`$${value.toLocaleString()}`, "Balance"]}
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
        />
        <Line type="monotone" dataKey="balance" stroke="#0f172a" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
