export type FinancialVoucher = {
  id?: string;
  company_id?: string | null;
  voucher_number?: string | null;
  voucher_type?: string | null;
  voucher_date?: string | null;
  date?: string | null;
  party_name?: string | null;
  party_gstin?: string | null;
  gstin?: string | null;
  total_amount?: number | string | null;
  amount?: number | string | null;
  sales_amount?: number | string | null;
  purchase_amount?: number | string | null;
  expense_amount?: number | string | null;
  cgst_amount?: number | string | null;
  sgst_amount?: number | string | null;
  igst_amount?: number | string | null;
};

export type AnomalyFlag = {
  code:
    | "DUPLICATE_VOUCHER_NUMBER"
    | "HIGH_VALUE_B2B_MISSING_PARTY"
    | "STATISTICAL_AMOUNT_OUTLIER";
  message: string;
  companyId: string;
  voucherId?: string;
  voucherNumber?: string;
  amount?: number;
};

export type MonthlyFinancialMetric = {
  period: string;
  revenue: number;
  sales: number;
  purchases: number;
  expenses: number;
  netProfit: number;
  gstOutput: number;
  gstInput: number;
};

export type FinancialEngineResult = {
  monthly: MonthlyFinancialMetric[];
  monthlyRevenue: Map<string, number>;
  monthlyPurchases: Map<string, number>;
  monthlyExpenses: Map<string, number>;
  monthlyNetProfit: Map<string, number>;
  gstOutput: number;
  gstInput: number;
  netInflow: number;
  netOutflow: number;
  workingCapital: number;
  cashFlowVelocity: number;
  trendSlope: number;
  trends: { days: 30 | 60 | 90; netCashFlow: number }[];
  anomalies: AnomalyFlag[];
  flags: AnomalyFlag[];
  duplicateVoucherNumbers: string[];
  missingB2bPartyDetails: number;
  amountOutliers: number;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function periodFor(voucher: FinancialVoucher) {
  const raw = voucher.voucher_date ?? voucher.date ?? "";
  const date = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function voucherDate(voucher: FinancialVoucher) {
  const raw = voucher.voucher_date ?? voucher.date ?? "";
  const date = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateFinancialMetrics(
  vouchers: readonly FinancialVoucher[],
): FinancialEngineResult {
  const monthly = new Map<
    string,
    {
      revenue: number;
      sales: number;
      purchases: number;
      expenses: number;
      gstOutput: number;
      gstInput: number;
    }
  >();
  const duplicateCounts = new Map<string, number>();
  const duplicateLabels = new Map<string, string>();
  const companyStats = new Map<
    string,
    { count: number; mean: number; m2: number }
  >();
  const anomalies: AnomalyFlag[] = [];
  let netInflow = 0;
  let netOutflow = 0;
  let gstOutput = 0;
  let gstInput = 0;
  let missingB2bPartyDetails = 0;

  let latestDate: Date | null = null;
  const thirtyDayCutoff = new Date(0);
  const sixtyDayCutoff = new Date(0);
  const ninetyDayCutoff = new Date(0);
  const cashBuckets = new Map<30 | 60 | 90, number>([
    [30, 0],
    [60, 0],
    [90, 0],
  ]);

  for (const voucher of vouchers) {
    const companyId = voucher.company_id ?? "__active_company__";
    const type = (voucher.voucher_type ?? "").toLowerCase();
    const total = toNumber(voucher.total_amount ?? voucher.amount);
    const sales = toNumber(voucher.sales_amount) || (type === "sales" ? total : 0);
    const purchases =
      toNumber(voucher.purchase_amount) || (type === "purchase" ? total : 0);
    const expenses =
      toNumber(voucher.expense_amount) ||
      (type === "payment" ? total : type === "expense" ? total : 0);
    const outputTax =
      toNumber(voucher.cgst_amount) +
      toNumber(voucher.sgst_amount) +
      toNumber(voucher.igst_amount);

    const period = periodFor(voucher);
    const monthlyRow = monthly.get(period) ?? {
      revenue: 0,
      sales: 0,
      purchases: 0,
      expenses: 0,
      gstOutput: 0,
      gstInput: 0,
    };
    monthlyRow.sales += sales;
    monthlyRow.revenue += type === "sales" ? sales : 0;
    monthlyRow.purchases += purchases;
    monthlyRow.expenses += expenses;
    if (type === "sales") {
      monthlyRow.gstOutput += outputTax;
      gstOutput += outputTax;
    }
    if (type === "purchase") {
      monthlyRow.gstInput += outputTax;
      gstInput += outputTax;
    }
    monthly.set(period, monthlyRow);

    if (type === "sales" || type === "receipt") netInflow += total;
    if (type === "payment" || type === "purchase" || type === "expense") {
      netOutflow += type === "purchase" ? purchases : type === "expense" ? expenses : total;
    }

    const voucherNumber = voucher.voucher_number?.trim();
    if (voucherNumber) {
      const key = `${companyId}:${voucherNumber}`;
      const count = (duplicateCounts.get(key) ?? 0) + 1;
      duplicateCounts.set(key, count);
      duplicateLabels.set(key, voucherNumber);
      if (count === 2) {
        anomalies.push({
          code: "DUPLICATE_VOUCHER_NUMBER",
          message: `Voucher ${voucherNumber} appears more than once in this company.`,
          companyId,
          voucherId: voucher.id,
          voucherNumber,
        });
      }
    }

    if (
      type === "sales" &&
      total > 50000 &&
      (!voucher.party_name?.trim() ||
        (!voucher.party_gstin?.trim() && !voucher.gstin?.trim()))
    ) {
      missingB2bPartyDetails += 1;
      anomalies.push({
        code: "HIGH_VALUE_B2B_MISSING_PARTY",
        message: "A high-value B2B sale is missing party details.",
        companyId,
        voucherId: voucher.id,
        voucherNumber: voucherNumber ?? undefined,
        amount: total,
      });
    }

    const stats = companyStats.get(companyId) ?? { count: 0, mean: 0, m2: 0 };
    const nextCount = stats.count + 1;
    const delta = total - stats.mean;
    stats.mean += delta / nextCount;
    stats.m2 += delta * (total - stats.mean);
    stats.count = nextCount;
    companyStats.set(companyId, stats);

    const date = voucherDate(voucher);
    if (date && (!latestDate || date > latestDate)) latestDate = date;
  }

  if (latestDate) {
    thirtyDayCutoff.setTime(latestDate.getTime() - 30 * 86400000);
    sixtyDayCutoff.setTime(latestDate.getTime() - 60 * 86400000);
    ninetyDayCutoff.setTime(latestDate.getTime() - 90 * 86400000);
  }

  let amountOutliers = 0;
  for (const voucher of vouchers) {
    const companyId = voucher.company_id ?? "__active_company__";
    const total = toNumber(voucher.total_amount ?? voucher.amount);
    const stats = companyStats.get(companyId);
    if (!stats || stats.count < 2) continue;
    const variance = stats.m2 / stats.count;
    const deviation = Math.sqrt(variance);
    if (deviation > 0 && Math.abs(total - stats.mean) > 3 * deviation) {
      amountOutliers += 1;
      anomalies.push({
        code: "STATISTICAL_AMOUNT_OUTLIER",
        message: "Voucher amount is more than three standard deviations from the company mean.",
        companyId,
        voucherId: voucher.id,
        voucherNumber: voucher.voucher_number?.trim() || undefined,
        amount: total,
      });
    }

    const date = voucherDate(voucher);
    if (!latestDate || !date) continue;
    const type = (voucher.voucher_type ?? "").toLowerCase();
    const voucherInflow =
      type === "sales" || type === "receipt"
        ? toNumber(voucher.total_amount ?? voucher.amount)
        : 0;
    const voucherOutflow =
      type === "payment"
        ? toNumber(voucher.total_amount ?? voucher.amount)
        : type === "purchase"
          ? toNumber(voucher.purchase_amount) || toNumber(voucher.total_amount)
          : type === "expense"
            ? toNumber(voucher.expense_amount) || toNumber(voucher.total_amount)
            : 0;
    const net = voucherInflow - voucherOutflow;
    if (date >= ninetyDayCutoff) {
      cashBuckets.set(90, (cashBuckets.get(90) ?? 0) + net);
      if (date >= sixtyDayCutoff) {
        cashBuckets.set(60, (cashBuckets.get(60) ?? 0) + net);
        if (date >= thirtyDayCutoff) {
          cashBuckets.set(30, (cashBuckets.get(30) ?? 0) + net);
        }
      }
    }
  }

  const monthlyRows = [...monthly.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, values]) => ({
      period,
      revenue: values.revenue,
      sales: values.sales,
      purchases: values.purchases,
      expenses: values.expenses,
      netProfit: values.sales - values.purchases - values.expenses,
      gstOutput: values.gstOutput,
      gstInput: values.gstInput,
    }));

  const trends = ([30, 60, 90] as const).map((days) => ({
    days,
    netCashFlow: cashBuckets.get(days) ?? 0,
  }));
  const xMean = 60;
  const yMean =
    trends.reduce((sum, item) => sum + item.netCashFlow, 0) / trends.length;
  const trendSlope =
    trends.reduce((sum, item) => {
      const x = item.days;
      return sum + (x - xMean) * (item.netCashFlow - yMean);
    }, 0) /
    trends.reduce((sum, item) => sum + (item.days - xMean) ** 2, 0);

  const monthlyRevenue = new Map(
    monthlyRows.map((row) => [row.period, row.revenue]),
  );
  const monthlyPurchases = new Map(
    monthlyRows.map((row) => [row.period, row.purchases]),
  );
  const monthlyExpenses = new Map(
    monthlyRows.map((row) => [row.period, row.expenses]),
  );
  const monthlyNetProfit = new Map(
    monthlyRows.map((row) => [row.period, row.netProfit]),
  );
  const duplicateVoucherNumbers = [...duplicateLabels.entries()]
    .filter(([key]) => (duplicateCounts.get(key) ?? 0) > 1)
    .map(([, voucherNumber]) => voucherNumber);

  return {
    monthly: monthlyRows,
    monthlyRevenue,
    monthlyPurchases,
    monthlyExpenses,
    monthlyNetProfit,
    gstOutput,
    gstInput,
    netInflow,
    netOutflow,
    workingCapital: netInflow - netOutflow,
    cashFlowVelocity: netInflow - netOutflow,
    trendSlope,
    trends,
    anomalies,
    flags: anomalies,
    duplicateVoucherNumbers,
    missingB2bPartyDetails,
    amountOutliers,
  };
}

export const computeFinancialAnalytics = calculateFinancialMetrics;
export const computeFinancialEngine = calculateFinancialMetrics;
export const financialEngine = calculateFinancialMetrics;
