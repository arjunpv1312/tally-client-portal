"use client";

import { motion } from "framer-motion";
import { DashboardLoadingSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <main
      className="min-h-screen bg-white px-6 py-8 dark:bg-[#0F172A]"
      aria-label="Loading page"
      aria-busy="true"
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <motion.div
          className="h-12 w-56 rounded-xl border border-slate-200/70 bg-slate-100/60 shadow-sm backdrop-blur-sm dark:border-[#334155] dark:bg-[#1E293B]/70"
          animate={{ opacity: [0.55, 0.95, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <DashboardLoadingSkeleton />
      </div>
    </main>
  );
}
