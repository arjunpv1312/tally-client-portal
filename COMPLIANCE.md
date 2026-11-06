# Data Protection and Compliance Notes

This document describes design considerations for deployments of the FINORA
Tally Client Reporting Portal. It is not legal advice, a compliance
certification, or a claim that the software by itself satisfies any law or
regulation. The organization operating a deployment is responsible for
determining its obligations and configuring, testing, and documenting its
controls.

## Data handled

Depending on configuration, the application and sync worker process:

- Account identifiers, email addresses, names, roles, and employee/company
  assignments.
- Company contact details and GSTIN values.
- TallyPrime voucher dates, numbers, types, party names, narration, monetary
  values, tax amounts, and raw ledger-entry details.
- Monthly financial summaries and authentication/session data managed by
  Supabase.

The schema stores raw ledger entries in `vouchers.raw_ledger_entries`. Avoid
sending data that is not needed for reporting, and use synthetic data for
development and CI.

## Privacy-by-design guidance

For deployments subject to India's Digital Personal Data Protection Act, 2023
(DPDP Act), the GDPR, or other privacy laws:

1. Identify the data fiduciary/controller and processors, establish an
   appropriate lawful basis and notices, and document purposes before
   importing real records.
2. Limit imported fields, user access, and retention to what the reporting
   purpose requires. Configure company-specific access and periodically
   review accounts, assignments, and credentials.
3. Define and implement a retention and deletion schedule that accounts for
   applicable accounting/tax obligations, user requests, database backups,
   and processor retention. This application does not enforce a statutory
   retention period or provide automated data-subject request workflows.
4. Document incident handling, processor arrangements, cross-border transfers,
   and any required assessments with qualified counsel.

RLS policies in `supabase/schema.sql` are a technical access-control measure;
they are not by themselves proof of legal compliance. Review policies against
the deployed schema and test them using representative roles.

## Encryption and operational controls

The application communicates with Supabase using its HTTPS APIs. Encryption
at rest, TLS versions/cipher suites, backup protection, key management, and
regional data location depend on the selected Supabase plan and deployment
configuration. This repository does not independently enforce or verify
AES-256 at rest or TLS 1.3 in transit. Confirm those settings and obtain
provider documentation before making such claims to users.

Keep Supabase service-role credentials server-side and out of source control.
Restrict access to the machine running `tally_sync.py`, protect its environment
variables and logs, and keep the TallyPrime XML/HTTP listener on a trusted
local network. Do not expose production financial records through a demo.

## Operational readiness checklist

- [ ] Approve privacy notices, purposes, lawful basis, and data-processing
  terms for the deployment.
- [ ] Apply and test RLS policies for each role and company boundary.
- [ ] Configure hosting and database region, HTTPS, encryption at rest,
  backups, access reviews, and secret rotation.
- [ ] Define retention, deletion, backup expiry, and incident-response
  procedures outside this application.
- [ ] Validate Tally totals and GST mappings with qualified accounting
  personnel before any statutory or tax use.
