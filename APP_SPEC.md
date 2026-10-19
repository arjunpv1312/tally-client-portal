# PROJECT SPECIFICATION: Tally Client Reporting Portal

## Tech Stack

- Next.js 14/15 (App Router, TypeScript)
- Tailwind CSS
- Framer Motion (for smooth sliding animations and loading UI)
- Lucide React (for clean app icons)
- Recharts (for visual financial graphs)
- Supabase (@supabase/supabase-js) for Auth & Database

## Core Design Rules

1. Light & Dark Themes ONLY (2-way toggle):
   - Light: White (#FFFFFF) background, Soft Blue (#2563EB) accents, Slate text.
   - Dark: Midnight Navy (#0F172A) background, Soft Blue-Gray (#1E293B) cards. No pitch black.
2. App-like feel with smooth rounded corners (rounded-xl), subtle border outlines (border-slate-200 / dark:border-slate-800), and crisp shadows.
3. Framer Motion for all UI state changes, tab sliding, and loading states.

## Authentication & Authorization Logic

1. NO PUBLIC SIGN-UP FORM. Login ONLY.
2. The /login page features an animated 3-way sliding tab role selector: [ Admin | Employee | Client ].
3. User profiles exist in Supabase 'profiles' table with roles: 'admin', 'employee', 'company'.
4. After logging in:
   - Role 'admin' redirects to /admin
   - Role 'employee' redirects to /employee
   - Role 'company' redirects to /dashboard

## Pages to Build

- `/login`: Clean, centered modern card with sliding role tabs, email/password input, and submit button.
- `/admin`: Management portal to create Company profiles, register Employee/Client accounts, and assign Employees to Companies.
- `/employee`: Table view of assigned companies with entry status indicator.
- `/dashboard`: Read-only financial analytics dashboard for clients featuring Sales vs Expenses bar charts, Net Profit area charts, and GST summaries using Recharts.
