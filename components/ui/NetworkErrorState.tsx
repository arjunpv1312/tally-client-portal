"use client";

import { motion } from "framer-motion";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useState } from "react";

type NetworkErrorStateProps = {
  title?: string;
  explanation: string;
  onRetry: () => void | Promise<void>;
};

export function NetworkErrorState({
  title = "Data could not be loaded",
  explanation,
  onRetry,
}: NetworkErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <motion.section
      role="alert"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-lg dark:border-amber-900/60 dark:bg-amber-950/20"
    >
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
      >
        <WifiOff className="h-6 w-6" />
      </motion.div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-[#F8F4E8]">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
        {explanation}
      </p>
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={() => void retry()}
        disabled={retrying}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E5C365] px-4 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {retrying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {retrying ? "Retrying..." : "Try again"}
      </motion.button>
    </motion.section>
  );
}
