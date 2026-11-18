"use client";

import { motion } from "framer-motion";
import { DashboardContentSkeleton } from "@/components/dashboard/DashboardSkeleton";

export function SpinnerRing({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative inline-flex h-10 w-10 items-center justify-center ${className}`}
      role="status"
      aria-label="Loading"
    >
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-white/10"
      />
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#9E7C28] dark:border-t-[#E5C365]"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return <DashboardContentSkeleton />;
}
