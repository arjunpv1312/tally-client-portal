"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLoadingSkeleton, SpinnerRing } from "@/components/LoadingSkeleton";
import { fetchProfileRole, getSupabase } from "@/lib/supabase";
import { redirectPathForRole } from "@/lib/auth-redirect";
import type { UserRole } from "@/types";

type AuthGuardProps = {
  allow: UserRole;
  children: React.ReactNode;
};

export function AuthGuard({ allow, children }: AuthGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw new Error(error.message);
      const user = data.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const role = await fetchProfileRole(user.id);
      if (!role || role !== allow) {
        router.replace(role ? redirectPathForRole(role) : "/login");
        return;
      }

      if (!cancelled) setReady(true);
    }

    verify().catch((error: unknown) => {
      if (!cancelled) {
        setVerificationError(
          error instanceof Error
            ? error.message
            : "Unable to verify your account. Sign in again.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [allow, router]);

  if (!ready) {
    if (verificationError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-[#0F172A]">
          <section className="w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
            <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">
              {verificationError}
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-[#60A5FA] dark:text-slate-950"
            >
              Return to sign in
            </Link>
          </section>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 dark:bg-[#0F172A]">
        <SpinnerRing />
        <div className="w-full max-w-3xl">
          <DashboardLoadingSkeleton />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
