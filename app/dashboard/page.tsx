"use client";

import { motion } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import {
  demoFinancialData,
  GstSummaryBarChart,
  NetProfitAreaChart,
  SalesExpensesBarChart,
} from "@/components/FinancialCharts";

export default function DashboardPage() {
  const data = demoFinancialData;
  const latest = data[data.length - 1];

  return (
    <AuthGuard allow="company">
    <div className="min-h-screen bg-white dark:bg-[#0F172A]">
      <AppHeader
        title="Financial Overview"
        subtitle="Read-only analytics · Sample data until a sync integration is connected"
      />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-6xl space-y-8 px-6 py-8"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Sales (Jul)", value: `₹${latest.sales.toLocaleString("en-IN")}` },
            {
              label: "Expenses (Jul)",
              value: `₹${latest.expenses.toLocaleString("en-IN")}`,
            },
            {
              label: "Net profit (Jul)",
              value: `₹${latest.net_profit.toLocaleString("en-IN")}`,
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]"
            >
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {stat.value}
              </p>
            </motion.div>
          ))}
        </div>

        <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
            Sales vs Expenses
          </h2>
          <SalesExpensesBarChart data={data} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
            Net Profit Trend
          </h2>
          <NetProfitAreaChart data={data} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
            GST Summary
          </h2>
          <GstSummaryBarChart data={data} />
        </section>
      </motion.main>
    </div>
    </AuthGuard>
  );
}
