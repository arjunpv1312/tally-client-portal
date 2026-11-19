import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { IdleTimer } from "@/components/auth/IdleTimer";
import { EmployeeActivityTracker } from "@/components/auth/EmployeeActivityTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "FINORA | Accounting & Business Solutions",
  description:
    "Secure TallyPrime reporting and financial dashboards by FINORA Accounting & Business Solutions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full font-sans">
        <ThemeProvider>
          <IdleTimer />
          <EmployeeActivityTracker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
