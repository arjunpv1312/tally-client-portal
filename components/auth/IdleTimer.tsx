"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { closeEmployeeWorkLog } from "@/lib/employee-work-logs";

const WARNING_AFTER_MS = 25 * 60 * 1000;
const LOGOUT_AFTER_MS = 30 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;
const LAST_ACTIVITY_KEY = "finora_last_activity";

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
    let storageErrorReported = false;

    function clearTimers() {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      warningTimerRef.current = null;
      logoutTimerRef.current = null;
    }

    function startTimers() {
      clearTimers();
      if (!userIdRef.current || loggingOutRef.current) return;

      const elapsed = Math.max(0, Date.now() - lastActivityAtRef.current);
      setShowWarning(elapsed >= WARNING_AFTER_MS);
      if (elapsed < WARNING_AFTER_MS) {
        warningTimerRef.current = setTimeout(() => {
          setShowWarning(true);
        }, WARNING_AFTER_MS - elapsed);
      }
      logoutTimerRef.current = setTimeout(() => {
        void expireSession();
      }, Math.max(0, LOGOUT_AFTER_MS - elapsed));
    }

    function readLastActivity(): number | null {
      try {
        const storedValue = window.localStorage.getItem(LAST_ACTIVITY_KEY);
        if (!storedValue) return null;
        const timestamp = Number(storedValue);
        return Number.isFinite(timestamp) && timestamp > 0
          ? timestamp
          : null;
      } catch (storageError) {
        if (!storageErrorReported) {
          storageErrorReported = true;
          toast.error(
            storageError instanceof Error
              ? `Unable to read stored session activity: ${storageError.message}`
              : "Unable to read stored session activity.",
          );
        }
        return null;
      }
    }

    function storeLastActivity(timestamp: number): void {
      try {
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
        lastActivityAtRef.current = timestamp;
      } catch (storageError) {
        if (!storageErrorReported) {
          storageErrorReported = true;
          toast.error(
            storageError instanceof Error
              ? `Unable to store session activity: ${storageError.message}`
              : "Unable to store session activity.",
          );
        }
        lastActivityAtRef.current = timestamp;
      }
    }

    function checkIdleStatus() {
      if (!userIdRef.current || loggingOutRef.current) return;
      const storedTimestamp = readLastActivity();
      if (storedTimestamp !== null) {
        lastActivityAtRef.current = storedTimestamp;
      }
      if (!lastActivityAtRef.current) {
        storeLastActivity(Date.now());
      }
      const elapsed = Date.now() - lastActivityAtRef.current;
      if (elapsed >= LOGOUT_AFTER_MS) {
        void expireSession();
        return;
      }
      startTimers();
    }

    async function expireSession() {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      clearTimers();
      try {
        window.localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch (storageError) {
        toast.error(
          storageError instanceof Error
            ? `Unable to clear stored session activity: ${storageError.message}`
            : "Unable to clear stored session activity.",
        );
      }

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
          window.location.replace("/login?reason=idle_timeout");
        }
      }
    }

    function handleActivity() {
      if (!userIdRef.current || loggingOutRef.current) return;
      const now = Date.now();
      const storedTimestamp = readLastActivity();
      if (storedTimestamp !== null) {
        lastActivityAtRef.current = storedTimestamp;
      }
      if (now - lastActivityAtRef.current >= LOGOUT_AFTER_MS) {
        void expireSession();
        return;
      }
      if (now - lastActivityAtRef.current < ACTIVITY_THROTTLE_MS) return;
      storeLastActivity(now);
      startTimers();
    }

    function handleAuthState(event: string, session: Parameters<
      Parameters<typeof supabase.auth.onAuthStateChange>[0]
    >[1]) {
      const nextUserId = session?.user.id ?? null;
      if (nextUserId !== userIdRef.current) {
        userIdRef.current = nextUserId;
        loggingOutRef.current = false;
        if (!nextUserId) {
          clearTimers();
          setShowWarning(false);
          try {
            window.localStorage.removeItem(LAST_ACTIVITY_KEY);
          } catch (storageError) {
            toast.error(
              storageError instanceof Error
                ? `Unable to clear stored session activity: ${storageError.message}`
                : "Unable to clear stored session activity.",
            );
          }
          return;
        }
        if (event === "SIGNED_IN") {
          storeLastActivity(Date.now());
        } else {
          lastActivityAtRef.current =
            readLastActivity() ?? Date.now();
          if (readLastActivity() === null) {
            storeLastActivity(lastActivityAtRef.current);
          }
        }
        checkIdleStatus();
      } else if (event === "SIGNED_OUT") {
        clearTimers();
        setShowWarning(false);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkIdleStatus();
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
    } = supabase.auth.onAuthStateChange(handleAuthState);

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        toast.error(`Unable to check session activity: ${error.message}`);
        return;
      }
      const nextUserId = data.session?.user.id ?? null;
      if (nextUserId !== userIdRef.current) {
        userIdRef.current = nextUserId;
        loggingOutRef.current = false;
        lastActivityAtRef.current = readLastActivity() ?? Date.now();
        if (readLastActivity() === null) {
          storeLastActivity(lastActivityAtRef.current);
        }
        checkIdleStatus();
      }
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkIdleStatus);
    window.addEventListener("pageshow", checkIdleStatus);
    window.addEventListener("storage", checkIdleStatus);

    return () => {
      clearTimers();
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkIdleStatus);
      window.removeEventListener("pageshow", checkIdleStatus);
      window.removeEventListener("storage", checkIdleStatus);
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
