"use client";

import { motion } from "framer-motion";

export function SpinnerRing({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative inline-flex h-10 w-10 items-center justify-center ${className}`}
      role="status"
      aria-label="Loading"
    >
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700"
      />
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 dark:border-t-sky-400"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

export function GlassSkeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`overflow-hidden rounded-xl border border-slate-200/60 bg-slate-100/50 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/40 ${className}`}
      initial={{ opacity: 0.6 }}
      animate={{ opacity: [0.55, 0.95, 0.55] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-slate-600/20" />
    </motion.div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <GlassSkeleton key={i} className="h-24" />
        ))}
      </div>
      <GlassSkeleton className="h-72" />
      <GlassSkeleton className="h-56" />
    </div>
  );
}
