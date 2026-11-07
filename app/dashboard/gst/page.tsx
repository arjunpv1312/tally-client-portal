"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import {
  DateFilter,
  getInitialDateRange,
  type DateRange,
} from "@/components/dashboard/DateFilter";
import { DashboardContentSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { getSupabase } from "@/lib/supabase";

type GstVoucher = {
  id: string;
  voucher_date: string;
  voucher_type: string;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  igst_amount: number | string | null;
};

type MonthTotals = {
  month: string;
  outputCgst: number;
  outputSgst: number;
  outputIgst: number;
  inputCgst: number;
  inputSgst: number;
  inputIgst: number;
};

function numericValue(value: number | string | null) {
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

function formatMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, value - 1, 1));
}

export default function GstReportPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange);
  const [months, setMonths] = useState<MonthTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const supabase = getSupabase();
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError) throw new Error(userError.message);
        if (!userData.user) throw new Error("Your session has expired.");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", userData.user.id)
          .returns<{ company_id: string | null }[]>()
          .maybeSingle();
        if (profileError) throw new Error(profileError.message);
        if (!profile?.company_id) {
          throw new Error("No client company is linked to this account.");
        }

        const { data, error: voucherError } = await supabase
          .from("vouchers")
          .select(
            "id, voucher_date, voucher_type, cgst_amount, sgst_amount, igst_amount",
          )
          .eq("company_id", profile.company_id)
          .gte("voucher_date", dateRange.startDate)
          .lte("voucher_date", dateRange.endDate)
          .order("voucher_date", { ascending: true })
          .limit(5000)
          .returns<GstVoucher[]>();
        if (voucherError) throw new Error(voucherError.message);

        const grouped = new Map<string, MonthTotals>();
        for (const voucher of data ?? []) {
          const month = voucher.voucher_date.slice(0, 7);
          const current = grouped.get(month) ?? {
            month,
            outputCgst: 0,
            outputSgst: 0,
            outputIgst: 0,
            inputCgst: 0,
            inputSgst: 0,
            inputIgst: 0,
          };
          const isSales = voucher.voucher_type === "sales";
          const isPurchase = voucher.voucher_type === "purchase";
          if (isSales) {
            current.outputCgst += numericValue(voucher.cgst_amount);
            current.outputSgst += numericValue(voucher.sgst_amount);
            current.outputIgst += numericValue(voucher.igst_amount);
          } else if (isPurchase) {
            current.inputCgst += numericValue(voucher.cgst_amount);
            current.inputSgst += numericValue(voucher.sgst_amount);
            current.inputIgst += numericValue(voucher.igst_amount);
          }
          grouped.set(month, current);
        }
        if (!cancelled) {
          setMonths([...grouped.values()]);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load GST data.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [dateRange.endDate, dateRange.startDate]);

  const totals = useMemo(
    () =>
      months.reduce(
        (result, month) => ({
          outputCgst: result.outputCgst + month.outputCgst,
          outputSgst: result.outputSgst + month.outputSgst,
          outputIgst: result.outputIgst + month.outputIgst,
          inputCgst: result.inputCgst + month.inputCgst,
          inputSgst: result.inputSgst + month.inputSgst,
          inputIgst: result.inputIgst + month.inputIgst,
        }),
        {
          outputCgst: 0,
          outputSgst: 0,
          outputIgst: 0,
          inputCgst: 0,
          inputSgst: 0,
          inputIgst: 0,
        },
      ),
    [months],
  );
  const outputTax = totals.outputCgst + totals.outputSgst + totals.outputIgst;
  const inputTax = totals.inputCgst + totals.inputSgst + totals.inputIgst;
  const netPayable = outputTax - inputTax;
  const maxMonthlyLiability = useMemo(
    () =>
      Math.max(
        1,
        ...months.map(
          (month) =>
            month.outputCgst +
            month.outputSgst +
            month.outputIgst -
            month.inputCgst -
            month.inputSgst -
            month.inputIgst,
        ),
      ),
    [months],
  );

  const exportRows = useMemo(
    () =>
      months.map((month) => ({
        Month: formatMonth(month.month),
        "Output CGST": month.outputCgst,
        "Output SGST": month.outputSgst,
        "Output IGST": month.outputIgst,
        "Input CGST": month.inputCgst,
        "Input SGST": month.inputSgst,
        "Input IGST": month.inputIgst,
        "Net Payable":
          month.outputCgst +
          month.outputSgst +
          month.outputIgst -
          month.inputCgst -
          month.inputSgst -
          month.inputIgst,
      })),
    [months],
  );

  return (
    <AuthGuard allow="company">
      <div className="min-h-screen bg-white dark:bg-transparent">
        <AppHeader
          title="GST Reports"
          subtitle="Output tax, input tax, and monthly liabilities"
          roleLabel="Client"
          navItems={[
            { label: "Overview", href: "/dashboard" },
            { label: "GST Reports", href: "/dashboard/gst" },
          ]}
        />
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"
        >
          <DateFilter onChange={setDateRange} />
          {loading ? (
            <DashboardContentSkeleton />
          ) : error ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {dateRange.startDate} through {dateRange.endDate}
                </p>
                <ExportButtons
                  reportTitle="GST summary"
                  filename="finora-gst-summary"
                  rows={exportRows}
                />
              </div>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Output GST (Sales)", outputTax],
                  ["Input GST (Purchases)", inputTax],
                  ["Net Payable", netPayable],
                ].map(([label, value]) => (
                  <article
                    key={String(label)}
                    className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]"
                  >
                    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {currency(Number(value))}
                    </p>
                  </article>
                ))}
              </section>

              <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 dark:border-[#334155] dark:bg-[#1E293B]">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  Tax component breakdown
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {[
                    ["CGST", totals.outputCgst, totals.inputCgst],
                    ["SGST", totals.outputSgst, totals.inputSgst],
                    ["IGST", totals.outputIgst, totals.inputIgst],
                  ].map(([tax, output, input]) => (
                    <div key={String(tax)} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="font-medium">{tax}</h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Output: {currency(Number(output))}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Input: {currency(Number(input))}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 dark:border-[#334155] dark:bg-[#1E293B]">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  Monthly net tax liability
                </h2>
                {months.length ? (
                  <div className="mt-4 space-y-4">
                    {months.map((month) => {
                      const liability =
                        month.outputCgst +
                        month.outputSgst +
                        month.outputIgst -
                        month.inputCgst -
                        month.inputSgst -
                        month.inputIgst;
                      const width = Math.min(
                        100,
                        (Math.max(0, liability) / maxMonthlyLiability) * 100,
                      );
                      return (
                        <div key={month.month}>
                          <div className="mb-1 flex justify-between gap-3 text-sm">
                            <span>{formatMonth(month.month)}</span>
                            <span className="font-medium">{currency(liability)}</span>
                          </div>
                          <div
                            className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                            role="meter"
                            aria-label={`${formatMonth(month.month)} net GST liability`}
                            aria-valuemin={0}
                            aria-valuemax={maxMonthlyLiability}
                            aria-valuenow={Math.max(0, liability)}
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-amber-400 transition-all"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    No sales or purchase GST vouchers were found for this range.
                  </p>
                )}
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Net payable is output GST minus input GST; negative amounts represent input credit.
                  Verify calculations against your accounting records before statutory filing.
                </p>
              </section>
            </>
          )}
        </motion.main>
      </div>
    </AuthGuard>
  );
}
