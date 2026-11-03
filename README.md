# Tally Client Reporting Portal

**A secure cloud bridge from desktop TallyPrime to role-based financial reporting.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_Auth-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12.x-BB4BFF?logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Executive overview

Tally Client Reporting Portal is a cloud reporting workspace for accounting practices and their clients. A trusted machine can read accounting data from desktop TallyPrime over its local XML/HTTP interface and send validated records to Supabase. The Next.js portal then provides a separate, role-aware experience for administrators, employees, and client companies.

The web application includes administrator-managed company and account directories, employee-to-company assignments, authentication, and a read-only financial dashboard. Supabase Row Level Security (RLS) is the database access boundary; the browser never connects directly to TallyPrime. Supabase SSR cookies and the Next.js `proxy.ts` convention provide authenticated, role-checked access to protected route paths, while RLS remains authoritative for database access.

> The portal includes a local `tally_sync.py` worker and schema for vouchers and monthly summaries. Configure the sync environment and apply the updated schema before connecting a live TallyPrime company.

## System architecture

```text
  ACCOUNTING DATA PATH
  +-------------------------+     XML / HTTP :9000     +---------------------------+
  | Desktop TallyPrime      | -----------------------> | Trusted local sync worker  |
  | Company books + ledgers |                            | tally_sync.py              |
  +-------------------------+                          +-------------+-------------+
                                                                    |
                                                   HTTPS / Supabase | API
                                                                    v
  +-------------------------+      Auth + RLS        +---------------------------+
  | Admin / Employee /      | <--------------------> | Supabase                  |
  | Client in a web browser |                         | Auth + PostgreSQL         |
  +------------+------------+                         +-------------+-------------+
               |                                                      ^
               | HTTPS                                                |
               v                                                      |
  +-------------------------+     Supabase JS client / scoped RLS ----+
  | Next.js App Router       |
  | Admin / Employee /       |
  | Client financial views   |
  +-------------------------+

  ADMIN ACCOUNT PROVISIONING
  Next.js admin UI --> protected API route --> Supabase Auth Admin
                       (verified admin)        (server-only key)
```

The Tally listener should remain on a trusted local network and must not be exposed directly to the public internet. The Supabase service-role key is for server-side account provisioning only: never use it in browser code or expose it through a `NEXT_PUBLIC_` variable.

## Roles and authorization

| Capability | Admin | Employee | Client company |
| --- | :---: | :---: | :---: |
| Manage companies | Yes | — | — |
| Create employee and client accounts | Yes | — | — |
| Assign employees to companies | Yes | — | — |
| View company and account directories | Yes | — | — |
| View assigned company workspace | — | Yes | — |
| View own company financial dashboard | — | — | Yes |
| Public self-registration | No | No | No |

The login screen asks the user to select Admin, Employee, or Client. The selected tab is checked against the signed-in user's `profiles.role`; successful sessions are routed to `/admin`, `/employee`, or `/dashboard`. Database RLS policies remain authoritative even when a route is hidden or guarded in the UI.

## Technology

| Category | Implementation |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript 5 |
| Styling and UI | Tailwind CSS 4, CSS theme tokens, Lucide React |
| Motion and feedback | Framer Motion, Sonner toast notifications |
| Database | Supabase PostgreSQL with Row Level Security |
| Authentication | Supabase Auth; administrator-provisioned accounts |
| Charts | Recharts sales, expense, profit, and GST visualizations |
| Sync engine | Python standard library, TallyPrime XML/HTTP on port `9000`, Supabase REST upserts |

## Quickstart

### Prerequisites

- Node.js LTS and npm
- A Supabase project with access to its SQL Editor
- TallyPrime and Python 3.10+ only when configuring the local integration

### 1. Clone and install

```bash
git clone https://github.com/arjunpv1312/tally-client-portal.git
cd tally-client-portal
npm install
```

### 2. Configure environment

