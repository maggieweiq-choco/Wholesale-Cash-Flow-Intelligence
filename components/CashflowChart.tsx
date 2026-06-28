"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
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

// Works for both the projection and the forecast — any series of
// {date, balance, cashIn?, cashOut?}. breakDate draws the red breakpoint
// marker; lowest pins the trough. When cashIn/cashOut are present, they
// render as in/out bars (out shown below zero) so it's clear what's
// driving each day's balance, not just where the line ends up.
export function CashflowChart({
  data,
  breakDate,
  lowest,
}: {
  data: ChartPoint[];
  breakDate?: string | null;
  lowest?: { date: string; balance: number } | null;
}) {
  const hasFlows = data.some((d) => d.cashIn !== undefined || d.cashOut !== undefined);
  const chartData = data.map((d) => ({ ...d, cashOutNeg: d.cashOut ? -d.cashOut : undefined }));

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
            const label = name === "cashOutNeg" ? "Cash Out" : name === "cashIn" ? "Cash In" : "Balance";
            return [`$${Math.abs(value).toLocaleString()}`, label];
          }}
          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
        />
        {hasFlows && <Bar dataKey="cashIn" fill="#10b981" fillOpacity={0.6} barSize={6} />}
        {hasFlows && <Bar dataKey="cashOutNeg" fill="#ef4444" fillOpacity={0.6} barSize={6} />}
        <Line type="monotone" dataKey="balance" stroke="#0f172a" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
