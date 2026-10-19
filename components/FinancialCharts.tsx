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
};

export function SalesExpensesBarChart({ data }: FinancialChartsProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Legend />
          <Bar dataKey="sales" name="Sales" fill="#2563EB" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#94A3B8" radius={[6, 6, 0, 0]} />
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
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Area
            type="monotone"
            dataKey="net_profit"
            name="Net Profit"
            stroke="#2563EB"
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
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Legend />
          <Bar dataKey="GST Payable" fill="#60A5FA" radius={[6, 6, 0, 0]} />
          <Bar dataKey="GST Input" fill="#34D399" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const demoFinancialData: VoucherSummary[] = [
  {
    period: "Apr",
    sales: 420000,
    expenses: 280000,
    net_profit: 140000,
    gst_payable: 32000,
    gst_input: 18000,
  },
  {
    period: "May",
    sales: 510000,
    expenses: 310000,
    net_profit: 200000,
    gst_payable: 38000,
    gst_input: 21000,
  },
  {
    period: "Jun",
    sales: 480000,
    expenses: 295000,
    net_profit: 185000,
    gst_payable: 35000,
    gst_input: 19500,
  },
  {
    period: "Jul",
    sales: 560000,
    expenses: 330000,
    net_profit: 230000,
    gst_payable: 41000,
    gst_input: 22000,
  },
];
