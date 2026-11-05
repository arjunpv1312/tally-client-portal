"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export type HeaderNavItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
};

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  identityName?: string;
  identityLabel?: string;
  roleLabel?: string;
  navItems?: HeaderNavItem[];
  activeNavItem?: string;
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
  roleLabel,
  navItems = [],
  activeNavItem,
}: AppHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function selectItem(item: HeaderNavItem) {
    item.onSelect?.();
    setMenuOpen(false);
  }

  function itemIsActive(item: HeaderNavItem) {
    return activeNavItem
      ? activeNavItem === item.label
      : item.href === pathname;
  }

  const linkClass = (active: boolean) =>
    `flex min-h-12 items-center rounded-xl px-3 text-sm font-medium transition-colors active:scale-95 ${
      active
        ? "capitalize bg-finora-gold/10 text-finora-gold-dark dark:text-finora-gold-light"
        : "capitalize text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
    }`;

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-finora-gold/20 bg-white/85 px-3 py-2 backdrop-blur-md dark:bg-[#0B0E17]/85 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="FINORA"
            width={48}
            height={48}
            className="h-9 w-9 rounded-lg object-cover shadow-gold-glow sm:h-11 sm:w-11"
          />
          <div className="hidden lg:block">
            <p className="bg-gradient-to-r from-finora-gold-dark via-finora-gold to-finora-gold-light bg-clip-text text-sm font-bold tracking-[0.18em] text-transparent">
              FINORA
            </p>
            <p className="text-[10px] tracking-wide text-slate-500 dark:text-slate-400">
              Accounting &amp; Business Solutions
            </p>
          </div>
        </div>
        <div className="min-w-0 border-l border-finora-gold/25 pl-2 sm:pl-4">
          <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-[#F8F4E8] sm:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 hidden truncate text-xs text-slate-500 dark:text-slate-400 sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
        {navItems.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              aria-current={itemIsActive(item) ? "page" : undefined}
              className={linkClass(itemIsActive(item))}
            >
              {item.label}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={() => selectItem(item)}
              aria-current={itemIsActive(item) ? "page" : undefined}
              className={linkClass(itemIsActive(item))}
            >
              {item.label}
            </button>
          ),
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {roleLabel ? (
          <span className="hidden rounded-full border border-finora-gold/25 bg-finora-gold/10 px-2.5 py-1 text-xs font-medium text-finora-gold-dark dark:text-finora-gold-light md:inline-flex">
            {roleLabel}
          </span>
        ) : null}
        {identityName ? (
          <div className="hidden items-center gap-2 lg:flex">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-finora-gold/30 bg-finora-gold/10 text-xs font-semibold text-finora-gold-dark dark:text-finora-gold"
            >
              {initials(identityName)}
            </span>
            <span className="max-w-32">
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
        <span className="hidden md:inline-flex">
          <LogoutButton />
        </span>
        <button
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-finora-gold/25 text-slate-700 transition hover:bg-finora-gold/10 active:scale-95 dark:text-finora-gold-light md:hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={menuOpen ? "close" : "open"}
              initial={{ opacity: 0, rotate: -45, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close navigation menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-slate-950/45 backdrop-blur-md md:hidden"
            />
            <motion.aside
              id="mobile-navigation"
              initial={{ opacity: 0, x: "100%" }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: "100%" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-[min(88vw,22rem)] flex-col border-l border-finora-gold/20 bg-white/95 p-5 shadow-2xl backdrop-blur-xl transform-gpu dark:bg-finora-surface/95 md:hidden"
            >
              <div className="mb-5 flex items-center justify-between border-b border-finora-gold/15 pb-4">
                <div className="flex items-center gap-3">
                  <Image
                    src="/logo.png"
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-xl object-cover"
                  />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-[#F8F4E8]">
                      {identityName || "FINORA"}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {roleLabel || identityLabel || "Workspace"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 active:scale-95 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                {navItems.map((item) =>
                  item.href ? (
                    <Link
                      key={item.label}
                      href={item.href}
                      aria-current={itemIsActive(item) ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={linkClass(itemIsActive(item))}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => selectItem(item)}
                      aria-current={itemIsActive(item) ? "page" : undefined}
                      className={`w-full text-left ${linkClass(itemIsActive(item))}`}
                    >
                      {item.label}
                    </button>
                  ),
                )}
              </nav>
              <div className="mt-auto border-t border-finora-gold/15 pt-4">
                <LogoutButton />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
