"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) toast.error(`Logout failed: ${error.message}`);
    } catch {
      toast.error("Logout failed. Please try again.");
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-[#334155] dark:bg-[#1E293B] dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
