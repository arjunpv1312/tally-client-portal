"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type RealtimeStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CHANNEL_ERROR"
  | "CONNECTING";

type NetworkStatusPillProps = {
  lastSyncedAt?: string | null;
  voucherCount?: number;
  realtimeStatus?: RealtimeStatus;
  fetchLatencyMs?: number;
  syncing?: boolean;
};

function formatTimestamp(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function NetworkStatusPill({
  lastSyncedAt,
  voucherCount = 0,
  realtimeStatus = "CONNECTING",
  fetchLatencyMs = 0,
  syncing = false,
}: NetworkStatusPillProps) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const reconnecting =
    !online ||
    realtimeStatus === "TIMED_OUT" ||
    realtimeStatus === "CHANNEL_ERROR";
  const slow = syncing || fetchLatencyMs > 800;

  return (
    <>
      {slow ? (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-[#E5C365]/20"
        >
          <motion.div
            className="h-full w-1/3 bg-[#E5C365] shadow-[0_0_10px_rgba(229,195,101,0.75)]"
            animate={{ x: ["-100%", "400%"] }}
            transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      ) : null}
      <span
        role="status"
        className={
          reconnecting
            ? "inline-flex min-h-9 items-center rounded-full border border-amber-300/70 bg-amber-50 px-3 text-xs font-medium text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300"
            : slow
              ? "inline-flex min-h-9 items-center rounded-full border border-[#E5C365]/50 bg-[#E5C365]/10 px-3 text-xs font-medium text-amber-900 dark:text-[#E5C365]"
              : "inline-flex min-h-9 items-center rounded-full border border-emerald-300/60 bg-emerald-50 px-3 text-xs font-medium text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
        }
      >
        {reconnecting ? (
          <motion.span
            aria-hidden="true"
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.12, 0.9] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="mr-2 h-2 w-2 rounded-full bg-amber-500"
          />
        ) : (
          <motion.span
            aria-hidden="true"
            animate={slow ? { opacity: [0.45, 1, 0.45] } : { opacity: 1 }}
            transition={{ duration: 1.1, repeat: slow ? Infinity : 0 }}
            className={
              slow
                ? "mr-2 h-2 w-2 rounded-full bg-[#E5C365]"
                : "mr-2 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]"
            }
          />
        )}
        {reconnecting
          ? "Reconnecting"
          : slow
            ? "Syncing"
            : voucherCount > 0
              ? `Last Synced${formatTimestamp(lastSyncedAt) ? ` • ${formatTimestamp(lastSyncedAt)}` : ""}`
              : "No vouchers synced"}
      </span>
    </>
  );
}
