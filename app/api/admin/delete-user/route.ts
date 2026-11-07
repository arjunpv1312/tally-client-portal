import "server-only";

import { getAdminSupabase } from "@/lib/supabase-admin";

type DeleteUserRequest = {
  user_id?: unknown;
};

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

async function deleteUser(request: Request) {
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
  const body = parsedBody as DeleteUserRequest;

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return jsonError("user_id must be a valid UUID.", 400);
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
  if (userId === authData.user.id) {
    return jsonError("You cannot delete your own administrator account.", 400);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    return jsonError(`Unable to delete user account: ${deleteError.message}`, 500);
  }

  return Response.json({ success: true });
}

export async function POST(request: Request) {
  try {
    return await deleteUser(request);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to delete user account.",
      500,
    );
  }
}

export async function DELETE(request: Request) {
  return POST(request);
}
