"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import {
  DashboardContentSkeleton,
} from "@/components/dashboard/DashboardSkeleton";
import {
  GstSummaryBarChart,
  NetProfitAreaChart,
  SalesExpensesBarChart,
} from "@/components/FinancialCharts";
import { EmptyStateGraphic } from "@/components/ui/EmptyStateGraphic";
import {
  DateFilter,
  getInitialDateRange,
  type DateRange,
} from "@/components/dashboard/DateFilter";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { getBrowserSupabase, getSupabase } from "@/lib/supabase";
import type { VoucherSummary } from "@/types";

type SummaryRow = {
  id?: string;
  period_start: string;
  period_end: string;
  total_sales: number | string;
  total_purchases: number | string;
  total_expenses: number | string;
  net_profit: number | string;
  cash_in_hand?: number | string | null;
  bank_balance?: number | string | null;
  gst_payable: number | string;
  gst_input: number | string;
  cgst_payable?: number | string | null;
  sgst_payable?: number | string | null;
  igst_payable?: number | string | null;
  cgst_amount?: number | string | null;
  sgst_amount?: number | string | null;
  igst_amount?: number | string | null;
  updated_at?: string | null;
  last_synced_at?: string | null;
};

type VoucherRow = {
  id: string;
  date: string | null;
  voucher_number: string | null;
  voucher_type: string;
  party_name: string | null;
  narration: string | null;
  total_amount: number | string | null;
  amount: number | string | null;
  voucher_date?: string | null;
};

