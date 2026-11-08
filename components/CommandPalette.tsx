"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CalendarDays,
  FileBarChart2,
  Gauge,
  RefreshCw,
  Search,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SearchCompany = {
  id: string;
  name: string;
};

type CommandPaletteProps = {
  roleLabel?: string;
  companies?: SearchCompany[];
  onCompanySelect?: (company: SearchCompany) => void;
};

type CommandItem = {
  id: string;
  label: string;
  group: string;
  icon: typeof Gauge;
  run: () => void;
};

const datePresets = [
  { id: "month", label: "Show this month" },
  { id: "quarter", label: "Show this quarter" },
  { id: "fy-2025", label: "Show FY 2025-26" },
  { id: "fy-2026", label: "Show FY 2026-27" },
];

export function CommandPalette({
  roleLabel,
  companies = [],
  onCompanySelect,
}: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const items = useMemo<CommandItem[]>(() => {
    const isClient = roleLabel?.toLowerCase() === "client";
    const isAdmin = roleLabel?.toLowerCase().includes("admin");
    const commands: CommandItem[] = isClient
      ? [
          {
            id: "overview",
            label: "Open financial overview",
            group: "Navigation",
            icon: Gauge,
            run: () => router.push("/dashboard"),
          },
          {
            id: "gst",
            label: "Open GST reports",
            group: "Navigation",
            icon: FileBarChart2,
            run: () => router.push("/dashboard/gst"),
          },
          ...datePresets.map((preset) => ({
            id: `date-${preset.id}`,
            label: preset.label,
            group: "Date range",
            icon: CalendarDays,
            run: () => {
              if (pathname === "/dashboard") {
                window.dispatchEvent(
                  new CustomEvent("finora:date-preset", {
                    detail: { preset: preset.id },
                  }),
                );
                return;
              }
              window.sessionStorage.setItem("finora_date_preset", preset.id);
              router.push("/dashboard");
            },
          })),
        ]
      : isAdmin
        ? [
            {
              id: "admin",
              label: "Open admin portal",
              group: "Navigation",
              icon: Building2,
              run: () => router.push("/admin"),
            },
          ]
        : [
            {
              id: "employee",
              label: "Open employee workspace",
              group: "Navigation",
              icon: Gauge,
              run: () => router.push("/employee"),
            },
          ];
    commands.push(
      {
        id: "sync",
        label: "Copy one-time Tally sync command",
        group: "Tally sync",
        icon: RefreshCw,
        run: () => {
          if (!navigator.clipboard) {
            toast.error("Clipboard access is unavailable in this browser.");
            return;
          }
          void navigator.clipboard
            .writeText("python tally_sync.py --once")
            .then(() =>
              toast.success(
                "Command copied. Run it on the computer connected to TallyPrime.",
              ),
            )
            .catch((copyError: unknown) => {
              toast.error(
                copyError instanceof Error
                  ? `Unable to copy the sync command: ${copyError.message}`
                  : "Unable to copy the sync command.",
              );
            });
        },
      },
      ...companies.map((company) => ({
        id: `company-${company.id}`,
        label: `Open ${company.name}`,
        group: "Companies",
        icon: Building2,
        run: () => onCompanySelect?.(company),
      })),
    );
    return commands;
  }, [companies, onCompanySelect, pathname, roleLabel, router]);

  const filteredItems = items.filter((item) =>
    `${item.label} ${item.group}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function run(item: CommandItem) {
    item.run();
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="hidden min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-500 transition hover:border-[#E5C365]/50 hover:text-slate-900 active:scale-[0.98] dark:border-white/10 dark:text-slate-400 dark:hover:text-white lg:inline-flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="rounded border border-current/20 px-1.5 py-0.5 font-mono">
          Ctrl K
        </kbd>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 p-4 pt-[12vh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#111722] shadow-2xl"
            >
              <label className="flex items-center gap-3 border-b border-white/10 px-4">
                <Search className="h-5 w-5 shrink-0 text-[#E5C365]" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setSelectedIndex((index) => Math.min(
                        index + 1,
                        Math.max(0, filteredItems.length - 1),
                      ));
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setSelectedIndex((index) => Math.max(index - 1, 0));
                    } else if (event.key === "Enter" && filteredItems[selectedIndex]) {
                      event.preventDefault();
                      run(filteredItems[selectedIndex]);
                    }
                  }}
                  placeholder="Search pages, companies, and actions..."
                  aria-label="Search commands"
                  className="min-h-14 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
                <kbd className="rounded border border-white/10 px-2 py-1 text-[10px] text-slate-400">
                  ESC
                </kbd>
              </label>
              <div className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
                {filteredItems.length ? (
                  filteredItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={selectedIndex === index}
                        onClick={() => run(item)}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-200 transition active:scale-[0.98] ${
                          selectedIndex === index
                            ? "bg-white/[0.08] text-white"
                            : "hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-[#E5C365]" />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-xs text-slate-500">{item.group}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-8 text-center text-sm text-slate-400">
                    No matching commands.
                  </p>
                )}
              </div>
              <div className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
                FINORA · Executive workspace
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
