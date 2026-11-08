"use client";

import { useCallback, useEffect, useState } from "react";

export type DateRange = {
  startDate: string;
  endDate: string;
};

type Preset = "month" | "quarter" | "fy-2025" | "fy-2026" | "custom";

type DateFilterProps = {
  onChange: (range: DateRange) => void;
};

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getRange(preset: Exclude<Preset, "custom">, now = new Date()): DateRange {
  if (preset === "fy-2025") {
    return { startDate: "2025-04-01", endDate: "2026-03-31" };
  }
  if (preset === "fy-2026") {
    return { startDate: "2026-04-01", endDate: "2027-03-31" };
  }
  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      startDate: isoDate(new Date(now.getFullYear(), quarterStartMonth, 1)),
      endDate: isoDate(new Date(now.getFullYear(), quarterStartMonth + 3, 0)),
    };
  }
  return {
    startDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function getInitialDateRange() {
  return getRange("month");
}

const presets: { id: Exclude<Preset, "custom">; label: string }[] = [
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
  { id: "fy-2025", label: "FY 2025-26" },
  { id: "fy-2026", label: "FY 2026-27" },
];

export function DateFilter({ onChange }: DateFilterProps) {
  const [selectedPreset, setSelectedPreset] = useState<Preset>("month");
  const [customRange, setCustomRange] = useState<DateRange>(() => getRange("month"));
  const [validationError, setValidationError] = useState("");

  const choosePreset = useCallback((preset: Exclude<Preset, "custom">) => {
    setSelectedPreset(preset);
    setValidationError("");
    onChange(getRange(preset));
  }, [onChange]);

  useEffect(() => {
    let storedPresetTimer: number | undefined;
    function applyRequestedPreset(event: Event) {
      const preset = (event as CustomEvent<{ preset?: string }>).detail?.preset;
      if (presets.some((item) => item.id === preset)) {
        choosePreset(preset as Exclude<Preset, "custom">);
      }
    }

    window.addEventListener("finora:date-preset", applyRequestedPreset);
    const storedPreset = window.sessionStorage.getItem("finora_date_preset");
    if (presets.some((item) => item.id === storedPreset)) {
      window.sessionStorage.removeItem("finora_date_preset");
      storedPresetTimer = window.setTimeout(
        () => choosePreset(storedPreset as Exclude<Preset, "custom">),
        0,
      );
    }
    return () => {
      if (storedPresetTimer !== undefined) {
        window.clearTimeout(storedPresetTimer);
      }
      window.removeEventListener("finora:date-preset", applyRequestedPreset);
    };
  }, [choosePreset]);

  function changeCustomRange(nextRange: DateRange) {
    setSelectedPreset("custom");
    setCustomRange(nextRange);
    if (
      nextRange.startDate &&
      nextRange.endDate &&
      nextRange.startDate <= nextRange.endDate
    ) {
      setValidationError("");
      onChange(nextRange);
    } else if (nextRange.startDate && nextRange.endDate) {
      setValidationError("Start date must be on or before the end date.");
    }
  }

  return (
    <section
      aria-label="Filter financial data by date"
      className="space-y-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 dark:border-white/[0.08] dark:bg-[#111722]"
    >
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={selectedPreset === preset.id}
            onClick={() => choosePreset(preset.id)}
            className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition active:scale-[0.98] ${
              selectedPreset === preset.id
                ? "border-[#E5C365] bg-[#E5C365] text-slate-950"
                : "border-slate-200 text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={selectedPreset === "custom"}
          onClick={() => setSelectedPreset("custom")}
          className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition active:scale-[0.98] ${
            selectedPreset === "custom"
              ? "border-[#E5C365] bg-[#E5C365] text-slate-950"
              : "border-slate-200 text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          Custom Range
        </button>
      </div>
      {selectedPreset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            From
            <input
              type="date"
              value={customRange.startDate}
              onChange={(event) =>
                changeCustomRange({ ...customRange, startDate: event.target.value })
              }
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            To
            <input
              type="date"
              value={customRange.endDate}
              onChange={(event) =>
                changeCustomRange({ ...customRange, endDate: event.target.value })
              }
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          {validationError ? (
            <p role="alert" className="pb-2 text-sm text-rose-600">
              {validationError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
