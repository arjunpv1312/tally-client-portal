import "server-only";

import { getAdminSupabase } from "@/lib/supabase-admin";

type RevokeAccessRequest = {
  assignment_id?: unknown;
  user_id?: unknown;
  company_id?: unknown;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

async function revokeAccess(request: Request) {
  const accessToken = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return jsonError("Authentication required.", 401);

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return jsonError("Request body must be a JSON object.", 400);
  }
  const body = parsedBody as RevokeAccessRequest;

  const assignmentId =
    typeof body.assignment_id === "string" ? body.assignment_id.trim() : "";
  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const companyId =
    typeof body.company_id === "string" ? body.company_id.trim() : "";
  if (assignmentId) {
    if (!uuidPattern.test(assignmentId)) {
      return jsonError("assignment_id must be a valid UUID.", 400);
    }
  } else if (!userId || !uuidPattern.test(userId)) {
    return jsonError("Provide a valid assignment_id or user_id.", 400);
  }
  if (body.company_id !== undefined && body.company_id !== null && !companyId) {
    return jsonError("company_id must be a valid UUID.", 400);
  }
  if (companyId && !uuidPattern.test(companyId)) {
    return jsonError("company_id must be a valid UUID.", 400);
  }

  const supabase = getAdminSupabase();
  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonError("Your session is invalid or expired.", 401);
  }
  const { data: adminProfile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .returns<{ role: string }[]>()
    .maybeSingle();
  if (profileError) {
    return jsonError(`Unable to verify administrator access: ${profileError.message}`, 500);
  }
  if (adminProfile?.role !== "admin") {
    return jsonError("Administrator access required.", 403);
  }

  if (assignmentId) {
    const { error } = await supabase
      .from("company_employees")
      .delete()
      .eq("id", assignmentId);
    if (error) {
      return jsonError(`Unable to revoke assignment: ${error.message}`, 500);
    }
    return Response.json({ success: true });
  }

  let deleteQuery = supabase.from("company_employees").delete();
  deleteQuery = companyId
    ? deleteQuery.eq("company_id", companyId)
    : deleteQuery;
  let { error: assignmentError } = await deleteQuery.eq("user_id", userId);
  if (
    assignmentError &&
    /user_id/i.test(assignmentError.message) &&
    /(column|schema cache|does not exist|could not find)/i.test(
      assignmentError.message,
    )
  ) {
    let legacyDeleteQuery = supabase.from("company_employees").delete();
    legacyDeleteQuery = companyId
      ? legacyDeleteQuery.eq("company_id", companyId)
      : legacyDeleteQuery;
    const legacyResult = await legacyDeleteQuery.eq("employee_id", userId);
    assignmentError = legacyResult.error;
  }
  if (assignmentError) {
    return jsonError(`Unable to revoke company assignment: ${assignmentError.message}`, 500);
  }

  let profileQuery = supabase
    .from("profiles")
    .update({ company_id: null })
    .eq("id", userId);
  if (companyId) profileQuery = profileQuery.eq("company_id", companyId);
  const { error: profileUpdateError } = await profileQuery;
  if (profileUpdateError) {
    return jsonError(`Unable to revoke client company access: ${profileUpdateError.message}`, 500);
  }

  return Response.json({ success: true });
}

export async function POST(request: Request) {
  try {
    return await revokeAccess(request);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to revoke company access.",
      500,
    );
  }
}
