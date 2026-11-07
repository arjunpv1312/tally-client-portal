import { getBrowserSupabase } from "@/lib/supabase";

const WORK_LOG_ID_KEY = "finora-active-work-log-id";
const WORK_LOG_USER_KEY = "finora-active-work-log-user-id";
const WORK_LOG_LOGIN_KEY = "finora-active-work-log-login-time";
const ACTIVE_COMPANY_KEY = "finora-active-company-id";
export const EMPLOYEE_WORK_LOG_CHANGED_EVENT = "finora-work-log-changed";
export const EMPLOYEE_COMPANY_CHANGED_EVENT = "finora-active-company-changed";

export type EmployeeWorkLogState = {
  id: string;
  companyId: string;
};

function publishWorkLog(state: EmployeeWorkLogState | null) {
  window.dispatchEvent(
    new CustomEvent<EmployeeWorkLogState | null>(
      EMPLOYEE_WORK_LOG_CHANGED_EVENT,
      { detail: state },
    ),
  );
}

export function getActiveEmployeeWorkLog(): EmployeeWorkLogState | null {
  const id = sessionStorage.getItem(WORK_LOG_ID_KEY);
  const companyId = sessionStorage.getItem(ACTIVE_COMPANY_KEY);
  return id && companyId ? { id, companyId } : null;
}

export function getSelectedEmployeeCompanyId() {
  return sessionStorage.getItem(ACTIVE_COMPANY_KEY);
}

export function notifyEmployeeCompanyChanged(companyId: string) {
  sessionStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
  window.dispatchEvent(
    new CustomEvent(EMPLOYEE_COMPANY_CHANGED_EVENT, {
      detail: companyId,
    }),
  );
}

export async function saveEmployeeTasks(
  workLogId: string,
  completedTasks: string[],
  pendingWork: string[],
) {
  const { data, error } = await getBrowserSupabase()
    .from("employee_work_logs")
    .update({
      completed_tasks: completedTasks,
      pending_work: pendingWork,
    })
    .eq("id", workLogId)
    .is("logout_time", null)
    .select("id")
    .returns<{ id: string }[]>()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("The active work log was not found or is already closed.");
}

export async function closeEmployeeWorkLog(keepalive = false) {
  const workLogId = sessionStorage.getItem(WORK_LOG_ID_KEY);
  const userId = sessionStorage.getItem(WORK_LOG_USER_KEY);
  const loginTime = sessionStorage.getItem(WORK_LOG_LOGIN_KEY);
  if (!workLogId || !userId || !loginTime) return;

  const loginTimestamp = Date.parse(loginTime);
  if (Number.isNaN(loginTimestamp)) {
    throw new Error("The saved employee work log has an invalid login time.");
  }
  const logoutTime = new Date().toISOString();
  const totalHours =
    Math.round(((Date.parse(logoutTime) - loginTimestamp) / 3_600_000) * 100) /
    100;
  const supabase = getBrowserSupabase();

  if (keepalive) {
    const [{ data, error: sessionError }] = await Promise.all([
      supabase.auth.getSession(),
    ]);
    if (sessionError) throw new Error(sessionError.message);
    const accessToken = data.session?.access_token;
    const apiKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!accessToken || !apiKey || !baseUrl) {
      throw new Error("Unable to authenticate the closing work log.");
    }

    const url = new URL("/rest/v1/employee_work_logs", baseUrl);
    url.searchParams.set("id", `eq.${workLogId}`);
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("logout_time", "is.null");
    const request = fetch(url, {
      method: "PATCH",
      keepalive: true,
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ logout_time: logoutTime, total_hours: totalHours }),
    });
    const response = await request;
    if (!response.ok) {
      throw new Error(`Unable to close employee work log (HTTP ${response.status}).`);
    }
    sessionStorage.removeItem(WORK_LOG_ID_KEY);
    sessionStorage.removeItem(WORK_LOG_USER_KEY);
    sessionStorage.removeItem(WORK_LOG_LOGIN_KEY);
    publishWorkLog(null);
    return;
  }

  const { error } = await supabase
    .from("employee_work_logs")
    .update({ logout_time: logoutTime, total_hours: totalHours })
    .eq("id", workLogId)
    .eq("user_id", userId)
    .is("logout_time", null);
  if (error) throw new Error(error.message);
  sessionStorage.removeItem(WORK_LOG_ID_KEY);
  sessionStorage.removeItem(WORK_LOG_USER_KEY);
  sessionStorage.removeItem(WORK_LOG_LOGIN_KEY);
  publishWorkLog(null);
}

export function setActiveEmployeeWorkLog(
  userId: string,
  loginTime: string,
  state: EmployeeWorkLogState,
) {
  sessionStorage.setItem(WORK_LOG_ID_KEY, state.id);
  sessionStorage.setItem(WORK_LOG_USER_KEY, userId);
  sessionStorage.setItem(WORK_LOG_LOGIN_KEY, loginTime);
  sessionStorage.setItem(ACTIVE_COMPANY_KEY, state.companyId);
  publishWorkLog(state);
}
