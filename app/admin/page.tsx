"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Check,
  ClipboardList,
  LoaderCircle,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { getSupabase } from "@/lib/supabase";
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
  created_at: string | null;
};

type Tab = "companies" | "users" | "assignments";

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
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#60A5FA] dark:text-slate-950 dark:hover:bg-blue-300";

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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newUserRole, setNewUserRole] = useState<"employee" | "company">(
    "employee",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const employees = useMemo(
    () => profiles.filter((profile) => profile.role === "employee"),
    [profiles],
  );
  const refreshDirectory = useCallback(async () => {
    const supabase = getSupabase();
    const [companyResult, profileResult, assignmentResult] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, gstin, email, phone, created_at")
        .order("name"),
      supabase
        .from("profiles")
        .select("id, email, full_name, role, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("company_employees")
        .select("id, employee_id, company_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const queryError =
      companyResult.error ?? profileResult.error ?? assignmentResult.error;
    if (queryError) throw new Error(queryError.message);

    setCompanies((companyResult.data ?? []) as Company[]);
    setProfiles((profileResult.data ?? []) as Profile[]);
    setAssignments((assignmentResult.data ?? []) as Assignment[]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDirectory() {
      try {
        await refreshDirectory();
      } catch (loadError) {
        if (!cancelled) {
          displayActionError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load admin data.",
            setError,
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
    setError("");
    setNotice("");

    try {
      const formData = new FormData(form);
      const { error: insertError } = await getSupabase()
        .from("companies")
        .insert({
          name: String(formData.get("name") ?? "").trim(),
          gstin: String(formData.get("gstin") ?? "").trim() || null,
          email: String(formData.get("email") ?? "").trim() || null,
          phone: String(formData.get("phone") ?? "").trim() || null,
        });
      if (insertError) throw new Error(insertError.message);
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
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const role = String(formData.get("role")) as "employee" | "company";
    try {
      const { data: sessionData, error: sessionError } =
        await getSupabase().auth.getSession();
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
          company_id:
            role === "company" ? String(formData.get("company_id") ?? "") : null,
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
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await getSupabase()
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
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData(form);
      const { error: insertError } = await getSupabase()
        .from("company_employees")
        .insert({
          employee_id: String(formData.get("employee_id") ?? ""),
          company_id: String(formData.get("company_id") ?? ""),
        });
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
    }
  }

  async function removeAssignment(assignment: Assignment) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await getSupabase()
        .from("company_employees")
        .delete()
        .eq("id", assignment.id);
      if (deleteError) throw new Error(deleteError.message);
      await completeAction("Assignment removed.");
    } catch (actionError) {
      displayActionError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to remove the assignment.",
        setError,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGuard allow="admin">
      <div className="min-h-screen bg-white dark:bg-[#0F172A]">
        <AppHeader
          title="Admin Dashboard"
          subtitle="Manage client companies, user access, and team assignments"
        />
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <section className="grid gap-4 sm:grid-cols-3">
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
                className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm dark:border-[#334155] dark:bg-[#1E293B]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {label}
                  </p>
                  <Icon className="h-5 w-5 text-blue-600 dark:text-[#60A5FA]" />
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
              {loading ? (
                <div className="flex min-h-48 items-center justify-center text-slate-500">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  <span className="ml-2 text-sm">Loading admin workspace…</span>
                </div>
              ) : (
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
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Create a company
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Add a client organization to the reporting workspace.
                          </p>
                          <form
                            onSubmit={createCompany}
                            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
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
                                {busy ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                                Add company
                              </button>
                            </div>
                          </form>
                        </div>
                        <DataTable
                          title="Company directory"
                          count={companies.length}
                          headers={["Company", "GSTIN", "Contact", "Created", ""]}
                          emptyText="No companies have been added yet."
                        >
                          {companies.map((company) => (
                            <tr key={company.id}>
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                {company.name}
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
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </DataTable>
                      </div>
                    )}

                    {activeTab === "users" && (
                      <div className="space-y-7">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Provision an account
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Accounts are created by an administrator and confirmed immediately.
                          </p>
                          <form
                            onSubmit={createUser}
                            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
                                onChange={(event) =>
                                  setNewUserRole(
                                    event.target.value as "employee" | "company",
                                  )
                                }
                              >
                                <option value="employee">Employee</option>
                                <option value="company">Client company</option>
                              </select>
                            </label>
                            <label>
                              <span className={labelClassName}>Client company</span>
                              <select
                                className={inputClassName}
                                name="company_id"
                                defaultValue=""
                                required={newUserRole === "company"}
                              >
                                <option value="">Select a company (for clients)</option>
                                {companies.map((company) => (
                                  <option key={company.id} value={company.id}>
                                    {company.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="flex items-end">
                              <button className={buttonClassName} disabled={busy}>
                                {busy ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserPlus className="h-4 w-4" />
                                )}
                                Create account
                              </button>
                            </div>
                          </form>
                        </div>
                        <DataTable
                          title="User directory"
                          count={profiles.length}
                          headers={["User", "Email", "Role", "Created", "Status"]}
                          emptyText="No user profiles have been created yet."
                        >
                          {profiles.map((profile) => (
                            <tr key={profile.id}>
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
                            </tr>
                          ))}
                        </DataTable>
                      </div>
                    )}

                    {activeTab === "assignments" && (
                      <div className="space-y-7">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Assign an employee
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Connect an accountant with a client company they maintain.
                          </p>
                          <form
                            onSubmit={createAssignment}
                            className="mt-4 grid gap-4 sm:grid-cols-3"
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
                                {busy ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                                Create assignment
                              </button>
                            </div>
                          </form>
                        </div>
                        <DataTable
                          title="Current assignments"
                          count={assignments.length}
                          headers={["Employee", "Company", "Assigned", ""]}
                          emptyText="No employee-company assignments yet."
                        >
                          {assignments.map((assignment) => {
                            const employee = profiles.find(
                              (profile) => profile.id === assignment.employee_id,
                            );
                            const company = companies.find(
                              (item) => item.id === assignment.company_id,
                            );
                            return (
                              <tr key={assignment.id}>
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                  {employee?.full_name || employee?.email || "Unknown employee"}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                  {company?.name || "Unknown company"}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                  {formatDate(assignment.created_at)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    title="Unassign employee"
                                    aria-label="Unassign employee"
                                    disabled={busy}
                                    onClick={() => void removeAssignment(assignment)}
                                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </DataTable>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}

function DataTable({
  title,
  count,
  headers,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  headers: string[];
  emptyText: string;
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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-[#F8FAFC] shadow-sm dark:border-[#334155] dark:bg-[#1E293B]">
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
    </section>
  );
}
