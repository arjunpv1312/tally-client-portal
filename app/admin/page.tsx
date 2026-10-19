"use client";

import { motion } from "framer-motion";
import { Building2, UserPlus, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";

const panelVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35 },
  }),
};

export default function AdminPage() {
  return (
    <AuthGuard allow="admin">
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A]">
      <AppHeader
        title="Admin Dashboard"
        subtitle="Create companies, register accounts, and assign employees"
      />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              icon: Building2,
              title: "Companies",
              desc: "Create and manage client company profiles (name, GSTIN).",
            },
            {
              icon: UserPlus,
              title: "Accounts",
              desc: "Register Employee and Client logins—no public sign-up.",
            },
            {
              icon: Users,
              title: "Assignments",
              desc: "Link accountants to companies they maintain in Tally.",
            },
          ].map((card, i) => (
            <motion.section
              key={card.title}
              custom={i}
              variants={panelVariants}
              initial="hidden"
              animate="show"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#1E293B]"
            >
              <card.icon className="mb-3 h-8 w-8 text-blue-600 dark:text-sky-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {card.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {card.desc}
              </p>
              <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                Wire forms to Supabase tables: companies, profiles, employee_assignments.
              </p>
            </motion.section>
          ))}
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
