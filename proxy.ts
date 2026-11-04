import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types";

const protectedRoutes: Record<UserRole, string> = {
  admin: "/admin",
  employee: "/employee",
  company: "/dashboard",
};

function isUserRole(role: unknown): role is UserRole {
  return role === "admin" || role === "employee" || role === "company";
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  path: string,
) {
  const destination = request.nextUrl.clone();
  destination.pathname = path;
  destination.search = "";

  const redirectResponse = NextResponse.redirect(destination);
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return redirectWithCookies(request, NextResponse.next(), "/login");
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return redirectWithCookies(request, response, "/login");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !isUserRole(profile?.role)) {
      return redirectWithCookies(request, response, "/login");
    }

    const allowedPath = protectedRoutes[profile.role];
    if (
      request.nextUrl.pathname !== allowedPath &&
      !request.nextUrl.pathname.startsWith(`${allowedPath}/`)
    ) {
      return redirectWithCookies(request, response, allowedPath);
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: "Access verification is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}

export const config = {
  matcher: ["/admin/:path*", "/employee/:path*", "/dashboard/:path*"],
};
