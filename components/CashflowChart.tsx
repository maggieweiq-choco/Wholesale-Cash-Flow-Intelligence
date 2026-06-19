"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CashflowDay } from "@/agents/cashflow-agent";

export function CashflowChart({ data }: { data: CashflowDay[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="balance" stroke="#2563eb" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
