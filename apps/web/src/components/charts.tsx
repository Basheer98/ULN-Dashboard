"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = "#71717a";
const GRID = "#27272a";
const ACCENT = "#2dd4bf";
const SERIES = ["#2dd4bf", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#34d399", "#f472b6", "#38bdf8"];

const STATUS_COLORS: Record<string, string> = {
  Draft: "#71717a",
  Assigned: "#60a5fa",
  "In Progress": "#fbbf24",
  Complete: "#34d399",
  Invoiced: "#2dd4bf",
  Paid: "#22c55e",
  Cancelled: "#f87171",
};

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

const tooltipStyle = {
  backgroundColor: "#1c1c1f",
  border: "1px solid #27272a",
  borderRadius: 8,
  color: "#fafafa",
  fontSize: 12,
} as const;

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function SqftAreaChart({ data }: { data: { month: string; sqft: number }[] }) {
  if (!data.some((d) => d.sqft > 0)) return <EmptyState label="No completed SQFT yet" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="sqftFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={compact} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ stroke: GRID }}
          formatter={(v) => [`${Number(v).toLocaleString()} SQFT`, "Completed"]}
        />
        <Area type="monotone" dataKey="sqft" stroke={ACCENT} strokeWidth={2} fill="url(#sqftFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FinanceBarChart({
  data,
}: {
  data: { month: string; revenue: number; payout: number; margin: number }[];
}) {
  if (!data.some((d) => d.revenue > 0 || d.payout > 0)) {
    return <EmptyState label="No revenue recorded yet" />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${compact(v)}`} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v, name) => [`$${Number(v).toLocaleString()}`, name as string]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
        <Bar dataKey="revenue" name="Revenue" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
        <Bar dataKey="payout" name="Fielder Pay" fill="#60a5fa" radius={[4, 4, 0, 0]} />
        <Bar dataKey="margin" name="Margin" fill="#a78bfa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <EmptyState label="No projects yet" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? ACCENT} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${Number(v)} projects`, n as string]} />
        <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function FielderMixDonut({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <EmptyState label="No fielders yet" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={i === 0 ? "#2dd4bf" : "#60a5fa"} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${Number(v)} fielders`, n as string]} />
        <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopFieldersChart({ data }: { data: { name: string; sqft: number; jobs: number }[] }) {
  if (!data.length) return <EmptyState label="No assignments yet" />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="name"
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={80}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v) => [`${Number(v).toLocaleString()} SQFT`, "Worked"]}
        />
        <Bar dataKey="sqft" fill={ACCENT} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SqftByClientChart({ data }: { data: { name: string; sqft: number }[] }) {
  if (!data.length) return <EmptyState label="No client data yet" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} interval={0} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={compact} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v) => [`${Number(v).toLocaleString()} SQFT`, "Total"]}
        />
        <Bar dataKey="sqft" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function JobTypeChart({ data }: { data: { name: string; sqft: number }[] }) {
  if (!data.length) return <EmptyState label="No job type data yet" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="sqft"
          nameKey="name"
          outerRadius={90}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${Number(v).toLocaleString()} SQFT`, n as string]} />
        <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SqftByStateChart({
  data,
}: {
  data: { code: string; name: string; sqft: number; revenue: number }[];
}) {
  if (!data.length) return <EmptyState label="No state data yet" />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="name"
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={72}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v, n) =>
            n === "revenue"
              ? [`$${Number(v).toLocaleString()}`, "Revenue"]
              : [`${Number(v).toLocaleString()} SQFT`, "SQFT"]
          }
        />
        <Bar dataKey="sqft" name="sqft" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={entry.code} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
