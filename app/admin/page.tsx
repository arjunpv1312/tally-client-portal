"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Check,
  ClipboardList,
  Copy,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  UserRoundX,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";
import { AuthGuard } from "@/components/AuthGuard";
import { getBrowserSupabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/types";

type Company = {
  id: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
};

type Assignment = {
  id: string;
  employee_id: string;
  company_id: string;
  created_at: null;
  entry_status: string;
};

type Tab = "companies" | "users" | "assignments";
type DirectoryErrors = Partial<Record<Tab, string>>;

const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "users", label: "Users", icon: Users },
  { id: "assignments", label: "Assignments", icon: ClipboardList },
];

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-[#334155] dark:bg-[#0F172A]/60 dark:text-slate-100 dark:placeholder:text-slate-500";
const labelClassName =
  "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";
const buttonClassName =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:bg-[#60A5FA] dark:text-slate-950 dark:hover:bg-blue-300";
const rowActionClassName =
  "inline-flex min-h-12 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:text-rose-300 dark:hover:bg-rose-950/40";

async function callAdminApi(
  pathname: string,
  payload: Record<string, string>,
): Promise<void> {
  const { data, error } = await getBrowserSupabase().auth.getSession();
  if (error) throw new Error(error.message);
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Your admin session has expired. Sign in again.");

  const response = await fetch(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as {
    success?: boolean;
    error?: string;
  };
  if (!response.ok || !result.success) {
    throw new Error(result.error ?? "The admin action could not be completed.");
  }
}

function displayActionError(message: string, setError: (message: string) => void) {
  setError(message);
  toast.error(message);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function roleLabel(role: UserRole) {
  return role === "company" ? "Client" : role === "employee" ? "Employee" : "Admin";
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseProjectRef = (() => {
  if (!supabaseUrl) return "";
  try {
    const hostname = new URL(supabaseUrl).hostname;
    return hostname.endsWith(".supabase.co")
      ? hostname.slice(0, -".supabase.co".length)
      : "";
  } catch {
    return "";
  }
})();

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [newUserRole, setNewUserRole] = useState<UserRole>("employee");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [directoryErrors, setDirectoryErrors] = useState<DirectoryErrors>({});
  const [assignmentWarning, setAssignmentWarning] = useState("");

  const employees = useMemo(
    () => profiles.filter((profile) => profile.role === "employee"),
    [profiles],
  );
  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch (copyError) {
      toast.error(
        copyError instanceof Error
          ? `Unable to copy to clipboard: ${copyError.message}`
          : "Unable to copy to clipboard. Check your browser permissions.",
      );
    }
  }

  const refreshDirectory = useCallback(async () => {
    const supabase = getBrowserSupabase();
    const [companyResult, profileResult] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, gstin, email, phone, created_at")
        .order("name"),
      supabase
        .from("profiles")
        .select("id, email, full_name, role, company_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const assignmentQuery = (columns: string) =>
      supabase
        .from("company_employees")
        .select(columns)
        .order("id")
        .returns<
          {
            id: string;
            company_id: string;
            user_id?: string | null;
            employee_id?: string | null;
            entry_status?: string | null;
          }[]
        >();
    const assignmentVariants = [
      "id, company_id, user_id, entry_status",
      "id, company_id, employee_id, entry_status",
      "id, company_id, user_id",
      "id, company_id, employee_id",
    ];
    let assignmentResult = await assignmentQuery(assignmentVariants[0]);
    let hasStatusColumn = true;
    if (assignmentResult.error) {
      assignmentResult = await assignmentQuery(assignmentVariants[1]);
    }
    if (assignmentResult.error) {
      hasStatusColumn = false;
      assignmentResult = await assignmentQuery(assignmentVariants[2]);
    }
    if (assignmentResult.error) {
      assignmentResult = await assignmentQuery(assignmentVariants[3]);
    }
    setAssignmentWarning(
      !assignmentResult.error && !hasStatusColumn
        ? "The entry_status column is unavailable; assignments are shown as Active until the schema is updated."
        : "",
    );

    setDirectoryErrors({
      ...(companyResult.error
        ? { companies: companyResult.error.message }
        : {}),
      ...(profileResult.error ? { users: profileResult.error.message } : {}),
      ...(assignmentResult.error
        ? { assignments: assignmentResult.error.message }
        : {}),
    });
    if (!companyResult.error) {
      setCompanies((companyResult.data ?? []) as Company[]);
    }
    setProfiles((profileResult.data ?? []) as Profile[]);
    setAssignments(
      (assignmentResult.data ?? []).map((assignment) => {
        const row = assignment as {
          id: string;
          company_id: string;
          user_id?: string | null;
          employee_id?: string | null;
          entry_status?: string | null;
        };
        return {
          id: row.id,
          company_id: row.company_id,
          employee_id: row.user_id ?? row.employee_id ?? "",
          created_at: null,
          entry_status: row.entry_status || "active",
        };
      }),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDirectory() {
      try {
        await refreshDirectory();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load admin data. Check your connection and Supabase access policies, then reload.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [refreshDirectory]);

  async function completeAction(message: string) {
    await refreshDirectory();
    setNotice(message);
    setError("");
    toast.success(message);
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setPendingAction("company");
    setError("");
    setNotice("");

    try {
      const formData = new FormData(form);
      const { data: createdCompany, error: insertError } =
        await getBrowserSupabase()
          .from("companies")
          .insert({
            name: String(formData.get("name") ?? "").trim(),
            gstin: String(formData.get("gstin") ?? "").trim() || null,
            email: String(formData.get("email") ?? "").trim() || null,
            phone: String(formData.get("phone") ?? "").trim() || null,
          })
          .select("id, name, gstin, email, phone, created_at")
          .single();
      if (insertError) throw new Error(insertError.message);
      if (!createdCompany) {
        throw new Error("Company was created, but its ID was not returned.");
      }
      setCompanies((current) =>
        [
          ...current.filter((company) => company.id !== createdCompany.id),
          createdCompany,
        ]
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
      form.reset();
      await completeAction("Company created successfully.");
    } catch (actionError) {
      displayActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to create the company.",
        setError,
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPendingAction("account");
    setError("");
    setNotice("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const role = String(formData.get("role")) as UserRole;
    try {
      const { data: sessionData, error: sessionError } =
        await getBrowserSupabase().auth.getSession();
      if (sessionError) throw new Error(sessionError.message);
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your admin session has expired. Sign in again.");

      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: String(formData.get("email") ?? "").trim(),
          password: String(formData.get("password") ?? ""),
          full_name: String(formData.get("full_name") ?? "").trim(),
          role,
          company_id: String(formData.get("company_id") ?? "") || null,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Unable to create the account.");
      }

      form.reset();
      setNewUserRole("employee");
      await completeAction("Account created and email confirmed.");
    } catch (actionError) {
      displayActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to create the account.",
        setError,
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function deleteCompany(company: Company) {
    if (
      !window.confirm(
        `Delete ${company.name}? Linked client profiles may prevent deletion.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setPendingAction("company-delete");
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await getBrowserSupabase()
        .from("companies")
        .delete()
        .eq("id", company.id);
      if (deleteError) throw new Error(deleteError.message);
      await completeAction("Company deleted.");
    } catch (actionError) {
      displayActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to delete the company.",
        setError,
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setPendingAction("assignment");
    setError("");
    setNotice("");

    try {
      const formData = new FormData(form);
      const employeeId = String(formData.get("employee_id") ?? "");
      const companyId = String(formData.get("company_id") ?? "");
      const supabase = getBrowserSupabase();
      let { error: insertError } = await supabase
        .from("company_employees")
        .insert({
          user_id: employeeId,
          employee_id: employeeId,
          company_id: companyId,
        });
      if (
        insertError &&
        /user_id/i.test(insertError.message) &&
        /(column|schema cache|does not exist|could not find)/i.test(
          insertError.message,
        )
      ) {
        const legacyInsert = await supabase.from("company_employees").insert({
          employee_id: employeeId,
          company_id: companyId,
        });
        insertError = legacyInsert.error;
      } else if (
        insertError &&
        /employee_id/i.test(insertError.message) &&
        /(column|schema cache|does not exist|could not find)/i.test(
          insertError.message,
        )
      ) {
        const userIdInsert = await supabase.from("company_employees").insert({
          user_id: employeeId,
          company_id: companyId,
        });
        insertError = userIdInsert.error;
      }
      if (insertError) throw new Error(insertError.message);
      form.reset();
      await completeAction("Employee assigned to company.");
    } catch (actionError) {
      displayActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to create the assignment.",
        setError,
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function removeAssignment(assignment: Assignment) {
    if (!window.confirm("Revoke this employee's access to the selected company?")) {
      return;
    }

    setBusy(true);
    setPendingAction("assignment-revoke");
    setError("");
    setNotice("");
    try {
      await callAdminApi("/api/admin/revoke-access", {
        assignment_id: assignment.id,
      });
      await completeAction("Assignment revoked.");
    } catch (actionError) {
      displayActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to remove the assignment.",
        setError,
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function revokeUserAccess(profile: Profile) {
    const scope = profile.company_id
      ? ` from ${companies.find((company) => company.id === profile.company_id)?.name ?? "the linked company"}`
      : " from all assigned companies";
    if (!window.confirm(`Revoke ${profile.full_name || profile.email}'s access${scope}?`)) {
      return;
    }

    setBusy(true);
    setPendingAction("access-revoke");
    setError("");
    setNotice("");
    try {
      await callAdminApi("/api/admin/revoke-access", {
        user_id: profile.id,
        ...(profile.company_id ? { company_id: profile.company_id } : {}),
      });
      await completeAction("Company access revoked.");
    } catch (actionError) {
      displayActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to revoke company access.",
        setError,
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function deleteUser(profile: Profile) {
    if (!window.confirm(`Permanently delete ${profile.full_name || profile.email}'s account?`)) {
      return;
    }

    setBusy(true);
    setPendingAction("user-delete");
    setError("");
    setNotice("");
    try {
      await callAdminApi("/api/admin/delete-user", { user_id: profile.id });
      await completeAction("User account deleted.");
    } catch (actionError) {
      displayActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to delete the user account.",
        setError,
      );
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  if (loading) {
    return (
      <AuthGuard allow="admin">
        <AdminSkeleton />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard allow="admin">
      <div className="min-h-screen bg-white dark:bg-transparent">
        <AppHeader
          title="Admin Dashboard"
          subtitle="Manage client companies, user access, and team assignments"
          roleLabel="Administrator"
          activeNavItem={activeTab}
          navItems={[
            { label: "companies", onSelect: () => setActiveTab("companies") },
            { label: "users", onSelect: () => setActiveTab("users") },
            {
              label: "assignments",
              onSelect: () => setActiveTab("assignments"),
            },
          ]}
        />
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-7xl space-y-6 px-4 py-6 transform-gpu will-change-transform sm:px-6 lg:px-8"
        >
          <section className="rounded-2xl border border-slate-200 bg-[#0F172A] p-5 text-white shadow-lg dark:border-finora-gold/20 dark:bg-finora-surface/90 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Tally Integration &amp; Project Config
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Use these public project settings when configuring your local
                  sync worker. Never share a service-role key in the browser.
                </p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Supabase Project ID / Reference
                    </dt>
                    <dd className="mt-1 break-all font-mono text-sm">
                      {supabaseProjectRef || "Not available"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      API Endpoint
                    </dt>
                    <dd className="mt-1 break-all font-mono text-sm">
                      {supabaseUrl || "Not configured"}
                    </dd>
                  </div>
                </dl>
              </div>
              <button
                type="button"
                disabled={!supabaseUrl}
                onClick={() =>
                  void copyToClipboard(
                    `SUPABASE_PROJECT_REF=${supabaseProjectRef}\nSUPABASE_URL=${supabaseUrl}\nTALLY_HOST=http://localhost:9000`,
                    "Copied project config!",
                  )
                }
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                Copy Project Config
              </button>
            </div>
            <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
              {[
                "Copy your Company ID from the Companies list below.",
                "Open TallyPrime with its XML server available on port 9000.",
                "Run python tally_sync.py or double-click run_sync.bat.",
              ].map((step, index) => (
                <div key={step} className="flex gap-3 text-sm text-slate-200">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-finora-gold font-semibold text-slate-950">
                    {index + 1}
                  </span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              The sync service-role key must be configured securely on the
              computer running the sync. It is never displayed or copied here.
            </p>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
            {[
              { label: "Companies", value: companies.length, icon: Building2 },
              { label: "Registered users", value: profiles.length, icon: Users },
              {
                label: "Active assignments",
                value: assignments.length,
                icon: ClipboardList,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-finora-gold/40 hover:shadow-gold-glow active:scale-95 dark:border-finora-gold/20 dark:bg-finora-surface/70 dark:backdrop-blur-lg"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {label}
                  </p>
                  <Icon className="h-5 w-5 text-finora-gold-dark dark:text-finora-gold" />
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
            <div className="border-b border-slate-200 px-4 dark:border-[#334155] sm:px-6">
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Admin sections">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    id={`${id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === id}
                    aria-controls={`${id}-panel`}
                    onClick={() => {
                      setActiveTab(id);
                      setError("");
                      setNotice("");
                    }}
                    className={`relative flex shrink-0 items-center gap-2 px-4 py-4 text-sm font-medium transition ${
                      activeTab === id
                        ? "text-blue-700 dark:text-[#60A5FA]"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {activeTab === id && (
                      <motion.span
                        layoutId="admin-tab-indicator"
                        className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-600 dark:bg-[#60A5FA]"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"
                >
                  {error}
                </div>
              )}
              {notice && (
                <div
                  role="status"
                  className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                >
                  <Check className="h-4 w-4" />
                  {notice}
                </div>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    id={`${activeTab}-panel`}
                    role="tabpanel"
                    aria-labelledby={`${activeTab}-tab`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {activeTab === "companies" && (
                      <div className="space-y-7">
                        <DirectoryError message={directoryErrors.companies} />
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Create a company
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Add a client organization to the reporting workspace.
                          </p>
                          <form
                            onSubmit={createCompany}
                            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                          >
                            <label>
                              <span className={labelClassName}>Company name</span>
                              <input
                                className={inputClassName}
                                name="name"
                                required
                                maxLength={160}
                                placeholder="Acme Traders"
                              />
                            </label>
                            <label>
                              <span className={labelClassName}>GSTIN</span>
                              <input
                                className={inputClassName}
                                name="gstin"
                                maxLength={15}
                                placeholder="29ABCDE1234F1Z5"
                              />
                            </label>
                            <label>
                              <span className={labelClassName}>Email</span>
                              <input
                                className={inputClassName}
                                name="email"
                                type="email"
                                placeholder="accounts@example.com"
                              />
                            </label>
                            <label>
                              <span className={labelClassName}>Phone</span>
                              <input
                                className={inputClassName}
                                name="phone"
                                type="tel"
                                placeholder="+91 98765 43210"
                              />
                            </label>
                            <div className="sm:col-span-2 lg:col-span-4">
                              <button className={buttonClassName} disabled={busy}>
                                {pendingAction === "company" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                                {pendingAction === "company"
                                  ? "Creating Company..."
                                  : "Add company"}
                              </button>
                            </div>
                          </form>
                        </div>
                        <DataTable
                          title="Company directory"
                          count={companies.length}
                          headers={["Company", "Company ID", "GSTIN", "Contact", "Created", ""]}
                          emptyText="No companies have been added yet."
                          mobileContent={companies.map((company) => (
                            <article
                              key={company.id}
                              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-lg active:translate-y-0 dark:border-finora-gold/15 dark:bg-finora-dark/50"
                            >
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-finora-gold/10">
                                <span
                                  title={company.id}
                                  className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  {company.id.slice(0, 8)}...
                                </span>
                                <button
                                  type="button"
                                  title="Paste this Company ID into your local tally_sync.py or .env file to sync data."
                                  aria-label={`Copy ID for Tally Sync for ${company.name}`}
                                  onClick={() =>
                                    void copyToClipboard(
                                      company.id,
                                      "Copied Company ID!",
                                    )
                                  }
                                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-500/40 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy ID for Tally Sync
                                </button>
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                                    {company.name}
                                  </h4>
                                  <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-300">
                                    {company.email || "No email"}
                                  </p>
                                  {company.phone ? (
                                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                      {company.phone}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  aria-label={`Delete ${company.name}`}
                                  disabled={busy}
                                  onClick={() => void deleteCompany(company)}
                                  className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                                >
                                  {pendingAction === "company-delete" ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm dark:border-finora-gold/10">
                                <div>
                                  <dt className="text-xs text-slate-500 dark:text-slate-400">GSTIN</dt>
                                  <dd className="mt-0.5 break-all text-slate-800 dark:text-slate-200">{company.gstin || "—"}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500 dark:text-slate-400">Created</dt>
                                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">{formatDate(company.created_at)}</dd>
                                </div>
                              </dl>
                            </article>
                          ))}
                        >
                          {companies.map((company) => (
                            <tr key={company.id} className="transition-colors hover:bg-blue-50/60 dark:hover:bg-[#0F172A]/40">
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                {company.name}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex min-w-56 items-center gap-2">
                                  <span
                                    title={company.id}
                                    className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                  >
                                    {company.id.slice(0, 8)}...
                                  </span>
                                  <button
                                    type="button"
                                    title="Paste this Company ID into your local tally_sync.py or .env file to sync data."
                                    aria-label={`Copy ID for Tally Sync for ${company.name}`}
                                    onClick={() =>
                                      void copyToClipboard(
                                        company.id,
                                        "Copied Company ID!",
                                      )
                                    }
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition hover:border-blue-500/40 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy ID
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                {company.gstin || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                <span className="block">{company.email || "—"}</span>
                                {company.phone && (
                                  <span className="text-xs text-slate-400">
                                    {company.phone}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                {formatDate(company.created_at)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  title={`Delete ${company.name}`}
                                  aria-label={`Delete ${company.name}`}
                                  disabled={busy}
                                  onClick={() => void deleteCompany(company)}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                                >
                                  {pendingAction === "company-delete" ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </DataTable>
                      </div>
                    )}

                    {activeTab === "users" && (
                      <div className="space-y-7">
                        <DirectoryError message={directoryErrors.users} />
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Provision an account
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Accounts are created by an administrator and confirmed immediately.
                          </p>
                          <form
                            onSubmit={createUser}
                            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                          >
                            <label>
                              <span className={labelClassName}>Full name</span>
                              <input
                                className={inputClassName}
                                name="full_name"
                                required
                                maxLength={120}
                                autoComplete="name"
                                placeholder="Jordan Lee"
                              />
                            </label>
                            <label>
                              <span className={labelClassName}>Email</span>
                              <input
                                className={inputClassName}
                                name="email"
                                required
                                type="email"
                                autoComplete="email"
                                placeholder="jordan@example.com"
                              />
                            </label>
                            <label>
                              <span className={labelClassName}>Temporary password</span>
                              <input
                                className={inputClassName}
                                name="password"
                                required
                                type="password"
                                minLength={8}
                                autoComplete="new-password"
                              />
                            </label>
                            <label>
                              <span className={labelClassName}>Account type</span>
                              <select
                                className={inputClassName}
                                name="role"
                                value={newUserRole}
                                onChange={(event) => setNewUserRole(event.target.value as UserRole)}
                              >
                                <option value="admin">Admin</option>
                                <option value="employee">Employee</option>
                                <option value="company">Company / Client</option>
                              </select>
                            </label>
                            <label>
                              <span className={labelClassName}>
                                {newUserRole === "company"
                                  ? "Client company"
                                  : "Assign to company (optional)"}
                              </span>
                              <select
                                className={inputClassName}
                                name="company_id"
                                defaultValue=""
                                required={newUserRole === "company"}
                              >
                                <option value="">
                                  {newUserRole === "company"
                                    ? "Select a company"
                                    : "No company assignment"}
                                </option>
                                {companies.map((company) => (
                                  <option key={company.id} value={company.id}>
                                    {company.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="flex items-end">
                              <button className={buttonClassName} disabled={busy}>
                                {pendingAction === "account" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserPlus className="h-4 w-4" />
                                )}
                                {pendingAction === "account"
                                  ? "Provisioning Account..."
                                  : "Create account"}
                              </button>
                            </div>
                          </form>
                        </div>
                        <DataTable
                          title="User directory"
                          count={profiles.length}
                          headers={["User", "Email", "Role", "Created", "Status", "Actions"]}
                          emptyText="No user profiles have been created yet."
                          mobileContent={profiles.map((profile) => (
                            <article
                              key={profile.id}
                              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-lg active:translate-y-0 dark:border-finora-gold/15 dark:bg-finora-dark/50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-finora-gold/25 bg-finora-gold/10 text-sm font-semibold text-finora-gold-dark dark:text-finora-gold">
                                    {(profile.full_name || profile.email || "?")
                                      .slice(0, 1)
                                      .toUpperCase()}
                                  </span>
                                  <div className="min-w-0">
                                    <h4 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                                      {profile.full_name || "Unnamed user"}
                                    </h4>
                                    <p className="break-all text-sm text-slate-600 dark:text-slate-300">
                                      {profile.email}
                                    </p>
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-sky-300">
                                  {roleLabel(profile.role)}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-finora-gold/10">
                                <span className="text-slate-500 dark:text-slate-400">Created {formatDate(profile.created_at)}</span>
                                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {profile.role !== "admin" ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void revokeUserAccess(profile)}
                                    className={rowActionClassName}
                                  >
                                    {pendingAction === "access-revoke" ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <UserRoundX className="h-3.5 w-3.5" />
                                    )}
                                    {pendingAction === "access-revoke"
                                      ? "Revoking Access..."
                                      : "Revoke access"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void deleteUser(profile)}
                                  className={rowActionClassName}
                                >
                                  {pendingAction === "user-delete" ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                  {pendingAction === "user-delete"
                                    ? "Deleting Account..."
                                    : "Delete account"}
                                </button>
                              </div>
                            </article>
                          ))}
                        >
                          {profiles.map((profile) => (
                            <tr key={profile.id} className="transition-colors hover:bg-blue-50/60 dark:hover:bg-[#0F172A]/40">
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                {profile.full_name || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                {profile.email}
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-sky-300">
                                  {roleLabel(profile.role)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                {formatDate(profile.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {profile.role !== "admin" && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void revokeUserAccess(profile)}
                                      className={rowActionClassName}
                                    >
                                      {pendingAction === "access-revoke" ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <UserRoundX className="h-3.5 w-3.5" />
                                      )}
                                      {pendingAction === "access-revoke"
                                        ? "Revoking Access..."
                                        : "Revoke access"}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void deleteUser(profile)}
                                    className={rowActionClassName}
                                  >
                                    {pendingAction === "user-delete" ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                    {pendingAction === "user-delete"
                                      ? "Deleting Account..."
                                      : "Delete account"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </DataTable>
                      </div>
                    )}

                    {activeTab === "assignments" && (
                      <div className="space-y-7">
                        <DirectoryError message={directoryErrors.assignments} />
                        <DirectoryError message={assignmentWarning} />
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Assign an employee
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Connect an accountant with a client company they maintain.
                          </p>
                          <form
                            onSubmit={createAssignment}
                            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                          >
                            <label>
                              <span className={labelClassName}>Employee</span>
                              <select
                                className={inputClassName}
                                name="employee_id"
                                required
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  Select an employee
                                </option>
                                {employees.map((employee) => (
                                  <option key={employee.id} value={employee.id}>
                                    {employee.full_name || employee.email}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className={labelClassName}>Company</span>
                              <select
                                className={inputClassName}
                                name="company_id"
                                required
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  Select a company
                                </option>
                                {companies.map((company) => (
                                  <option key={company.id} value={company.id}>
                                    {company.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="flex items-end">
                              <button
                                className={buttonClassName}
                                disabled={busy || employees.length === 0 || companies.length === 0}
                              >
                                {pendingAction === "assignment" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                                {pendingAction === "assignment"
                                  ? "Creating Assignment..."
                                  : "Create assignment"}
                              </button>
                            </div>
                          </form>
                        </div>
                        <DataTable
                          title="Current assignments"
                          count={assignments.length}
                          headers={["Employee", "Company", "Entry status", "Actions"]}
                          emptyText="No employee-company assignments yet."
                          mobileContent={assignments.map((assignment) => {
                            const employee = profiles.find(
                              (profile) => profile.id === assignment.employee_id,
                            );
                            const company = companies.find(
                              (item) => item.id === assignment.company_id,
                            );
                            return (
                              <article
                                key={assignment.id}
                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-lg active:translate-y-0 dark:border-finora-gold/15 dark:bg-finora-dark/50"
                              >
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Employee</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                      {employee?.full_name || employee?.email || "Unknown employee"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Company</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                      {company?.name || "Unknown company"}
                                    </p>
                                  </div>
                                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    {assignment.entry_status}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-finora-gold/10">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void removeAssignment(assignment)}
                                    className={rowActionClassName}
                                  >
                                    {pendingAction === "assignment-revoke" ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <UserRoundX className="h-3.5 w-3.5" />
                                    )}
                                    {pendingAction === "assignment-revoke"
                                      ? "Revoking Access..."
                                      : "Revoke"}
                                  </button>
                                  {employee ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void deleteUser(employee)}
                                      className={rowActionClassName}
                                    >
                                      {pendingAction === "user-delete" ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                      {pendingAction === "user-delete"
                                        ? "Deleting Account..."
                                        : "Delete account"}
                                    </button>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })}
                        >
                          {assignments.map((assignment) => {
                            const employee = profiles.find(
                              (profile) => profile.id === assignment.employee_id,
                            );
                            const company = companies.find(
                              (item) => item.id === assignment.company_id,
                            );
                            return (
                              <tr key={assignment.id} className="transition-colors hover:bg-blue-50/60 dark:hover:bg-[#0F172A]/40">
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                  {employee?.full_name || employee?.email || "Unknown employee"}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                  {company?.name || "Unknown company"}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    {assignment.entry_status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void removeAssignment(assignment)}
                                      className={rowActionClassName}
                                    >
                                      {pendingAction === "assignment-revoke" ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <UserRoundX className="h-3.5 w-3.5" />
                                      )}
                                      {pendingAction === "assignment-revoke"
                                        ? "Revoking Access..."
                                        : "Revoke"}
                                    </button>
                                    {employee && (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void deleteUser(employee)}
                                        className={rowActionClassName}
                                      >
                                        {pendingAction === "user-delete" ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                        {pendingAction === "user-delete"
                                          ? "Deleting Account..."
                                          : "Delete account"}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </DataTable>
                      </div>
                    )}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        </motion.main>
      </div>
    </AuthGuard>
  );
}

function DataTable({
  title,
  count,
  headers,
  emptyText,
  mobileContent,
  children,
}: {
  title: string;
  count: number;
  headers: string[];
  emptyText: string;
  mobileContent: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {count} {count === 1 ? "record" : "records"}
        </span>
      </div>
      <div className="hidden w-full overflow-x-auto scrollbar-thin scrollbar-thumb-amber-500/20 rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B] sm:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-[#334155]">
          <thead className="bg-slate-50 dark:bg-[#1E293B]">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  scope="col"
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-[#F8FAFC] dark:divide-[#334155] dark:bg-[#1E293B]">
            {count === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 sm:hidden">
        {count > 0 ? (
          mobileContent
        ) : (
          <p className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-8 text-center text-sm text-slate-500 dark:border-finora-gold/15 dark:bg-finora-surface/70 dark:text-slate-400">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function DirectoryError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
    >
      Admin data warning: {message}
    </div>
  );
}
