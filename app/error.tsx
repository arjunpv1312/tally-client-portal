"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    document.title = "Something went wrong | Tally Client Portal";
  }, [error]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-white px-6 py-16 dark:bg-[#0F172A]">
      <motion.section
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-[#F8FAFC] p-8 text-center shadow-sm dark:border-[#334155] dark:bg-[#1E293B] sm:p-12"
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.6, repeat: 2, repeatDelay: 1 }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300"
        >
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </motion.div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          We hit an unexpected issue
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Your work is safe. Try loading this view again, or return to the
          dashboard if the problem continues.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => retry()}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-[#60A5FA] dark:text-slate-950 dark:hover:bg-blue-300"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </button>
      </motion.section>
    </main>
  );
}
