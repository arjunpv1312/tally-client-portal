"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const role = await fetchProfileRole(session.user.id);
      if (!role || role !== allow) {
        router.replace(role ? redirectPathForRole(role) : "/login");
        return;
      }

      if (!cancelled) setReady(true);
    }

    verify().catch(() => router.replace("/login"));

    return () => {
      cancelled = true;
    };
  }, [allow, router]);

  if (!ready) {
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
