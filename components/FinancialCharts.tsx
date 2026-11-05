"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VoucherSummary } from "@/types";

type FinancialChartsProps = {
  data: VoucherSummary[];
};

const chartTooltipStyle = {
  borderRadius: "0.75rem",
  border: "1px solid var(--chart-tooltip-border, #e2e8f0)",
  background: "var(--chart-tooltip-bg, #fff)",
  color: "var(--foreground, #0f172a)",
};

export function SalesExpensesBarChart({ data }: FinancialChartsProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <YAxis tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Legend />
          <Bar dataKey="sales" name="Sales" fill="#E5C365" radius={[6, 6, 0, 0]} />
          <Bar
            dataKey="expenses"
            name="Purchases & Expenses"
            fill="#9E7C28"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NetProfitAreaChart({ data }: FinancialChartsProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E5C365" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#E5C365" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <YAxis tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Area
            type="monotone"
            dataKey="net_profit"
            name="Net Profit"
            stroke="#E5C365"
            fill="url(#profitFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GstSummaryBarChart({ data }: FinancialChartsProps) {
  const gstRows = data.map((row) => ({
    period: row.period,
    "GST Payable": row.gst_payable,
    "GST Input": row.gst_input,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={gstRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <YAxis tick={{ fontSize: 12, fill: "var(--foreground)" }} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Legend />
          <Bar dataKey="GST Payable" fill="#E5C365" radius={[6, 6, 0, 0]} />
          <Bar dataKey="GST Input" fill="#9E7C28" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
