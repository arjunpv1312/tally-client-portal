"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-4 py-12 dark:bg-transparent">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex w-full flex-col items-center justify-center"
      >
        <div className="relative mb-7 flex flex-col items-center">
          <div
            aria-hidden="true"
            className="absolute inset-3 rounded-full bg-gradient-to-tr from-[#9E7C28]/25 to-[#E5C365]/25 blur-2xl"
          />
          <Image
            src="/logo.png"
            alt="FINORA Accounting & Business Solutions"
            width={192}
            height={192}
            priority
            className="relative h-40 w-40 rounded-[2rem] object-cover shadow-gold-glow-lg sm:h-48 sm:w-48"
          />
        </div>
        <LoginForm />
      </motion.div>
    </div>
  );
}
