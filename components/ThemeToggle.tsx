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
      className="relative flex h-9 w-[4.25rem] items-center rounded-full border border-slate-200 bg-slate-100 p-1 shadow-sm transition-colors dark:border-[#334155] dark:bg-[#1E293B]"
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className="absolute h-7 w-7 rounded-full bg-white shadow-sm dark:bg-[#334155]"
        style={{ left: isDark ? "calc(100% - 1.875rem)" : "0.25rem" }}
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
