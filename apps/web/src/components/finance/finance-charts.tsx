"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@uln/shared";

const AXIS = "#71717a";
const GRID = "#27272a";
const ACCENT = "#2dd4bf";

const tooltipStyle = {
  backgroundColor: "#1c1c1f",
  border: "1px solid #27272a",
  borderRadius: 8,
  color: "#fafafa",
  fontSize: 12,
} as const;

export function ExpensesByCategoryChart({
  data,
}: {
  data: { name: string; amount: number }[];
}) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No expense data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [formatCurrency(Number(v)), "Amount"]}
        />
        <Bar dataKey="amount" fill={ACCENT} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
