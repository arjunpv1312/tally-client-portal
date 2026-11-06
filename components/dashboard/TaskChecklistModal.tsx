"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase";
import { saveEmployeeTasks } from "@/lib/employee-work-logs";

type TaskChecklistModalProps = {
  workLogId: string | null;
  onClose: () => void;
  onLogout: () => Promise<void>;
};

function parseTasks(value: string) {
  return value
    .split("\n")
    .map((task) => task.trim())
    .filter(Boolean);
}

export function TaskChecklistModal({
  workLogId,
  onClose,
  onLogout,
}: TaskChecklistModalProps) {
  const [completedTasks, setCompletedTasks] = useState("");
  const [pendingWork, setPendingWork] = useState("");
  const [loading, setLoading] = useState(Boolean(workLogId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!workLogId) return;

    void (async () => {
      try {
        const { data, error: loadError } = await getBrowserSupabase()
          .from("employee_work_logs")
          .select("completed_tasks, pending_work")
          .eq("id", workLogId)
          .maybeSingle();
        if (cancelled) return;
        if (loadError) {
          setError(loadError.message);
        } else if (data) {
          setCompletedTasks((data.completed_tasks ?? []).join("\n"));
          setPendingWork((data.pending_work ?? []).join("\n"));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load saved tasks.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workLogId]);

  async function save(logoutAfterSave: boolean) {
    if (!workLogId && !logoutAfterSave) {
      setError("No active employee work log is available.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (workLogId) {
        await saveEmployeeTasks(
          workLogId,
          parseTasks(completedTasks),
          parseTasks(pendingWork),
        );
      }
      if (logoutAfterSave) await onLogout();
      else onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the task checklist.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-checklist-title"
        className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0F172A] p-5 text-slate-100 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="task-checklist-title" className="text-xl font-semibold">
              End-of-shift checklist
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Record completed tasks and work to hand off before signing out.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close checklist"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading saved tasks…</p>
        ) : (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Completed Tasks
              <textarea
                rows={4}
                value={completedTasks}
                onChange={(event) => setCompletedTasks(event.target.value)}
                placeholder="One task per line"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Pending Work
              <textarea
                rows={4}
                value={pendingWork}
                onChange={(event) => setPendingWork(event.target.value)}
                placeholder="One item per line"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </label>
          </div>
        )}

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-950/50 p-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
          >
            Stay signed in
          </button>
          <button
            type="button"
            disabled={saving || loading || !workLogId}
            onClick={() => void save(false)}
            className="min-h-11 rounded-xl border border-blue-400/40 px-4 text-sm font-semibold text-blue-200 hover:bg-blue-400/10 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save tasks"}
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save(true)}
            className="min-h-11 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Log Out"}
          </button>
        </div>
      </section>
    </div>
  );
}
