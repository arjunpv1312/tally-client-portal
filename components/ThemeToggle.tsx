"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-12 w-[4.5rem] items-center rounded-full border border-slate-200 bg-slate-100 p-1 shadow-sm transition-colors active:scale-95 dark:border-finora-gold/20 dark:bg-finora-surface"
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className="absolute h-9 w-9 rounded-full bg-white shadow-sm dark:bg-finora-gold/15"
        style={{ left: isDark ? "calc(100% - 2.375rem)" : "0.25rem" }}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-1.5">
        <Sun
          className={`h-4 w-4 ${!isDark ? "text-amber-500" : "text-slate-400"}`}
        />
        <Moon
          className={`h-4 w-4 ${isDark ? "text-sky-300" : "text-slate-400"}`}
        />
      </span>
    </button>
  );
}
