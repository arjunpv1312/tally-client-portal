"use client";

import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  identityName?: string;
  identityLabel?: string;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppHeader({
  title,
  subtitle,
  identityName,
  identityLabel,
}: AppHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-[#334155] dark:bg-[#0F172A]/90">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {identityName ? (
          <div className="hidden items-center gap-2 sm:flex">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#60A5FA]"
            >
              {initials(identityName)}
            </span>
            <span className="max-w-36">
              <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                {identityName}
              </span>
              {identityLabel ? (
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {identityLabel}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
