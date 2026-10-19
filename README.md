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

The web application includes administrator-managed company and account directories, employee-to-company assignments, authentication, and a read-only financial dashboard. Supabase Row Level Security (RLS) is the database access boundary; the browser never connects directly to TallyPrime.

> **Integration status:** The portal and Supabase schema are present. A `tally_sync.py` integration script and financial reporting tables are **not included yet**. Dashboard charts currently display clearly identified sample data until a sync pipeline and production financial-data schema are connected.

## System architecture

```text
  ACCOUNTING DATA PATH
  +-------------------------+     XML / HTTP :9000     +---------------------------+
  | Desktop TallyPrime      | -----------------------> | Trusted local sync worker  |
  | Company books + ledgers |                          | tally_sync.py (to be added)|
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
| Sync engine | TallyPrime XML/HTTP on port `9000`; Python worker planned, not yet present |

## Quickstart

### Prerequisites

- Node.js LTS and npm
- A Supabase project with access to its SQL Editor
- TallyPrime and Python 3 only when configuring the optional local integration

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
2. Run [`supabase/schema.sql`](./supabase/schema.sql). It creates the profile, company, and employee-assignment structures and configures RLS policies.
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

### Schedule `tally_sync.py` when available

The repository does not yet contain `tally_sync.py`. When the integration is implemented, configure it to validate Tally XML responses, send only the necessary records to Supabase, use idempotent writes, and report sync timestamps and failures without logging secrets.

For a Windows deployment, prepare a dedicated Python environment and test the script manually first:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python .\tally_sync.py
```

Then use **Windows Task Scheduler**:

1. Create a task with a daily trigger.
2. Set **Program/script** to the full path to `.venv\Scripts\python.exe`.
3. Set **Add arguments** to the full path to `tally_sync.py`.
4. Set **Start in** to the script directory and configure the required environment variables for the task's service account.
5. Run the task manually and verify its exit code and logs before enabling the schedule.

Never place a service-role key in the script source, browser bundle, or a checked-in configuration file.

## Repository layout

```text
tally-client-portal/
├── app/
│   ├── admin/page.tsx                 # Company, account, and assignment management
│   ├── api/admin/create-user/route.ts # Server-side account provisioning
│   ├── dashboard/page.tsx             # Client financial dashboard (sample chart data)
│   ├── employee/page.tsx              # Employee's assigned companies and entry status
│   ├── login/page.tsx                 # Login and role selection
│   ├── error.tsx                      # Animated route error boundary
│   ├── loading.tsx                    # Animated loading skeleton
│   ├── not-found.tsx                  # Executive 404 page
│   ├── globals.css                    # Global styles and theme variables
│   └── layout.tsx                     # Root layout and app providers
├── components/                        # Shared auth, charts, navigation, and UI
├── lib/                               # Supabase client, theme, and auth helpers
├── public/                            # Static app assets (favicon only)
├── supabase/
│   └── schema.sql                     # Tables, relationships, and RLS policies
├── types/                             # Shared TypeScript types
├── APP_SPEC.md                        # Product requirements and design rules
└── README.md
```

## License

Distributed under the MIT License. See [`LICENSE`](./LICENSE).
