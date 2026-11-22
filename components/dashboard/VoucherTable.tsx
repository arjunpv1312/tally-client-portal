"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";

export type DashboardVoucher = {
  id: string;
  date: string | null;
  voucher_date?: string | null;
  voucher_number: string | null;
  voucher_type: string;
  party_name: string | null;
  narration: string | null;
  total_amount: number | string | null;
  amount: number | string | null;
};

type VoucherTableProps = {
  vouchers: DashboardVoucher[];
};

function currency(value: number | string | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
}

export function VoucherTable({ vouchers }: VoucherTableProps) {
  const [query, setQuery] = useState("");
  const [compact, setCompact] = useState(false);
  const [voucherType, setVoucherType] = useState("all");
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [page, setPage] = useState(1);
  const filteredVouchers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches: DashboardVoucher[] = [];
    for (const voucher of vouchers) {
      if (voucherType !== "all" && voucher.voucher_type !== voucherType) continue;
      if (
        normalizedQuery &&
        !`${voucher.voucher_number ?? ""} ${voucher.party_name ?? ""} ${
          voucher.narration ?? ""
        }`
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        continue;
      }
      matches.push(voucher);
    }
    return matches;
  }, [query, voucherType, vouchers]);
  const totalPages = Math.max(1, Math.ceil(filteredVouchers.length / pageSize));
  const pageWindow = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredVouchers.slice(start, start + pageSize);
  }, [filteredVouchers, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [query, voucherType, pageSize]);
  const cellPadding = compact ? "py-1.5" : "py-3";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-white/[0.08] dark:bg-[#111722]">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-[#F8F4E8]">
            Recent vouchers
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Latest entries synchronized from TallyPrime
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Voucher or party"
              aria-label="Filter by voucher number or party name"
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#E5C365] focus:ring-2 focus:ring-[#E5C365]/20 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <select
            value={voucherType}
            onChange={(event) => setVoucherType(event.target.value)}
            aria-label="Filter voucher type"
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">All types</option>
            <option value="sales">Sales</option>
            <option value="purchase">Purchase</option>
            <option value="receipt">Receipt</option>
            <option value="payment">Payment</option>
          </select>
          <select
            value={pageSize}
            onChange={(event) =>
              setPageSize(Number(event.target.value) as 25 | 50 | 100)
            }
            aria-label="Rows per page"
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
          <div
            className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10"
            aria-label="Voucher table density"
          >
            <button
              type="button"
              aria-pressed={compact}
              onClick={() => setCompact(true)}
              className="relative min-h-9 rounded-md px-2.5 text-xs font-medium transition active:scale-[0.98]"
            >
              {compact ? (
                <motion.span
                  layoutId="voucher-density-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-md bg-[#E5C365]"
                />
              ) : null}
              <span className="relative z-10" aria-hidden={false}>Compact</span>
            </button>
            <button
              type="button"
              aria-pressed={!compact}
              onClick={() => setCompact(false)}
              className="relative min-h-9 rounded-md px-2.5 text-xs font-medium transition active:scale-[0.98]"
            >
              {!compact ? (
                <motion.span
                  layoutId="voucher-density-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-md bg-[#E5C365]"
                />
              ) : null}
              <span className="relative z-10">Comfortable</span>
            </button>
          </div>
        </div>
      </div>
      {filteredVouchers.length ? (
        <>
          <div className="hidden w-full overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-600 dark:bg-white/[0.02] dark:text-slate-400">
                <tr>
                  <th className={`px-5 ${cellPadding} font-medium`}>Date</th>
                  <th className={`px-5 ${cellPadding} font-medium`}>Voucher</th>
                  <th className={`px-5 ${cellPadding} font-medium`}>Type</th>
                  <th className={`px-5 ${cellPadding} font-medium`}>Party</th>
                  <th className={`px-5 ${cellPadding} text-right font-medium`}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageWindow.map((voucher) => (
                  <tr
                    key={voucher.id}
                    className="dashboard-voucher-row border-t border-slate-100 transition-colors hover:bg-finora-gold/5 dark:border-white/[0.06] dark:hover:bg-finora-gold/5"
                  >
                    <td className={`whitespace-nowrap px-5 ${cellPadding} text-slate-600 dark:text-slate-300`}>
                      {displayDate(voucher.date ?? voucher.voucher_date)}
                    </td>
                    <td className={`px-5 ${cellPadding} font-medium text-slate-900 dark:text-[#F8F4E8]`}>
                      {voucher.voucher_number || "—"}
                    </td>
                    <td className={`px-5 ${cellPadding} capitalize text-slate-600 dark:text-slate-300`}>
                      {voucher.voucher_type}
                    </td>
                    <td className={`px-5 ${cellPadding} text-slate-600 dark:text-slate-300`}>
                      {voucher.party_name || voucher.narration || "—"}
                    </td>
                    <td className={`whitespace-nowrap px-5 ${cellPadding} text-right font-mono font-medium tabular-nums text-slate-900 dark:text-[#F8F4E8]`}>
                      {currency(voucher.total_amount ?? voucher.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-3 sm:hidden">
            {pageWindow.map((voucher) => (
              <article
                key={voucher.id}
                className={`dashboard-voucher-row rounded-xl border border-slate-200 bg-white px-4 ${compact ? "py-2" : "py-4"} dark:border-white/10 dark:bg-slate-900`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {voucher.party_name || voucher.narration || "Voucher"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {voucher.voucher_number || "No voucher number"}
                      {" · "}
                      {displayDate(voucher.date ?? voucher.voucher_date)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-finora-gold-light">
                    {currency(voucher.total_amount ?? voucher.amount)}
                  </p>
                </div>
                <span className="mt-3 inline-flex rounded-full bg-finora-gold/10 px-2.5 py-1 text-xs capitalize text-finora-gold-dark dark:text-finora-gold">
                  {voucher.voucher_type}
                </span>
              </article>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
            <span>
              {filteredVouchers.length
                ? `${(Math.min(page, totalPages) - 1) * pageSize + 1}-${Math.min(
                    Math.min(page, totalPages) * pageSize,
                    filteredVouchers.length,
                  )} of ${filteredVouchers.length}`
                : "0 rows"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
              >
                Previous
              </button>
              <span className="tabular-nums">
                {Math.min(page, totalPages)} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {vouchers.length
            ? "No vouchers match this filter."
            : "No vouchers are available for this period."}
        </p>
      )}
    </section>
  );
}
