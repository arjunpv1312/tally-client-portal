"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { SpinnerRing } from "@/components/LoadingSkeleton";
import { CompanySelector } from "@/components/navbar/CompanySelector";
import { TaskChecklistModal } from "@/components/dashboard/TaskChecklistModal";
import {
  closeEmployeeWorkLog,
  EMPLOYEE_WORK_LOG_CHANGED_EVENT,
  getActiveEmployeeWorkLog,
  notifyEmployeeCompanyChanged,
  type EmployeeWorkLogState,
} from "@/lib/employee-work-logs";
import { getSupabase } from "@/lib/supabase";

type EntryStatus = "pending" | "in_progress" | "complete" | "active";

type AssignmentRow = {
  id: string;
  entry_status?: EntryStatus | null;
  user_id?: string | null;
  employee_id?: string | null;
  company_id?: string;
  company: { name: string; gstin: string | null } | null;
};

const statusStyles: Record<EntryStatus, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-sky-300",
  complete:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export default function EmployeePage() {
  const router = useRouter();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [workLog, setWorkLog] = useState<EmployeeWorkLogState | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  useEffect(() => {
    const activeLog = getActiveEmployeeWorkLog();
    queueMicrotask(() => {
      if (activeLog) {
        setWorkLog(activeLog);
        setSelectedCompanyId(activeLog.companyId);
      }
    });

    function updateWorkLog(event: Event) {
      const nextState = (event as CustomEvent<EmployeeWorkLogState | null>).detail;
      setWorkLog(nextState);
      if (nextState) setSelectedCompanyId(nextState.companyId);
    }

    window.addEventListener(EMPLOYEE_WORK_LOG_CHANGED_EVENT, updateWorkLog);
    return () =>
      window.removeEventListener(EMPLOYEE_WORK_LOG_CHANGED_EVENT, updateWorkLog);
  }, []);

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

        const queryAssignments = (userColumn: "user_id" | "employee_id", includeStatus: boolean) =>
          supabase
            .from("company_employees")
            .select(
              `id, company_id, ${userColumn}${includeStatus ? ", entry_status" : ""}, company:companies(name, gstin)`,
            )
            .eq(userColumn, userId)
            .order("id")
            .returns<AssignmentRow[]>();
        const variants: Array<["user_id" | "employee_id", boolean]> = [
          ["user_id", true],
          ["employee_id", true],
          ["user_id", false],
          ["employee_id", false],
        ];
        let rowsResult = await queryAssignments(...variants[0]);
        let hasStatusColumn = true;
        for (const variant of variants.slice(1)) {
          if (!rowsResult.error) break;
          if (!variant[1]) hasStatusColumn = false;
          rowsResult = await queryAssignments(...variant);
        }
        if (rowsResult.error) throw new Error(rowsResult.error.message);
        if (!cancelled) {
          setWarning(
            hasStatusColumn
              ? ""
              : "The entry_status column is missing. Showing Active as a fallback; ask your administrator to update the Supabase schema.",
          );
        }
        const rows = (rowsResult.data ?? []).map((row) => ({
          ...row,
          entry_status: row.entry_status || "active",
        }));
        if (!cancelled) {
          setRows(rows);
          setSelectedCompanyId((current) =>
            current && rows.some((row) => row.company_id === current)
              ? current
              : getActiveEmployeeWorkLog()?.companyId ?? rows[0]?.company_id ?? "",
          );
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your assigned companies.";
        if (!cancelled) {
          setError(message);
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

  const visibleRows = selectedCompanyId
    ? rows.filter((row) => row.company_id === selectedCompanyId)
    : rows;
  const selectedCompany = rows.find(
    (row) => row.company_id === selectedCompanyId,
  )?.company;

  function selectCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    notifyEmployeeCompanyChanged(companyId);
  }

  async function logOutAfterTasks() {
    await closeEmployeeWorkLog();
    const { error: signOutError } = await getSupabase().auth.signOut();
    if (signOutError) throw new Error(signOutError.message);
    router.replace("/login");
    router.refresh();
  }

  async function requestLogout() {
    setTaskModalOpen(true);
    return false;
  }

  return (
    <AuthGuard allow="employee">
      <div className="min-h-screen bg-white dark:bg-finora-dark">
        <AppHeader
          title="Accountant Workspace"
          subtitle="Companies assigned to you and entry status"
          roleLabel="Employee"
          navItems={[{ label: "Workspace", href: "/employee" }]}
          contextControl={
            <CompanySelector
              companies={rows
                .filter((row) => row.company)
                .map((row) => ({
                  id: row.company_id ?? "",
                  name: row.company?.name ?? "Company",
                }))}
              value={selectedCompanyId}
              onChange={selectCompany}
            />
          }
          onLogoutRequest={requestLogout}
        />
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-5xl px-4 py-6 transform-gpu will-change-transform sm:px-6 lg:px-8"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {selectedCompany
                ? `Active company: ${selectedCompany.name}`
                : "Select a company to set your active work context."}
            </p>
            <button
              type="button"
              onClick={() => setTaskModalOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:bg-[#60A5FA] dark:text-slate-950"
            >
              <ClipboardCheck className="h-4 w-4" />
              Update tasks
            </button>
          </div>
          {warning ? (
            <p
              role="status"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            >
              {warning}
            </p>
          ) : null}
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
              <>
              <div className="hidden w-full overflow-x-auto scrollbar-thin scrollbar-thumb-amber-500/20 sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-slate-600 dark:border-[#334155] dark:bg-[#0F172A]/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">GSTIN</th>
                      <th className="px-4 py-3 font-medium">Entry status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const entryStatus = row.entry_status || "active";
                      return (
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
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[entryStatus]}`}
                          >
                            {entryStatus.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                        >
                          {rows.length === 0
                            ? "No companies have been assigned to you yet."
                            : "Select an assigned company to view its work context."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-3 sm:hidden">
                {visibleRows.map((row) => {
                  const entryStatus = row.entry_status || "active";
                  return (
                    <article
                      key={row.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-finora-gold/15 dark:bg-finora-dark/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                            {row.company?.name ?? "Company unavailable"}
                          </h2>
                          <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                            {row.company?.gstin || "No GSTIN"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[entryStatus]}`}
                        >
                          {entryStatus.replace("_", " ")}
                        </span>
                      </div>
                    </article>
                  );
                })}
                {visibleRows.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {rows.length === 0
                      ? "No companies have been assigned to you yet."
                      : "Select an assigned company to view its work context."}
                  </p>
                ) : null}
              </div>
              </>
            )}
          </div>
        </motion.main>
      </div>
      {taskModalOpen ? (
        <TaskChecklistModal
          key={workLog?.id ?? "no-work-log"}
          workLogId={workLog?.id ?? null}
          onClose={() => setTaskModalOpen(false)}
          onLogout={logOutAfterTasks}
        />
      ) : null}
    </AuthGuard>
  );
}
