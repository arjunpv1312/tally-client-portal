"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase";
import {
  closeEmployeeWorkLog,
  EMPLOYEE_COMPANY_CHANGED_EVENT,
  getSelectedEmployeeCompanyId,
  setActiveEmployeeWorkLog,
} from "@/lib/employee-work-logs";

type AssignmentRow = {
  company_id: string;
};

export function EmployeeActivityTracker() {
  const userIdRef = useRef<string | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let disposed = false;
    let selectedCompanyId = getSelectedEmployeeCompanyId();

    async function getCompanyIds(userId: string) {
      let result = await supabase
        .from("company_employees")
        .select("company_id")
        .eq("employee_id", userId)
        .returns<AssignmentRow[]>();
      if (result.error) {
        result = await supabase
          .from("company_employees")
          .select("company_id")
          .eq("user_id", userId)
          .returns<AssignmentRow[]>();
      }
      if (result.error) throw new Error(result.error.message);
      return [...new Set((result.data ?? []).map((row) => row.company_id))];
    }

    async function startWorkLog(userId: string, preferredCompanyId?: string | null) {
      if (disposed || startingRef.current || userIdRef.current !== userId) return;
      startingRef.current = true;
      try {
        const { data: existingSession, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message);
        const accessToken = existingSession.session?.access_token;
        if (!accessToken) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .returns<{ role: string }[]>()
          .maybeSingle();
        if (profileError) throw new Error(profileError.message);
        if (profile?.role !== "employee") return;

        const companyIds = await getCompanyIds(userId);
        if (companyIds.length === 0) return;
        const companyId =
          preferredCompanyId && companyIds.includes(preferredCompanyId)
            ? preferredCompanyId
            : selectedCompanyId && companyIds.includes(selectedCompanyId)
              ? selectedCompanyId
              : companyIds[0];

        const { data: existingLogId } = getStoredLog(userId);
        if (existingLogId) {
          const { data: existingLog, error } = await supabase
            .from("employee_work_logs")
            .select("id, company_id, login_time, logout_time")
            .eq("id", existingLogId)
            .eq("user_id", userId)
            .returns<{
              id: string;
              company_id: string;
              login_time: string;
              logout_time: string | null;
            }[]>()
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (existingLog && !existingLog.logout_time) {
            selectedCompanyId = existingLog.company_id;
            setActiveEmployeeWorkLog(userId, existingLog.login_time, {
              id: existingLog.id,
              companyId: existingLog.company_id,
            });
            return;
          }
        }

        if (disposed || userIdRef.current !== userId) return;
        const { data: createdLog, error: insertError } = await supabase
          .from("employee_work_logs")
          .insert({ user_id: userId, company_id: companyId })
          .select("id, login_time")
          .returns<{ id: string; login_time: string }[]>()
          .single();
        if (insertError) throw new Error(insertError.message);
        if (!createdLog) throw new Error("The employee work log was not returned.");
        selectedCompanyId = companyId;
        setActiveEmployeeWorkLog(userId, createdLog.login_time, {
          id: createdLog.id,
          companyId,
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Unable to record employee activity: ${error.message}`
            : "Unable to record employee activity.",
        );
      } finally {
        startingRef.current = false;
      }
    }

    function getStoredLog(userId: string) {
      const id = sessionStorage.getItem("finora-active-work-log-id");
      const storedUserId = sessionStorage.getItem("finora-active-work-log-user-id");
      return { data: id && storedUserId === userId ? id : null };
    }

    function handlePageHide() {
      void closeEmployeeWorkLog(true).catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? `Unable to close employee work log: ${error.message}`
            : "Unable to close employee work log.",
        );
      });
    }

    function handleCompanyChange(event: Event) {
      const nextCompanyId = (event as CustomEvent<string>).detail;
      if (!nextCompanyId || nextCompanyId === selectedCompanyId) return;
      const userId = userIdRef.current;
      if (!userId) return;
      selectedCompanyId = nextCompanyId;
      void closeEmployeeWorkLog()
        .then(() => startWorkLog(userId, nextCompanyId))
        .catch((error: unknown) => {
          toast.error(
            error instanceof Error
              ? `Unable to switch employee work log: ${error.message}`
              : "Unable to switch employee work log.",
          );
        });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (nextUserId === userIdRef.current) return;
      userIdRef.current = nextUserId;
      if (nextUserId) {
        queueMicrotask(() => void startWorkLog(nextUserId));
      }
    });
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener(EMPLOYEE_COMPANY_CHANGED_EVENT, handleCompanyChange);

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        toast.error(`Unable to check employee session: ${error.message}`);
        return;
      }
      const nextUserId = data.session?.user.id ?? null;
      userIdRef.current = nextUserId;
      if (nextUserId) void startWorkLog(nextUserId);
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener(
        EMPLOYEE_COMPANY_CHANGED_EVENT,
        handleCompanyChange,
      );
    };
  }, []);

  return null;
}
