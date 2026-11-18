"use client";

import { CheckCircle2, Clock } from "lucide-react";

type SyncStatusPillProps = {
  timestamp: string | null;
};

export function SyncStatusPill({ timestamp }: SyncStatusPillProps) {
  const parsed = timestamp ? new Date(timestamp) : null;
  const isValid = parsed !== null && !Number.isNaN(parsed.getTime());

  const formatted = isValid
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed)
    : null;

  return (
    <div
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        formatted
          ? "border-[#E5C365]/35 bg-[#E5C365]/10 text-[#9E7C28] dark:border-[#E5C365]/30 dark:bg-[#111722] dark:text-[#F5E4AA]"
          : "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-[#111722] dark:text-slate-400"
      }`}
    >
      {formatted ? (
        <CheckCircle2
          className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      )}
      <span className="whitespace-nowrap">
        {formatted ? (
          <>
            Verified via Tally Sync · Updated{" "}
            <span className="font-mono tabular-nums">{formatted}</span>
          </>
        ) : (
          "Awaiting First Tally Sync"
        )}
      </span>
    </div>
  );
}
