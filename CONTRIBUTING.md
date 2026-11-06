# Contributing

Contributions and bug reports are welcome. For security-sensitive issues,
follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## Development setup

1. Install Node.js 20.9 or later and npm. Python 3.10+ is needed only for the
   Tally sync worker and its tests.
2. Follow the Supabase and local setup steps in [README.md](./README.md).
   Use a development Supabase project and synthetic financial data.
3. Install dependencies with `npm ci` and start the app with `npm run dev`.

## Before opening a pull request

Run the checks relevant to your change:

```bash
npx tsc --noEmit
npm run lint
npm run build
python -m unittest discover -s tests -p "test_*.py"
```

Keep changes focused, describe user-visible behavior and any schema or
environment changes, and include tests for changed behavior. Never commit
credentials, customer information, or production exports. Database changes
should update `supabase/schema.sql` and explain how to safely apply and verify
them.

By submitting a contribution, you agree that it is offered under the
repository's Apache License 2.0, subject to any separate written agreement
that applies.
