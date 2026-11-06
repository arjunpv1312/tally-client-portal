"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";

export function LogoutButton({
  onBeforeLogout,
}: {
  onBeforeLogout?: () => Promise<boolean>;
}) {
  const router = useRouter();

  async function handleLogout() {
    try {
      if (onBeforeLogout && !(await onBeforeLogout())) return;
      const supabase = getSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) toast.error(`Logout failed: ${error.message}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? `Logout failed: ${error.message}` : "Logout failed. Please try again.",
      );
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-finora-gold/20 dark:bg-finora-surface dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
