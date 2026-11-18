"use client";

type SyncStatusPillProps = {
  lastVerifiedAt?: string | null;
  voucherCount?: number;
};

function formatVerifiedTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SyncStatusPill({
  lastVerifiedAt,
  voucherCount = 0,
}: SyncStatusPillProps) {
  if (voucherCount === 0) {
    return (
      <span
        role="status"
        className="inline-flex min-h-9 items-center rounded-full border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
      >
        No vouchers synced yet
      </span>
    );
  }

  const timestamp = formatVerifiedTimestamp(lastVerifiedAt);
  return (
    <span
      role="status"
      className="inline-flex min-h-9 items-center rounded-full border border-emerald-300/60 bg-emerald-50 px-3 text-xs font-medium text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
    >
      <span
        aria-hidden="true"
        className="mr-2 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]"
      />
      Verified via Tally Sync{timestamp ? ` • Updated ${timestamp}` : ""}
    </span>
  );
}