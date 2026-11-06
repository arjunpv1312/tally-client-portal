# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in public issues, discussions, or
pull requests. If GitHub private vulnerability reporting is enabled for this
repository, use **Security → Advisories → Report a vulnerability**. Otherwise,
contact the repository owner privately through GitHub and request a secure
channel before sharing technical details. Do not include real customer data,
credentials, or financial records in a report.

Please include the affected version or commit, the impact, and concise steps to
reproduce the issue using a local or test environment. A minimal proof of
concept is helpful when it does not access or modify third-party data. The
maintainers will acknowledge reports as soon as practical; this project does
not currently promise a response or remediation SLA. Please allow time to
investigate and coordinate a fix before public disclosure.

## Current security boundaries

- `supabase/schema.sql` enables Row Level Security (RLS) on profiles,
  companies, employee assignments, vouchers, and financial summaries, and
  defines policies for administrator and company/employee-scoped reads.
- The admin API routes use `SUPABASE_SERVICE_ROLE_KEY` on the server only.
  They verify the supplied access token and administrator profile before
  performing privileged account operations. Never expose this key in a
  `NEXT_PUBLIC_` variable, browser code, logs, or source control.
- The Python sync worker also requires a service-role key to write voucher
  and summary data. Run it only on a trusted machine, keep its environment
  private, and do not expose the TallyPrime listener on port 9000 to the
  public internet.
- Database calls use Supabase clients and REST operations. Do not construct
  SQL from untrusted input.

These are implementation details, not a third-party security audit or a
guarantee that every deployment is secure. RLS and server-key protections
depend on applying and reviewing the schema, protecting deployment secrets,
and configuring the Supabase project appropriately. This repository does not
currently include a dedicated audit-log system or a custom CORS policy.

## Supported versions

Security fixes are applied to the current default branch. There is no separate
long-term-support release policy at this time.
