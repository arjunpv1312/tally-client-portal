"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type SlidingPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function SlidingPanel({
  open,
  title,
  onClose,
  children,
}: SlidingPanelProps) {
  return (
    <AnimatePresence mode="wait">
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label={`Close ${title}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-default bg-slate-950/45 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-y-0 right-0 z-50 w-[min(92vw,32rem)] border-l border-finora-gold/20 bg-white p-5 shadow-2xl dark:bg-[#111722]"
          >
            <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8F4E8]">
                {title}
              </h2>
              <button
                type="button"
                aria-label={`Close ${title}`}
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition active:scale-95 dark:border-white/10 dark:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
