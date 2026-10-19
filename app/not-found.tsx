"use client";

import Link from "next/link";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-white px-6 py-16 dark:bg-[#0F172A]">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-[#F8FAFC] p-8 text-center shadow-sm dark:border-[#334155] dark:bg-[#1E293B] sm:p-12"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-[#60A5FA]">
          <CircleHelp className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-semibold tracking-[0.2em] text-blue-600 dark:text-[#60A5FA]">
          ERROR 404
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          This page may have moved, or the address may be incorrect.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-[#60A5FA] dark:text-slate-950 dark:hover:bg-blue-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to Dashboard
        </Link>
      </motion.section>
    </main>
  );
}
