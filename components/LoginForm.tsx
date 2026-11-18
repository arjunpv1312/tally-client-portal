"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, LogIn, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RoleSelector } from "@/components/RoleSelector";
import { redirectPathForRole, tabToExpectedRole } from "@/lib/auth-redirect";
import {
  fetchProfileRole,
  getSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase";
import type { LoginRoleTab } from "@/types";

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("email not confirmed") ||
    lower.includes("invalid email or password")
  ) {
    return "Invalid email or password.";
  }
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const [roleTab, setRoleTab] = useState<LoginRoleTab>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reportError(message: string) {
    setError(message);
    toast.error(message);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      reportError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError) {
        reportError(friendlyAuthError(authError.message));
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        reportError("Sign-in succeeded but no user was returned.");
        return;
      }

      const profileRole = await fetchProfileRole(userId);
      if (!profileRole) {
        await supabase.auth.signOut();
        reportError(
          "No profile found for this account. Contact your administrator.",
        );
        return;
      }

      if (profileRole !== tabToExpectedRole(roleTab)) {
        await supabase.auth.signOut();
        reportError("Invalid role selected for this account");
        return;
      }

      router.push(redirectPathForRole(profileRole));
      router.refresh();
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-xl backdrop-blur-xl transition-all duration-300 hover:shadow-gold-glow dark:border-finora-gold/20 dark:bg-finora-surface/75 dark:shadow-black/30"
    >
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-[#F8F4E8]">
          Welcome to FINORA
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Accounting &amp; Business Solutions
        </p>
      </div>

      <RoleSelector value={roleTab} onChange={setRoleTab} />

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </span>
          <span className="relative flex items-center">
            <Mail className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-finora-gold/30 transition focus:border-finora-gold-dark focus:ring-2 dark:border-finora-gold/20 dark:bg-finora-dark/70 dark:text-slate-50 dark:focus:border-finora-gold dark:focus:ring-finora-gold/30"
              placeholder="you@company.com"
            />
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Password
          </span>
          <span className="relative flex items-center">
            <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-finora-gold/30 transition focus:border-finora-gold-dark focus:ring-2 dark:border-finora-gold/20 dark:bg-finora-dark/70 dark:text-slate-50 dark:focus:border-finora-gold dark:focus:ring-finora-gold/30"
              placeholder="••••••••"
            />
          </span>
        </label>
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key={error}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E5C365] via-[#F5E4AA] to-[#D4AF37] py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-gold-glow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Logging in...
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Sign in
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        No public registration. Accounts are created in the Admin panel only.
      </p>
    </motion.form>
  );
}