Create `.env.local` in the repository root:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
```

The browser uses the public project URL and anon/publishable key. The service-role key is used only by the admin account-provisioning API route. Keep it server-side, out of source control, and out of all `NEXT_PUBLIC_` variables. Restart the dev server after changing environment variables.

### 3. Initialize Supabase

1. Open the Supabase project **SQL Editor**.
2. Run [`supabase/schema.sql`](./supabase/schema.sql). It creates profile, company, employee-assignment, voucher, and financial-summary structures and configures RLS policies. Re-running the SQL safely adds the reporting tables and policies.
3. In **Authentication → Users**, create the first administrator.
4. Copy the new Auth user's UUID, then run the bootstrap `INSERT` at the end of `schema.sql` with that UUID, email, and an administrator display name.
5. Sign in at `/login` using the Admin role tab.

Do not disable RLS to make the UI work. Create and review policies whenever adding data tables or access paths.

### 4. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). There is no public sign-up form. Administrators create employee and client accounts from the admin workspace.

Useful checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## TallyPrime connection protocol

### Enable the local XML/HTTP listener

1. Open the target company in TallyPrime and enable its HTTP/XML server in the connectivity settings. Menu labels can differ by release.
2. Set the listener port to **9000** and enable ODBC only if the integration requires it.
3. On the same machine, confirm TallyPrime is reachable at `http://localhost:9000`.
4. Ensure the local firewall permits the intended sync process. Do **not** port-forward this listener or expose it to the public internet.
5. Validate the request and XML response locally before connecting any uploader.

### Configure and run `tally_sync.py`

Set these variables in the sync process environment. Keep the service-role key secret and use a database company UUID from the `companies` table.

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<server-only-service-role-key>"
$env:TALLY_COMPANY_ID = "<company-uuid>"
$env:TALLY_COMPANY_NAME = "<exact-company-name-in-TallyPrime>"
$env:TALLY_EXPENSE_LEDGER_NAMES = "Office Rent,Professional Fees"
```

`TALLY_EXPENSE_LEDGER_NAMES` is an explicit comma-separated allowlist of Tally ledgers used to classify payment entries as expenses. Payment vouchers are **not** assumed to be expenses because they may settle purchases or liabilities. Configure the ledger names to match the Tally company; otherwise payment expense totals remain zero. Purchase amounts are reported separately from classified payment expenses to avoid automatically double-counting purchase settlements.

Optional range and network controls are `TALLY_SYNC_FROM_DATE` (`YYYY-MM-DD`, defaults to the current Indian financial-year start), `TALLY_SYNC_TO_DATE` (defaults to today), `TALLY_SYNC_RETRIES` (defaults to 3), and `TALLY_SYNC_TIMEOUT` (defaults to 30 seconds).

Run the sync manually after enabling Tally's local XML/HTTP listener:

```powershell
py -3 .\tally_sync.py
```

The worker exports the Day Book from `http://localhost:9000`, validates XML and dates, upserts vouchers on `(company_id, tally_voucher_id)`, then upserts monthly summaries. Network failures are retried; credentials and voucher payloads are not printed to logs. Set the environment variables for the same Windows account that runs the scheduled task.

Register a daily 3:00 AM Task Scheduler job from PowerShell:

```powershell
.\scripts\schedule_sync.ps1
```

The generated task uses the current user's `python` executable. For scheduled runs, configure persistent user-level environment variables for the same Windows account (rather than only setting variables in a temporary PowerShell session). Review the task and run it manually once before relying on the schedule.

The financial summary is calculated from sales and purchase voucher net amounts, tax ledger lines containing `CGST`, `SGST`, and `IGST`, and only the explicitly configured payment-expense ledgers. Validate the Tally Day Book export and ledger mapping against company books before using the figures for statutory reporting.

Never place a service-role key in the script source, browser bundle, or a checked-in configuration file.

## Repository layout

```text
tally-client-portal/
├── app/
│   ├── admin/page.tsx                 # Company, account, and assignment management
│   ├── api/admin/create-user/route.ts # Server-side account provisioning
│   ├── dashboard/page.tsx             # Client financial dashboard (live Supabase data)
│   ├── employee/page.tsx              # Employee's assigned companies and entry status
│   ├── login/page.tsx                 # Login and role selection
│   ├── error.tsx                      # Animated route error boundary
│   ├── loading.tsx                    # Animated loading skeleton
│   ├── not-found.tsx                  # Executive 404 page
│   ├── globals.css                    # Global styles and theme variables
│   └── layout.tsx                     # Root layout and app providers
├── components/                        # Shared auth, charts, navigation, and UI
├── lib/                               # Supabase client, theme, and auth helpers
├── proxy.ts                           # SSR session refresh and role-gated routes
├── public/                            # Static app assets (favicon only)
├── scripts/                           # Windows sync scheduling
├── supabase/
│   └── schema.sql                     # Tables, relationships, and RLS policies
├── tally_sync.py                      # TallyPrime to Supabase sync worker
├── tests/test_tally_sync.py            # XML parsing and summary tests
├── types/                             # Shared TypeScript types
├── APP_SPEC.md                        # Product requirements and design rules
└── README.md
```

## License

Distributed under the MIT License. See [`LICENSE`](./LICENSE).
