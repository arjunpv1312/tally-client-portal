"use client";

import { motion } from "framer-motion";
import type { LoginRoleTab } from "@/types";

const ROLES: { id: LoginRoleTab; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "employee", label: "Employee" },
  { id: "client", label: "Client" },
];

type RoleSelectorProps = {
  value: LoginRoleTab;
  onChange: (role: LoginRoleTab) => void;
};

export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const activeIndex = ROLES.findIndex((r) => r.id === value);

  return (
    <div
      className="relative grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/80"
      role="tablist"
      aria-label="Login role"
    >
      <motion.div
        className="absolute bottom-1 top-1 rounded-lg bg-white shadow-sm dark:bg-slate-700"
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          width: "calc((100% - 0.5rem) / 3)",
          left: `calc(0.25rem + ${activeIndex} * ((100% - 0.5rem) / 3))`,
        }}
      />
      {ROLES.map((role) => {
        const selected = value === role.id;
        return (
          <button
            key={role.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(role.id)}
            className={`relative z-10 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
              selected
                ? "text-slate-900 dark:text-slate-50"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {role.label}
          </button>
        );
      })}
    </div>
  );
}
