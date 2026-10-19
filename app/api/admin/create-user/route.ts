import { createClient } from "@supabase/supabase-js";

type CreateUserRequest = {
  email?: unknown;
  password?: unknown;
  full_name?: unknown;
  role?: unknown;
  company_id?: unknown;
};

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError(
      "Server configuration error: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      500,
    );
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return jsonError("Authentication required.", 401);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  if (
    !parsedBody ||
    typeof parsedBody !== "object" ||
    Array.isArray(parsedBody)
  ) {
    return jsonError("Request body must be a JSON object.", 400);
  }
  const body = parsedBody as CreateUserRequest;

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const role = body.role;
  if (
    body.company_id !== undefined &&
    body.company_id !== null &&
    typeof body.company_id !== "string"
  ) {
    return jsonError("company_id must be a string.", 400);
  }
  const companyId = typeof body.company_id === "string" ? body.company_id.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("A valid email address is required.", 400);
  }
  if (password.length < 8) {
    return jsonError("Password must be at least 8 characters long.", 400);
  }
  if (!fullName) {
    return jsonError("Full name is required.", 400);
  }
  if (role !== "employee" && role !== "company") {
    return jsonError("Role must be either 'employee' or 'company'.", 400);
  }
  if (companyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
    return jsonError("company_id must be a valid UUID.", 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonError("Your session is invalid or expired.", 401);
  }

  const { data: adminProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileLookupError) {
    return jsonError(`Unable to verify administrator access: ${profileLookupError.message}`, 500);
  }
  if (adminProfile?.role !== "admin") {
    return jsonError("Administrator access required.", 403);
  }

  if (companyId) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) {
      return jsonError(`Unable to validate company: ${companyError.message}`, 500);
    }
    if (!company) {
      return jsonError("The selected company does not exist.", 400);
    }
  }

  const { data: createdUser, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

  if (createError) {
    return jsonError(`Unable to create authentication user: ${createError.message}`, 400);
  }
  if (!createdUser.user) {
    return jsonError("Supabase did not return the created user.", 500);
  }

  const { error: insertProfileError } = await supabase.from("profiles").insert({
    id: createdUser.user.id,
    email,
    full_name: fullName,
    role,
  });

  if (insertProfileError) {
    const { error: cleanupError } = await supabase.auth.admin.deleteUser(
      createdUser.user.id,
    );
    const cleanupDetail = cleanupError
      ? ` Authentication-user cleanup also failed: ${cleanupError.message}`
      : "";
    return jsonError(
      `Unable to create user profile: ${insertProfileError.message}.${cleanupDetail}`,
      500,
    );
  }

  if (role === "company" && companyId) {
    const { error: updateCompanyError } = await supabase
      .from("profiles")
      .update({ company_id: companyId })
      .eq("id", createdUser.user.id);

    if (updateCompanyError) {
      const { error: cleanupProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", createdUser.user.id);
      const { error: cleanupUserError } = await supabase.auth.admin.deleteUser(
        createdUser.user.id,
      );
      const cleanupDetails = [
        cleanupProfileError
          ? ` Profile cleanup failed: ${cleanupProfileError.message}`
          : "",
        cleanupUserError ? ` Authentication-user cleanup failed: ${cleanupUserError.message}` : "",
      ].join("");
      return jsonError(
        `Unable to associate user with company: ${updateCompanyError.message}.${cleanupDetails}`,
        500,
      );
    }
  }

  return Response.json({ success: true }, { status: 201 });
}
