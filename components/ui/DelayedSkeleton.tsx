"use client";

import { useEffect, useState, type ReactNode } from "react";

type DelayedSkeletonProps = {
  loading: boolean;
  thresholdMs?: number;
  children: ReactNode;
};

export function DelayedSkeleton({
  loading,
  thresholdMs = 150,
  children,
}: DelayedSkeletonProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      const resetTimer = setTimeout(() => setShow(false), 0);
      return () => clearTimeout(resetTimer);
    }
    const timer = setTimeout(() => setShow(true), thresholdMs);
    return () => clearTimeout(timer);
  }, [loading, thresholdMs]);

  return show ? <>{children}</> : null;
}
