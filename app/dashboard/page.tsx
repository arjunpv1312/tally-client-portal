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
} from "@/components/FinancialCharts";
import {
  aggregateVoucherMonths,
  FinancialVisualizations,
  type MonthlyFinancialData,
} from "@/components/dashboard/Visualizations";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SyncStatusPill } from "@/components/dashboard/SyncStatusPill";
import { VoucherTable } from "@/components/dashboard/VoucherTable";
import { EmptyStateGraphic } from "@/components/ui/EmptyStateGraphic";
import {
  DateFilter,
  getInitialDateRange,
  type DateRange,
} from "@/components/dashboard/DateFilter";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { getBrowserSupabase, getSupabase } from "@/lib/supabase";

type SummaryRow = {
  id?: string;
  company_id?: string;
  period_start?: string;
  period_end?: string;
  period_date?: string | null;
  month?: string | null;
  created_at?: string | null;
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
  sales_amount?: number | string | null;
  purchase_amount?: number | string | null;
  expense_amount?: number | string | null;
  voucher_date?: string | null;
  updated_at?: string | null;
};

type DashboardData = {
  companyId: string;
  companyName: string;
  profileName: string | null;
  summaries: (SummaryRow & { period_start: string })[];
  vouchers: VoucherRow[];
  summaryWarning: string | null;
  voucherWarning: string | null;
};

