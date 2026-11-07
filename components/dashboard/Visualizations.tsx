"use client";

import {
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

export type VoucherAnalyticsRow = {
  date?: string | null;
  voucher_date?: string | null;
  voucher_type?: string | null;
  party_name?: string | null;
  total_amount?: number | string | null;
  amount?: number | string | null;
  sales_amount?: number | string | null;
  purchase_amount?: number | string | null;
  expense_amount?: number | string | null;
};

export type MonthlyFinancialData = {
  period: string;
  sales: number;
  purchases: number;
  expenses: number;
  netProfit?: number;
};

type VoucherFinancialTotals = {
  sales: number;
  purchases: number;
  expenses: number;
  netProfit: number;
};

const chartTooltipStyle = {
  borderRadius: "0.75rem",
  border: "1px solid var(--chart-tooltip-border, #e2e8f0)",
  background: "var(--chart-tooltip-bg, #fff)",
  color: "var(--foreground, #0f172a)",
};

function numericValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function categoryAmounts(voucher: VoucherAnalyticsRow) {
  const type = (voucher.voucher_type ?? "").trim().toLowerCase();
  const total = numericValue(voucher.total_amount ?? voucher.amount);
  const sales = numericValue(voucher.sales_amount);
  const purchases = numericValue(voucher.purchase_amount);
  const expenses = numericValue(voucher.expense_amount);

  return {
    sales: sales || (type === "sales" ? total : 0),
    purchases: purchases || (type === "purchase" ? total : 0),
    expenses,
  };
}

export function aggregateVoucherTotals(
  vouchers: VoucherAnalyticsRow[],
): VoucherFinancialTotals {
  const totals = vouchers.reduce(
    (result, voucher) => {
      const amounts = categoryAmounts(voucher);
      return {
        sales: result.sales + amounts.sales,
        purchases: result.purchases + amounts.purchases,
        expenses: result.expenses + amounts.expenses,
      };
    },
    { sales: 0, purchases: 0, expenses: 0 },
  );
  return {
    ...totals,
    netProfit: totals.sales - totals.purchases - totals.expenses,
  };
}

export function aggregateVoucherMonths(
  vouchers: VoucherAnalyticsRow[],
): MonthlyFinancialData[] {
  const months = new Map<string, MonthlyFinancialData>();
  for (const voucher of vouchers) {
    const voucherDate = voucher.voucher_date ?? voucher.date;
    if (!voucherDate) continue;
    const period = voucherDate.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) continue;
    const amounts = categoryAmounts(voucher);
    const row = months.get(period) ?? {
      period,
      sales: 0,
      purchases: 0,
      expenses: 0,
    };
    row.sales += amounts.sales;
    row.purchases += amounts.purchases;
    row.expenses += amounts.expenses;
    months.set(period, row);
  }
  return [...months.values()].sort((left, right) =>
    left.period.localeCompare(right.period),
  );
}

type FinancialVisualizationsProps = {
  vouchers: VoucherAnalyticsRow[];
  monthlyData: MonthlyFinancialData[];
};

export function FinancialVisualizations({
  vouchers,
  monthlyData,
}: FinancialVisualizationsProps) {
  const totals = aggregateVoucherTotals(vouchers);
  const distribution = [
    { name: "Sales", value: totals.sales, color: "#E5C365" },
    { name: "Purchases", value: totals.purchases, color: "#10B981" },
    { name: "Expenses", value: totals.expenses, color: "#64748B" },
  ];
  const parties = [...vouchers.reduce((grouped, voucher) => {
    const party = voucher.party_name?.trim();
    if (!party) return grouped;
    const value = Math.abs(
      numericValue(voucher.total_amount ?? voucher.amount),
    );
    grouped.set(party, (grouped.get(party) ?? 0) + value);
    return grouped;
  }, new Map<string, number>()).entries()]
    .map(([party, amount]) => ({ party, amount }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 8);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-sm dark:border-finora-gold/20 dark:bg-finora-surface/70 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-[#F8F4E8]">
          Voucher Distribution
        </h2>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distribution}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={3}
              >
                {distribution.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(Number(value))
                }
                contentStyle={chartTooltipStyle}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-sm dark:border-finora-gold/20 dark:bg-finora-surface/70 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-[#F8F4E8]">
          Monthly Revenue &amp; Expenses
        </h2>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fill: "var(--foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--foreground)", fontSize: 11 }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#E5C365" radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" name="Purchases" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#64748B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 shadow-sm dark:border-finora-gold/20 dark:bg-finora-surface/70 sm:p-6 xl:col-span-2">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-[#F8F4E8]">
          Top Customers &amp; Vendors
        </h2>
        {parties.length ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={parties}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--foreground)", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="party"
                  width={120}
                  tick={{ fill: "var(--foreground)", fontSize: 11 }}
                />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="amount" name="Voucher Amount" fill="#E5C365" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Party details will appear when vouchers include customer or vendor names.
          </p>
        )}
      </section>
    </div>
  );
}
