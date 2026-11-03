"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import {
  DashboardLoadingSkeleton,
} from "@/components/LoadingSkeleton";
import {
  GstSummaryBarChart,
  NetProfitAreaChart,
  SalesExpensesBarChart,
} from "@/components/FinancialCharts";
import { EmptyStateGraphic } from "@/components/ui/EmptyStateGraphic";
import { getSupabase } from "@/lib/supabase";
import type { VoucherSummary } from "@/types";

type SummaryRow = {
  period_start: string;
  period_end: string;
  total_sales: number | string;
  total_purchases: number | string;
  total_expenses: number | string;
  net_profit: number | string;
  gst_payable: number | string;
  gst_input: number | string;
  last_synced_at: string;
};

type VoucherRow = {
  id: string;
  voucher_date: string;
  voucher_number: string | null;
  voucher_type: string;
  party_name: string | null;
  total_amount: number | string;
};

type DashboardData = {
  companyName: string;
  profileName: string | null;
  summaries: SummaryRow[];
  vouchers: VoucherRow[];
};

function numericValue(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPeriod(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) throw new Error("Your session has expired. Sign in again.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id, full_name")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile?.company_id) {
    throw new Error(
      "No client company is linked to this account. Contact your administrator.",
    );
  }

  const [companyResult, summariesResult, vouchersResult] = await Promise.all([
    supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .maybeSingle(),
    supabase
      .from("financial_summaries")
      .select(
        "period_start, period_end, total_sales, total_purchases, total_expenses, net_profit, gst_payable, gst_input, last_synced_at",
      )
      .eq("company_id", profile.company_id)
      .order("period_start", { ascending: true })
      .returns<SummaryRow[]>(),
    supabase
      .from("vouchers")
      .select(
        "id, voucher_date, voucher_number, voucher_type, party_name, total_amount",
      )
      .eq("company_id", profile.company_id)
      .order("voucher_date", { ascending: false })
      .limit(10)
      .returns<VoucherRow[]>(),
  ]);
  const queryError =
    companyResult.error ?? summariesResult.error ?? vouchersResult.error;
  if (queryError) throw new Error(queryError.message);
  if (!companyResult.data) {
    throw new Error("The company linked to this account could not be found.");
  }

  return {
    companyName: companyResult.data.name,
    profileName: profile.full_name,
    summaries: summariesResult.data ?? [],
    vouchers: vouchersResult.data ?? [],
  };
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  const chartData = useMemo<VoucherSummary[]>(
    () =>
      (dashboard?.summaries ?? []).map((summary) => ({
        period: formatPeriod(summary.period_start),
        sales: numericValue(summary.total_sales),
        expenses:
          numericValue(summary.total_purchases) +
          numericValue(summary.total_expenses),
        net_profit: numericValue(summary.net_profit),
        gst_payable: numericValue(summary.gst_payable),
        gst_input: numericValue(summary.gst_input),
      })),
    [dashboard?.summaries],
  );
  const latest = chartData.at(-1);
  const lastSyncedAt = dashboard?.summaries.at(-1)?.last_synced_at;

  useEffect(() => {
    let cancelled = false;
    void fetchDashboardData()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load financial data.";
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadVersion]);

  return (
    <AuthGuard allow="company">
      <div className="min-h-screen bg-white dark:bg-[#0F172A]">
        <AppHeader
          title="Financial Overview"
          subtitle="Read-only financial reporting"
          identityName={dashboard?.companyName ?? dashboard?.profileName ?? undefined}
          identityLabel="Client company"
        />
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-6xl space-y-8 px-6 py-8"
        >
          {loading ? (
            <DashboardLoadingSkeleton />
          ) : error ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
              <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">
                {error}
              </p>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLoading(true);
                  setReloadVersion((version) => version + 1);
                }}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-[#60A5FA] dark:text-slate-950"
              >
                Retry
              </button>
            </section>
          ) : (
            <>
              {latest ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: `Sales · ${latest.period}`, value: latest.sales },
                    {
                      label: `Purchases & expenses · ${latest.period}`,
                      value: latest.expenses,
                    },
                    {
                      label: `Net profit · ${latest.period}`,
                      value: latest.net_profit,
                    },
                  ].map((stat, index) => (
                    <motion.section
                      key={stat.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]"
                    >
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                        {formatCurrency(stat.value)}
                      </p>
                    </motion.section>
                  ))}
                </div>
              ) : null}

              {lastSyncedAt ? (
                <p className="text-right text-xs text-slate-500 dark:text-slate-400">
                  Last synced{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(lastSyncedAt))}
                </p>
              ) : null}

              {chartData.length > 0 ? (
                <>
                  <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      Sales vs Purchases & Expenses
                    </h2>
                    <SalesExpensesBarChart data={chartData} />
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      Net Profit Trend
                    </h2>
                    <NetProfitAreaChart data={chartData} />
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-6 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      GST Summary
                    </h2>
                    <GstSummaryBarChart data={chartData} />
                  </section>
                </>
              ) : null}

              {dashboard?.vouchers.length ? (
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
                  <div className="border-b border-slate-200 px-5 py-4 dark:border-[#334155]">
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                      Recent vouchers
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Latest entries synchronized from TallyPrime
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white text-slate-600 dark:bg-[#0F172A]/50 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Voucher</th>
                          <th className="px-5 py-3 font-medium">Type</th>
                          <th className="px-5 py-3 font-medium">Party</th>
                          <th className="px-5 py-3 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.vouchers.map((voucher) => (
                          <tr
                            key={voucher.id}
                            className="border-t border-slate-100 dark:border-[#334155]"
                          >
                            <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">
                              {new Intl.DateTimeFormat("en-IN", {
                                dateStyle: "medium",
                                timeZone: "UTC",
                              }).format(new Date(`${voucher.voucher_date}T00:00:00Z`))}
                            </td>
                            <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                              {voucher.voucher_number || "—"}
                            </td>
                            <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">
                              {voucher.voucher_type}
                            </td>
                            <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                              {voucher.party_name || "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency(numericValue(voucher.total_amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {chartData.length === 0 && !dashboard?.vouchers.length ? (
                <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
                  <EmptyStateGraphic
                    title="No synced financial data yet"
                    description="Once the TallyPrime sync is configured, your vouchers, monthly summaries, sales, expenses, and GST figures will appear here."
                  />
                </section>
              ) : null}

              {chartData.length === 0 && dashboard?.vouchers.length ? (
                <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
                  <EmptyStateGraphic
                    title="Monthly summaries are not available"
                    description="Voucher data is available, but monthly metrics have not been synchronized yet."
                  />
                </section>
              ) : null}
            </>
          )}
        </motion.main>
      </div>
    </AuthGuard>
  );
}