type DashboardData = {
  companyId: string;
  companyName: string;
  profileName: string | null;
  summaries: SummaryRow[];
  vouchers: VoucherRow[];
  summaryWarning: string | null;
  voucherWarning: string | null;
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

async function fetchDashboardData(
  startDate: string,
  endDate: string,
): Promise<DashboardData> {
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

  const [companyResult] = await Promise.all([
    supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .maybeSingle(),
  ]);
  const voucherQuery = (
    columns: string,
    orderColumn: string,
    dateColumn: string,
  ) => {
    const query = supabase
      .from("vouchers")
      .select(columns)
      .eq("company_id", profile.company_id)
      .gte(dateColumn, startDate)
      .lte(dateColumn, endDate)
      .order(orderColumn, { ascending: false })
      .limit(1000);
    return query.returns<
        {
          id: string;
          total_amount?: number | string | null;
          amount?: number | string | null;
          party_name?: string | null;
          voucher_type?: string | null;
          date?: string | null;
          voucher_date?: string | null;
          narration?: string | null;
          voucher_number?: string | null;
        }[]
      >();
  };
  const voucherVariants = [
    {
      columns:
        "id, total_amount, amount, party_name, voucher_type, date, voucher_date, voucher_number, narration",
      orderColumn: "date",
      dateColumn: "voucher_date",
    },
    {
      columns:
        "id, total_amount, amount, party_name, voucher_type, date, narration",
      orderColumn: "date",
      dateColumn: "date",
    },
    {
      columns:
        "id, total_amount, party_name, voucher_type, voucher_date, voucher_number, narration",
      orderColumn: "voucher_date",
      dateColumn: "voucher_date",
    },
    {
      columns:
        "id, total_amount, voucher_date, voucher_number, voucher_type, party_name",
      orderColumn: "voucher_date",
      dateColumn: "voucher_date",
    },
    {
      columns: "id, amount, date, voucher_type, party_name, narration",
      orderColumn: "date",
      dateColumn: "date",
    },
  ];
  let voucherRows: VoucherRow[] = [];
  let voucherWarning: string | null = null;
  for (const variant of voucherVariants) {
    try {
      const result = await voucherQuery(
        variant.columns,
        variant.orderColumn,
        variant.dateColumn,
      );
      if (!result.error) {
        voucherRows = (result.data ?? []).map((voucher) => ({
          id: voucher.id,
          date: voucher.date ?? voucher.voucher_date ?? null,
          voucher_number: voucher.voucher_number ?? null,
          voucher_type: voucher.voucher_type ?? "unknown",
          party_name: voucher.party_name ?? null,
          narration: voucher.narration ?? null,
          total_amount: voucher.total_amount ?? null,
          amount: voucher.amount ?? null,
        }));
        voucherWarning = null;
        break;
      }
      voucherWarning = result.error.message;
    } catch (voucherError) {
      voucherWarning =
        voucherError instanceof Error
          ? voucherError.message
          : "Unable to load voucher data.";
    }
  }
  const summaryQuery = (columns: string) =>
    supabase
      .from("financial_summaries")
      .select(columns)
      .eq("company_id", profile.company_id)
      .gte("period_end", startDate)
      .lte("period_start", endDate)
      .order("period_start", { ascending: true })
      .returns<SummaryRow[]>();
  const summaryColumnSets = [
    "id, total_sales, total_purchases, total_expenses, net_profit, cash_in_hand, bank_balance, period_start, period_end, updated_at, gst_payable, gst_input, cgst_payable, sgst_payable, igst_payable, last_synced_at",
    "id, total_sales, total_purchases, total_expenses, net_profit, period_start, period_end, updated_at, gst_payable, gst_input, cgst_payable, sgst_payable, igst_payable, last_synced_at",
    "period_start, period_end, total_sales, total_purchases, total_expenses, net_profit, gst_payable, gst_input, last_synced_at",
    "period_start, period_end, total_sales, total_purchases, total_expenses, net_profit, cgst_payable, sgst_payable, igst_payable, last_synced_at",
    "period_start, period_end, total_sales, total_purchases, total_expenses, net_profit, cgst_amount, sgst_amount, igst_amount, last_synced_at",
    "period_start, period_end, total_sales, total_purchases, total_expenses, net_profit, last_synced_at",
  ];
  let summaries: SummaryRow[] = [];
  let summaryWarning: string | null = null;
  for (const columns of summaryColumnSets) {
    try {
      const result = await summaryQuery(columns);
      if (!result.error) {
        summaries = result.data ?? [];
        summaryWarning = null;
        break;
      }
      summaryWarning = result.error.message;
    } catch (summaryError) {
      summaryWarning =
        summaryError instanceof Error
          ? summaryError.message
          : "Unable to load financial summaries.";
    }
  }

  if (companyResult.error) throw new Error(companyResult.error.message);
  if (!companyResult.data) {
    throw new Error("The company linked to this account could not be found.");
  }

  const normalizedSummaries = summaries.map((summary) => {
    const {
      id,
      period_start = "",
      period_end = "",
      total_sales = 0,
      total_purchases = 0,
      total_expenses = 0,
      net_profit = 0,
      gst_payable,
      gst_input = 0,
      cgst_payable,
      sgst_payable,
      igst_payable,
      cgst_amount,
      sgst_amount,
      igst_amount,
      cash_in_hand,
      bank_balance,
      updated_at,
      last_synced_at,
    } = summary ?? {};
    return {
      id,
      period_start,
      period_end,
      total_sales: total_sales ?? 0,
      total_purchases: total_purchases ?? 0,
      total_expenses: total_expenses ?? 0,
      net_profit: net_profit ?? 0,
      gst_payable:
        gst_payable ??
        numericValue(cgst_payable ?? cgst_amount ?? 0) +
          numericValue(sgst_payable ?? sgst_amount ?? 0) +
          numericValue(igst_payable ?? igst_amount ?? 0),
      gst_input: gst_input ?? 0,
      cash_in_hand,
      bank_balance,
      updated_at,
      last_synced_at,
    };
  });
  if (
    !summaryWarning &&
    summaries.some(
      (summary) =>
        summary.total_sales == null ||
        summary.total_purchases == null ||
        summary.total_expenses == null ||
        summary.net_profit == null ||
        (summary.gst_payable == null &&
          summary.cgst_payable == null &&
          summary.sgst_payable == null &&
          summary.igst_payable == null &&
          summary.cgst_amount == null &&
          summary.sgst_amount == null &&
          summary.igst_amount == null),
    )
  ) {
    summaryWarning =
      "Some financial summary columns are unpopulated; missing amounts are shown as 0. Ask your administrator to review the sync schema and data.";
  }

  return {
    companyId: profile.company_id,
    companyName: companyResult.data.name,
    profileName: profile.full_name,
    summaries: normalizedSummaries,
    vouchers: voucherRows,
    summaryWarning,
    voucherWarning,
  };
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [realtimeError, setRealtimeError] = useState("");

  const refreshFromRealtime = useCallback(async () => {
    try {
      const data = await fetchDashboardData(
        dateRange.startDate,
        dateRange.endDate,
      );
      setDashboard(data);
      setError("");
      setRealtimeError("");
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to refresh live financial data.";
      setRealtimeError(message);
      toast.error(`Live dashboard update failed: ${message}`);
    }
  }, [dateRange.endDate, dateRange.startDate]);

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
  const latestSummary = dashboard?.summaries.at(-1);
  const lastSyncedAt =
    latestSummary?.last_synced_at ?? latestSummary?.updated_at ?? null;

  useEffect(() => {
    let cancelled = false;
    void fetchDashboardData(dateRange.startDate, dateRange.endDate)
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
  }, [dateRange.endDate, dateRange.startDate, reloadVersion]);

  useEffect(() => {
    const companyId = dashboard?.companyId;
    if (!companyId) return;

    const supabase = getBrowserSupabase();
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`dashboard-realtime-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_summaries",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          if (refreshTimeout) clearTimeout(refreshTimeout);
          refreshTimeout = setTimeout(() => {
            void refreshFromRealtime();
          }, 250);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vouchers",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          if (refreshTimeout) clearTimeout(refreshTimeout);
          refreshTimeout = setTimeout(() => {
            void refreshFromRealtime();
          }, 250);
        },
      )
      .subscribe((status, subscriptionError) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const message =
            subscriptionError?.message ??
            "Supabase Realtime could not connect. Dashboard data will remain available but may not update automatically.";
          setRealtimeError(message);
        }
      });

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      void supabase.removeChannel(channel);
    };
  }, [dashboard?.companyId, refreshFromRealtime]);

  return (
    <AuthGuard allow="company">
      <div className="min-h-screen bg-white dark:bg-transparent">
        <AppHeader
          title="Financial Overview"
          subtitle="Read-only financial reporting"
          identityName={dashboard?.companyName ?? dashboard?.profileName ?? undefined}
          identityLabel="Client company"
          roleLabel="Client"
          navItems={[
            { label: "Overview", href: "/dashboard" },
            { label: "GST Reports", href: "/dashboard/gst" },
          ]}
        />
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-6xl space-y-8 px-4 py-6 transform-gpu will-change-transform sm:px-6 lg:px-8"
        >
          <DateFilter
            onChange={(range) => {
              setLoading(true);
              setError("");
              setDateRange(range);
            }}
          />
          {loading ? (
            <DashboardContentSkeleton />
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
              <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {dateRange.startDate} through {dateRange.endDate}
                </p>
                <ExportButtons
                  reportTitle="Recent vouchers"
                  filename="finora-vouchers"
                  rows={(dashboard?.vouchers ?? []).map((voucher) => ({
                    Date: voucher.date ?? voucher.voucher_date ?? "",
                    Voucher: voucher.voucher_number ?? "",
                    Type: voucher.voucher_type,
                    Party: voucher.party_name ?? voucher.narration ?? "",
                    Amount: numericValue(
                      voucher.total_amount ?? voucher.amount ?? 0,
                    ),
                  }))}
                />
              </div>
              {latest ? (
                <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: `Sales · ${latest.period}`, value: latest.sales },
                    {
                      label: `Purchases · ${latest.period}`,
                      value: numericValue(latestSummary?.total_purchases ?? 0),
                    },
                    {
                      label: `Expenses · ${latest.period}`,
                      value: numericValue(latestSummary?.total_expenses ?? 0),
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
                      className="relative overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-finora-gold/50 hover:shadow-gold-glow active:translate-y-0 dark:border-finora-gold/20 dark:bg-finora-surface/70 dark:backdrop-blur-lg dark:hover:border-finora-gold/50 dark:hover:shadow-gold-glow before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-finora-gold/70 before:to-transparent"
                    >
                      <p className="relative text-sm text-slate-500 dark:text-slate-400">
                        {stat.label}
                      </p>
                      <p className="relative mt-1 text-2xl font-semibold text-slate-900 dark:text-[#F8F4E8]">
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
              {dashboard?.summaryWarning ? (
                <p
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  Monthly summary data is unavailable: {dashboard.summaryWarning}
                </p>
              ) : null}
              {dashboard?.voucherWarning ? (
                <p
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  Recent voucher data is unavailable: {dashboard.voucherWarning}
                </p>
              ) : null}
              {realtimeError ? (
                <p
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  Live updates are unavailable: {realtimeError}
                </p>
              ) : null}

              {chartData.length > 0 ? (
                <>
                  <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-sm transition-all duration-300 hover:border-finora-gold/50 hover:shadow-gold-glow dark:border-finora-gold/20 dark:bg-finora-surface/70 dark:backdrop-blur-lg sm:p-6">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-[#F8F4E8]">
                      Sales vs Purchases & Expenses
                    </h2>
                    <SalesExpensesBarChart data={chartData} />
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-sm transition-all duration-300 hover:border-finora-gold/50 hover:shadow-gold-glow dark:border-finora-gold/20 dark:bg-finora-surface/70 dark:backdrop-blur-lg sm:p-6">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-[#F8F4E8]">
                      Net Profit Trend
                    </h2>
                    <NetProfitAreaChart data={chartData} />
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-sm transition-all duration-300 hover:border-finora-gold/50 hover:shadow-gold-glow dark:border-finora-gold/20 dark:bg-finora-surface/70 dark:backdrop-blur-lg sm:p-6">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-[#F8F4E8]">
                      GST Summary
                    </h2>
                    <GstSummaryBarChart data={chartData} />
                  </section>
                </>
              ) : null}

              {dashboard?.vouchers.length ? (
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm transition-all duration-300 hover:border-finora-gold/50 hover:shadow-gold-glow dark:border-finora-gold/20 dark:bg-finora-surface/70 dark:backdrop-blur-lg">
                  <div className="border-b border-slate-200 px-5 py-4 dark:border-finora-gold/20">
                    <h2 className="font-semibold text-slate-900 dark:text-[#F8F4E8]">
                      Recent vouchers
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Latest entries synchronized from TallyPrime
                    </p>
                  </div>
                  <div className="hidden w-full overflow-x-auto scrollbar-thin scrollbar-thumb-amber-500/20 sm:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white text-slate-600 dark:bg-finora-dark/50 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Voucher</th>
                          <th className="px-5 py-3 font-medium">Type</th>
                          <th className="px-5 py-3 font-medium">Party</th>
                          <th className="px-5 py-3 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.vouchers.map((voucher) => {
                          const finalAmount =
                            voucher.total_amount ?? voucher.amount ?? 0;
                          const voucherDate = voucher.date
                            ? new Date(`${voucher.date}T00:00:00Z`)
                            : null;
                          return (
                            <tr
                              key={voucher.id}
                              className="border-t border-slate-100 transition-colors hover:bg-finora-gold/5 dark:border-finora-gold/10 dark:hover:bg-finora-gold/5"
                            >
                              <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">
                                {voucherDate && !Number.isNaN(voucherDate.getTime())
                                  ? new Intl.DateTimeFormat("en-IN", {
                                      dateStyle: "medium",
                                      timeZone: "UTC",
                                    }).format(voucherDate)
                                  : "—"}
                              </td>
                              <td className="px-5 py-3 font-medium text-slate-900 dark:text-[#F8F4E8]">
                                {voucher.voucher_number || "—"}
                              </td>
                              <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">
                                {voucher.voucher_type}
                              </td>
                              <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                                {voucher.party_name || voucher.narration || "—"}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-slate-900 dark:text-[#F8F4E8]">
                                {formatCurrency(numericValue(finalAmount))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 p-3 sm:hidden">
                    {dashboard.vouchers.map((voucher) => {
                      const finalAmount =
                        voucher.total_amount ?? voucher.amount ?? 0;
                      const voucherDate = voucher.date
                        ? new Date(`${voucher.date}T00:00:00Z`)
                        : null;
                      return (
                        <article
                          key={voucher.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-finora-gold/15 dark:bg-finora-dark/50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                                {voucher.party_name || voucher.narration || "Voucher"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {voucher.voucher_number || "No voucher number"}
                                {voucherDate && !Number.isNaN(voucherDate.getTime())
                                  ? ` · ${new Intl.DateTimeFormat("en-IN", {
                                      dateStyle: "medium",
                                      timeZone: "UTC",
                                    }).format(voucherDate)}`
                                  : ""}
                              </p>
                            </div>
                            <p className="shrink-0 text-right font-semibold text-slate-900 dark:text-finora-gold-light">
                              {formatCurrency(numericValue(finalAmount))}
                            </p>
                          </div>
                          <span className="mt-3 inline-flex rounded-full bg-finora-gold/10 px-2.5 py-1 text-xs capitalize text-finora-gold-dark dark:text-finora-gold">
                            {voucher.voucher_type}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {chartData.length === 0 && !dashboard?.vouchers.length ? (
                <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
                  <EmptyStateGraphic
                    title="No Tally Sync Data Available Yet"
                    description="Your accountant has not run the Tally sync script for this company."
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
