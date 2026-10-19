import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  const options = {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
      detectSessionInUrl: typeof window !== "undefined",
    },
  };

  if (typeof window === "undefined") {
    return createClient(supabaseUrl, supabaseAnonKey, options);
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, options);
  }

  return browserClient;
}

export const supabase = {
  get auth() {
    return getSupabase().auth;
  },
  from: (...args: Parameters<SupabaseClient["from"]>) =>
    getSupabase().from(...args),
};

export async function fetchProfileRole(
  userId: string,
): Promise<UserRole | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.role) return null;
  return data.role as UserRole;
}