function numericValue(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
    .returns<{ company_id: string | null; full_name: string | null }[]>()
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
      .returns<{ name: string }[]>()
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
          sales_amount?: number | string | null;
          purchase_amount?: number | string | null;
          expense_amount?: number | string | null;
          party_name?: string | null;
          voucher_type?: string | null;
          date?: string | null;
          voucher_date?: string | null;
          narration?: string | null;
          voucher_number?: string | null;
          updated_at?: string | null;
        }[]
      >();
  };
  const voucherVariants = [
    {
      columns:
        "id, total_amount, amount, sales_amount, purchase_amount, expense_amount, party_name, voucher_type, date, voucher_date, voucher_number, narration, updated_at",
      orderColumn: "date",
      dateColumn: "voucher_date",
    },
    {
      columns:
        "id, total_amount, amount, sales_amount, purchase_amount, expense_amount, party_name, voucher_type, date, voucher_date, voucher_number, narration",
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
          sales_amount: voucher.sales_amount ?? null,
          purchase_amount: voucher.purchase_amount ?? null,
          expense_amount: voucher.expense_amount ?? null,
          updated_at: voucher.updated_at ?? null,
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
  const summaryQuery = (
    columns: string,
    periodColumn: string,
    includesPeriodEnd: boolean,
  ) => {
    let query = supabase
      .from("financial_summaries")
      .select(columns)
      .eq("company_id", profile.company_id);
    if (includesPeriodEnd) {
      query = query.gte("period_end", startDate).lte("period_start", endDate);
    } else if (periodColumn === "month") {
      query = query
        .gte("month", startDate.slice(0, 7))
        .lte("month", endDate.slice(0, 7));
    } else {
      query = query.gte(periodColumn, startDate).lte(periodColumn, endDate);
    }
    return query
      .order(periodColumn, { ascending: true })
      .returns<SummaryRow[]>();
  };
  const metricColumnSets = [
    "cash_in_hand, bank_balance, updated_at, gst_payable, gst_input, cgst_payable, sgst_payable, igst_payable, last_synced_at",
    "updated_at, gst_payable, gst_input, cgst_payable, sgst_payable, igst_payable, last_synced_at",
    "gst_payable, gst_input, cgst_payable, sgst_payable, igst_payable, last_synced_at",
    "gst_payable, gst_input, last_synced_at",
    "cgst_payable, sgst_payable, igst_payable, last_synced_at",
    "cgst_amount, sgst_amount, igst_amount, last_synced_at",
    "last_synced_at",
    "",
  ];
  const summaryQueryPlans = [
    ...metricColumnSets.map((metrics) => ({
      periodColumn: "period_start",
      includesPeriodEnd: true,
      dateColumns: "period_start, period_end",
      metrics,
    })),
    ...[
      { periodColumn: "period_date", dateColumns: "period_date, month" },
      { periodColumn: "period_date", dateColumns: "period_date" },
      { periodColumn: "month", dateColumns: "month" },
      { periodColumn: "created_at", dateColumns: "created_at" },
    ].flatMap(({ periodColumn, dateColumns }) =>
      metricColumnSets.map((metrics) => ({
        periodColumn,
        includesPeriodEnd: false,
        dateColumns,
        metrics,
      })),
    ),
  ];
  let summaries: SummaryRow[] = [];
  let summaryWarning: string | null = null;
  for (const plan of summaryQueryPlans) {
    try {
      const columns = [
        "id",
        "company_id",
        plan.dateColumns,
        "total_sales",
        "total_purchases",
        "total_expenses",
        "net_profit",
        plan.metrics,
      ]
        .filter(Boolean)
        .join(", ");
      const result = await summaryQuery(
        columns,
        plan.periodColumn,
        plan.includesPeriodEnd,
      );
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
    const period_start =
      summary.period_start ??
      summary.period_date ??
      summary.month ??
      summary.created_at?.slice(0, 10) ??
      "";
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

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setLoading(true);
    setError("");
    setDateRange(range);
  }, []);

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

  const chartData = useMemo(
    () => {
      const summaries = dashboard?.summaries ?? [];
      const summaryRows = summaries.map((summary) => ({
        month: summary.period_start.slice(0, 7),
        period: formatPeriod(summary.period_start),
        sales: numericValue(summary.total_sales),
        purchases: numericValue(summary.total_purchases),
        totalExpenses: numericValue(summary.total_expenses),
        expenses:
          numericValue(summary.total_purchases) +
          numericValue(summary.total_expenses),
        net_profit: numericValue(summary.net_profit),
        gst_payable: numericValue(summary.gst_payable),
        gst_input: numericValue(summary.gst_input),
      }));
      const existingMonths = new Set(summaryRows.map((row) => row.month));
      const voucherRows = aggregateVoucherMonths(dashboard?.vouchers ?? [])
        .filter((month) => !existingMonths.has(month.period))
        .map((month) => ({
          month: month.period,
          period: formatPeriod(month.period),
          sales: month.sales,
          purchases: month.purchases,
          totalExpenses: month.expenses,
          expenses: month.purchases + month.expenses,
          net_profit: month.sales - month.purchases - month.expenses,
          gst_payable: 0,
          gst_input: 0,
        }));
      return [...summaryRows, ...voucherRows].sort((left, right) =>
        left.month.localeCompare(right.month),
      );
    },
    [dashboard?.summaries, dashboard?.vouchers],
  );
  const latest = chartData.at(-1);
  const lastSyncedAt = useMemo(() => {
    const candidates = [
      ...(dashboard?.summaries ?? []).map(
        (summary) => summary.updated_at ?? summary.last_synced_at ?? null,
      ),
      ...(dashboard?.vouchers ?? []).map((voucher) => voucher.updated_at ?? null),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ value, time: Date.parse(value) }))
      .filter((item) => !Number.isNaN(item.time));
    if (candidates.length === 0) return null;
    candidates.sort((left, right) => right.time - left.time);
    return candidates[0].value;
  }, [dashboard?.summaries, dashboard?.vouchers]);
  const metricCards = useMemo(() => {
    const latestChartData = chartData.at(-1);
    if (!latestChartData) return [];
    return [
      {
        label: `Sales · ${latestChartData.period}`,
        value: latestChartData.sales,
      },
      {
        label: `Purchases · ${latestChartData.period}`,
        value: latestChartData.purchases,
      },
      {
        label: `Expenses · ${latestChartData.period}`,
        value: latestChartData.totalExpenses,
      },
      {
        label: `Net profit · ${latestChartData.period}`,
        value: latestChartData.net_profit,
      },
    ];
  }, [chartData]);
  const monthlyFinancialData = useMemo<MonthlyFinancialData[]>(
    () =>
      chartData.map((row) => ({
        period: row.period,
        sales: row.sales,
        purchases: row.purchases,
        expenses: row.totalExpenses,
      })),
    [chartData],
  );
  const voucherExportRows = useMemo(
    () =>
      (dashboard?.vouchers ?? []).map((voucher) => ({
        Date: voucher.date ?? voucher.voucher_date ?? "",
        Voucher: voucher.voucher_number ?? "",
        Type: voucher.voucher_type,
        Party: voucher.party_name ?? voucher.narration ?? "",
        Amount: numericValue(
          voucher.total_amount ?? voucher.amount ?? 0,
        ),
      })),
    [dashboard?.vouchers],
  );

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
          }, 1500);
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
          }, 1500);
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
          contextControl={<SyncStatusPill timestamp={lastSyncedAt} />}
          navItems={[
            { label: "Overview", href: "/dashboard" },
            { label: "GST Reports", href: "/dashboard/gst" },
          ]}
        />
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="mx-auto max-w-6xl space-y-8 px-4 py-6 transform-gpu will-change-transform sm:px-6 lg:px-8"
        >
          <DateFilter onChange={handleDateRangeChange} />
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
                className="mt-4 rounded-xl bg-[#E5C365] px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-[#F5E4AA]"
              >
                Retry
              </button>
            </section>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Showing {dateRange.startDate} through {dateRange.endDate}
                  </p>
                  <div className="sm:hidden">
                    <SyncStatusPill timestamp={lastSyncedAt} />
                  </div>
                </div>
                <ExportButtons
                  reportTitle="Recent vouchers"
                  filename="finora-vouchers"
                  rows={voucherExportRows}
                />
              </div>
              {latest ? (
                <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {metricCards.map((stat, index) => (
                    <MetricCard
                      key={stat.label}
                      label={stat.label}
                      value={stat.value}
                      delay={index * 0.04}
                    />
                  ))}
                </div>
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

              {chartData.length > 0 || dashboard?.vouchers.length ? (
                <>
                  <FinancialVisualizations
                    vouchers={dashboard?.vouchers ?? []}
                    monthlyData={monthlyFinancialData}
                  />
                  {chartData.length ? (
                    <>
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
                </>
              ) : null}

              {dashboard?.vouchers.length || chartData.length > 0 ? (
                <VoucherTable vouchers={dashboard?.vouchers ?? []} />
              ) : null}

              {chartData.length === 0 && !dashboard?.vouchers.length ? (
                <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-white/[0.08] dark:bg-[#111722]">
                  <EmptyStateGraphic
                    title="No Tally Sync Data Available Yet"
                    description="Your accountant has not run the Tally sync script for this company."
                  />
                </section>
              ) : null}

              {chartData.length === 0 && dashboard?.vouchers.length ? (
                <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-white/[0.08] dark:bg-[#111722]">
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
