"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

type AnimatedNumberProps = {
  value: number;
  format?: "currency" | "number";
};

export function AnimatedNumber({
  value,
  format = "number",
}: AnimatedNumberProps) {
  const springValue = useSpring(value, { stiffness: 350, damping: 25 });
  const formattedValue = useTransform(springValue, (current) =>
    format === "currency"
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(current)
      : new Intl.NumberFormat("en-IN", {
          maximumFractionDigits: 0,
        }).format(current),
  );

  useEffect(() => {
    springValue.set(value);
  }, [springValue, value]);

  return <motion.span>{formattedValue}</motion.span>;
}

type MetricCardProps = {
  label: string;
  value: number;
  delay?: number;
};

export function MetricCard({ label, value, delay = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 25, delay }}
      whileTap={{ scale: 0.98 }}
    >
      <SpotlightCard className="h-full p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-lg dark:bg-[#111722]">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-[#F8F4E8]">
          <AnimatedNumber value={value} format="currency" />
        </p>
      </SpotlightCard>
    </motion.div>
  );
}
