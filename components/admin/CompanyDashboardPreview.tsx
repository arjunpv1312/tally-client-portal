"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase";
import {
  aggregateVoucherMonths,
  FinancialVisualizations,
} from "@/components/dashboard/Visualizations";

type Summary = {
  period_start?: string;
  period_date?: string | null;
  month?: string | null;
  created_at?: string | null;
  total_sales: number | string | null;
  total_purchases: number | string | null;
  total_expenses: number | string | null;
  net_profit: number | string | null;
};

type Voucher = {
  id: string;
  date: string | null;
  voucher_date: string | null;
  voucher_number: string | null;
  voucher_type: string;
  party_name: string | null;
  total_amount: number | string | null;
  amount: number | string | null;
  sales_amount: number | string | null;
  purchase_amount: number | string | null;
  expense_amount: number | string | null;
};

type CompanyDashboardPreviewProps = {
  company: { id: string; name: string };
  onClose: () => void;
};

function amount(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CompanyDashboardPreview({
  company,
  onClose,
}: CompanyDashboardPreviewProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabase();

    async function load() {
      setLoading(true);
      setError("");
      const summaryQuery = (dateColumns: string, orderColumn: string) =>
        supabase
          .from("financial_summaries")
          .select(
            `id, company_id, ${dateColumns}, total_sales, total_purchases, total_expenses, net_profit`,
          )
          .eq("company_id", company.id)
          .order(orderColumn, { ascending: true })
          .returns<Summary[]>();
      const summaryPlans = [
        { dateColumns: "period_start, period_end", orderColumn: "period_start" },
        { dateColumns: "period_date, month", orderColumn: "period_date" },
        { dateColumns: "period_date", orderColumn: "period_date" },
        { dateColumns: "month", orderColumn: "month" },
        { dateColumns: "created_at", orderColumn: "created_at" },
      ];
      let summaryResult = await summaryQuery(
        summaryPlans[0].dateColumns,
        summaryPlans[0].orderColumn,
      );
      for (const plan of summaryPlans.slice(1)) {
        if (!summaryResult.error) break;
        summaryResult = await summaryQuery(plan.dateColumns, plan.orderColumn);
      }
      const voucherResult = await supabase
        .from("vouchers")
        .select("id, date, voucher_date, voucher_number, voucher_type, party_name, total_amount, amount, sales_amount, purchase_amount, expense_amount")
        .eq("company_id", company.id)
        .order("voucher_date", { ascending: false })
        .limit(1000)
        .returns<Voucher[]>();
      if (cancelled) return;
      if (voucherResult.error) {
        setError(
          voucherResult.error.message ??
            "Unable to load this company's dashboard.",
        );
      } else {
        setSummaries(
          (summaryResult.data ?? []).map((summary) => ({
            ...summary,
            period_start:
              summary.period_start ??
              summary.period_date ??
              summary.month ??
              summary.created_at?.slice(0, 10) ??
              "",
          })),
        );
        setVouchers(voucherResult.data ?? []);
      }
      setLoading(false);
    }

    void load().catch((loadError: unknown) => {
      if (cancelled) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this company's dashboard.",
      );
      setLoading(false);
    });

    const channel = supabase
      .channel(`admin-company-preview-${company.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_summaries",
          filter: `company_id=eq.${company.id}`,
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vouchers",
          filter: `company_id=eq.${company.id}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [company.id]);

  const monthlyData = useMemo(
    () => {
      const summaryMonths = new Set(
        summaries
          .map((summary) => summary.period_start?.slice(0, 7) ?? "")
          .filter(Boolean),
      );
      const summaryData = summaries.map((summary) => ({
        period: summary.period_start?.slice(0, 7) ?? "",
        sales: amount(summary.total_sales),
        purchases: amount(summary.total_purchases),
        expenses: amount(summary.total_expenses),
        netProfit: amount(summary.net_profit),
      }));
      const voucherFallback = aggregateVoucherMonths(vouchers)
        .filter((month) => !summaryMonths.has(month.period))
        .map((month) => ({
          ...month,
          netProfit: month.sales - month.purchases - month.expenses,
        }));
      return [...summaryData, ...voucherFallback]
        .filter((summary) => summary.period)
        .sort((left, right) => left.period.localeCompare(right.period));
    },
    [summaries, vouchers],
  );
  const totals = useMemo(
    () =>
      monthlyData.reduce(
        (result, month) => ({
          sales: result.sales + month.sales,
          purchases: result.purchases + month.purchases,
          expenses: result.expenses + month.expenses,
          netProfit: result.netProfit + (month.netProfit ?? 0),
        }),
        { sales: 0, purchases: 0, expenses: 0, netProfit: 0 },
      ),
    [monthlyData],
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-preview-title"
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0F172A]/95 p-4 text-slate-100 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Live company preview
            </p>
            <h2 id="company-preview-title" className="mt-1 text-xl font-semibold sm:text-2xl">
              {company.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close company dashboard preview"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading company financials…
          </div>
        ) : error ? (
          <p role="alert" className="mt-6 rounded-xl border border-rose-400/30 bg-rose-950/40 p-4 text-sm text-rose-200">
            {error}
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Total Sales", totals.sales],
                ["Purchases", totals.purchases],
                ["Expenses", totals.expenses],
                ["Net Profit", totals.netProfit],
              ].map(([label, value]) => (
                <article key={String(label)} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-amber-200">
                    {currency(Number(value))}
                  </p>
                </article>
              ))}
            </div>

            {monthlyData.length || vouchers.length ? (
              <FinancialVisualizations
                vouchers={vouchers}
                monthlyData={monthlyData}
              />
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                No financial summaries or vouchers have been synced for this company yet.
              </p>
            )}

            <section className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <h3 className="border-b border-white/10 px-4 py-3 font-semibold">
                Recent vouchers
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Voucher</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Party</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.slice(0, 10).map((voucher) => (
                      <tr key={voucher.id} className="border-t border-white/10">
                        <td className="px-4 py-3">{voucher.date ?? voucher.voucher_date ?? "—"}</td>
                        <td className="px-4 py-3">{voucher.voucher_number ?? "—"}</td>
                        <td className="px-4 py-3 capitalize">{voucher.voucher_type}</td>
                        <td className="px-4 py-3">{voucher.party_name ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {currency(amount(voucher.total_amount ?? voucher.amount))}
                        </td>
                      </tr>
                    ))}
                    {vouchers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No vouchers have been synced yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
