"use client";

import { motion } from "framer-motion";

export type SelectableCompany = {
  id: string;
  name: string;
};

type CompanySelectorProps = {
  companies: SelectableCompany[];
  value: string;
  onChange: (companyId: string) => void;
};

export function CompanySelector({
  companies,
  value,
  onChange,
}: CompanySelectorProps) {
  if (companies.length < 2) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Active company"
      className="flex max-w-[16rem] items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
    >
      {companies.map((company) => {
        const active = company.id === value;
        return (
          <button
            key={company.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(company.id)}
            className={`relative min-h-9 shrink-0 rounded-lg px-3 text-xs font-medium transition ${
              active
                ? "text-slate-950"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="company-switcher-active"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-[#E5C365]"
              />
            ) : null}
            <span className="relative z-10 max-w-28 truncate">
              {company.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
