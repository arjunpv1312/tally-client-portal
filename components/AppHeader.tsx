"use client";

import Image from "next/image";
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
    <header className="flex items-center justify-between gap-4 border-b border-finora-gold/20 bg-white/80 px-5 py-4 backdrop-blur-md dark:bg-[#0B0E17]/80 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <div className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="FINORA"
            width={48}
            height={48}
            className="h-10 w-10 rounded-xl object-cover shadow-gold-glow sm:h-12 sm:w-12"
          />
          <div className="hidden sm:block">
            <p className="bg-gradient-to-r from-finora-gold-dark via-finora-gold to-finora-gold-light bg-clip-text text-sm font-bold tracking-[0.18em] text-transparent">
              FINORA
            </p>
            <p className="text-[10px] tracking-wide text-slate-500 dark:text-slate-400">
              Accounting &amp; Business Solutions
            </p>
          </div>
        </div>
        <div className="min-w-0 border-l border-finora-gold/25 pl-3 sm:pl-5">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-[#F8F4E8] sm:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {identityName ? (
          <div className="hidden items-center gap-2 sm:flex">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-finora-gold/30 bg-finora-gold/10 text-xs font-semibold text-finora-gold-dark dark:text-finora-gold"
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
