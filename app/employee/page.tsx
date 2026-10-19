"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { SpinnerRing } from "@/components/LoadingSkeleton";
import { getSupabase } from "@/lib/supabase";

type EntryStatus = "pending" | "in_progress" | "complete";

type AssignmentRow = {
  id: string;
  entry_status: EntryStatus;
  company: { name: string; gstin: string | null } | null;
};

const statusStyles: Record<EntryStatus, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-sky-300",
  complete:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export default function EmployeePage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      try {
        const supabase = getSupabase();
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message);
        const userId = sessionData.session?.user.id;
        if (!userId) throw new Error("Your session has expired. Sign in again.");

        const { data, error: assignmentError } = await supabase
          .from("company_employees")
          .select("id, entry_status, company:companies(name, gstin)")
          .eq("employee_id", userId)
          .order("created_at", { ascending: false })
          .returns<AssignmentRow[]>();
        if (assignmentError) throw new Error(assignmentError.message);
        if (!cancelled) setRows(data ?? []);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your assigned companies.";
        if (!cancelled) {
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAssignments();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthGuard allow="employee">
      <div className="min-h-screen bg-white dark:bg-[#0F172A]">
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
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                <SpinnerRing className="h-6 w-6" />
                <span className="text-sm">Loading assigned companies…</span>
              </div>
            ) : error ? (
              <p role="alert" className="p-6 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-slate-600 dark:border-[#334155] dark:bg-[#0F172A]/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">GSTIN</th>
                      <th className="px-4 py-3 font-medium">Entry status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 last:border-0 dark:border-[#334155]"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {row.company?.name ?? "Company unavailable"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {row.company?.gstin || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[row.entry_status]}`}
                          >
                            {row.entry_status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                        >
                          No companies have been assigned to you yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.main>
      </div>
    </AuthGuard>
  );
}
