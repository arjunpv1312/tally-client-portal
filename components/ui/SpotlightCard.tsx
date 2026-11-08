"use client";

import type { MouseEvent, ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

export function SpotlightCard({
  children,
  className = "",
}: SpotlightCardProps) {
  function updatePointer(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--spotlight-x",
      `${event.clientX - bounds.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--spotlight-y",
      `${event.clientY - bounds.top}px`,
    );
  }

  return (
    <div
      onMouseMove={updatePointer}
      className={`finora-noise-surface group relative overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC] transition-colors duration-200 hover:border-[#E5C365]/40 dark:border-white/[0.08] dark:bg-[#111722] dark:hover:border-[#E5C365]/30 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at var(--spotlight-x, 0px) var(--spotlight-y, 0px), rgba(229, 195, 101, 0.12), transparent 40%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
