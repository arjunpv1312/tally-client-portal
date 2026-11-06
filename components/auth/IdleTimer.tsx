"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { closeEmployeeWorkLog } from "@/lib/employee-work-logs";

const WARNING_AFTER_MS = 25 * 60 * 1000;
const LOGOUT_AFTER_MS = 30 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;

function clearStoredAuthTokens() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const authKeys = Object.keys(storage).filter(
      (key) => key.startsWith("sb-") && key.includes("-auth-token"),
    );
    for (const key of authKeys) storage.removeItem(key);
  }
}

export function IdleTimer() {
  const [showWarning, setShowWarning] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const lastActivityAtRef = useRef(0);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getBrowserSupabase();

    function clearTimers() {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      warningTimerRef.current = null;
      logoutTimerRef.current = null;
    }

    function startTimers() {
      clearTimers();
      setShowWarning(false);
      if (!userIdRef.current || loggingOutRef.current) return;

      warningTimerRef.current = setTimeout(() => {
        setShowWarning(true);
      }, WARNING_AFTER_MS);
      logoutTimerRef.current = setTimeout(() => {
        void expireSession();
      }, LOGOUT_AFTER_MS);
    }

    async function expireSession() {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      clearTimers();

      try {
        await closeEmployeeWorkLog();
      } catch (workLogError) {
        toast.error(
          workLogError instanceof Error
            ? `Unable to close employee work log: ${workLogError.message}`
            : "Unable to close employee work log.",
        );
      }

      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          toast.error(`Automatic sign-out failed: ${error.message}`);
        }
      } catch (signOutError) {
        toast.error(
          signOutError instanceof Error
            ? `Automatic sign-out failed: ${signOutError.message}`
            : "Automatic sign-out failed.",
        );
      } finally {
        try {
          clearStoredAuthTokens();
        } catch (storageError) {
          toast.error(
            storageError instanceof Error
              ? `Unable to clear stored authentication data: ${storageError.message}`
              : "Unable to clear stored authentication data.",
          );
        } finally {
          window.location.replace("/login?reason=timeout");
        }
      }
    }

    function handleActivity() {
      if (!userIdRef.current || loggingOutRef.current) return;
      const now = Date.now();
      if (now - lastActivityAtRef.current >= LOGOUT_AFTER_MS) {
        void expireSession();
        return;
      }
      if (now - lastActivityAtRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityAtRef.current = now;
      startTimers();
    }

    const activityEvents = [
      "mousemove",
      "keydown",
      "wheel",
      "touchstart",
      "click",
    ] as const;
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (nextUserId !== userIdRef.current) {
        userIdRef.current = nextUserId;
        lastActivityAtRef.current = Date.now();
        loggingOutRef.current = false;
        startTimers();
      } else if (event === "SIGNED_OUT") {
        clearTimers();
        setShowWarning(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        toast.error(`Unable to check session activity: ${error.message}`);
        return;
      }
      const nextUserId = data.session?.user.id ?? null;
      if (nextUserId !== userIdRef.current) {
        userIdRef.current = nextUserId;
        lastActivityAtRef.current = Date.now();
        startTimers();
      }
    });

    return () => {
      clearTimers();
      subscription.unsubscribe();
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity);
      }
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-xl dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      Session expiring in 5 minutes due to inactivity. Click anywhere to stay
      logged in.
    </div>
  );
}
