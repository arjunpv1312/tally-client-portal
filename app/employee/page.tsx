"use client";

import { motion } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";

type Row = {
  company: string;
  gstin: string;
  status: "pending" | "in_progress" | "complete";
};

const demoRows: Row[] = [
  { company: "Acme Traders Pvt Ltd", gstin: "29ABCDE1234F1Z5", status: "in_progress" },
  { company: "Bright Retail LLP", gstin: "27FGHIJ5678K2Z1", status: "complete" },
  { company: "Nova Exports", gstin: "24KLMNO9012P3Z8", status: "pending" },
];

const statusStyles: Record<Row["status"], string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-sky-300",
  complete:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export default function EmployeePage() {
  return (
    <AuthGuard allow="employee">
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A]">
      <AppHeader
        title="Accountant Workspace"
        subtitle="Companies assigned to you and entry status"
      />
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-5xl px-6 py-8"
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#1E293B]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">GSTIN</th>
                <th className="px-4 py-3 font-medium">Entry status</th>
              </tr>
            </thead>
            <tbody>
              {demoRows.map((row) => (
                <tr
                  key={row.company}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {row.company}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {row.gstin}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[row.status]}`}
                    >
                      {row.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.main>
    </div>
    </AuthGuard>
  );
}
