# Read-only Supabase foundation audit — 2026-11-15

Project `organotiko` / reference `ikoqtvcobkmwshowgetc` (eu-north-1) was inspected with read-only list/schema/policies queries; **no SQL DDL, DML or migrations were executed** on this project.

## Observed

- Six public tables (all currently 0 rows): `organotiko_people`, `organotiko_students`, `organotiko_nucleus_categories`, `organotiko_nuclei`, `organotiko_student_assignments`, `organotiko_person_membership_links`.
- All six have RLS enabled and their only policy is `SELECT` for authenticated sessions satisfying `organotiko_can_read()`.
- Role `authenticated` has SELECT but not UPDATE, INSERT, DELETE grants on those tables.
- Existing read function checks JWT AAL2 and private entitlement table before returning true; it uses SECURITY DEFINER and must be reviewed carefully before broader exposure.
- Existing project migration: `20261104000100_organotiko_read_foundation`.
- Legacy production `ORGANOSI` is a **different project** with Portal data; untouched.

## Existing security advisor findings (from Supabase)

1. INFO `rls_enabled_no_policy` on private `organotiko_private.read_access`. This may be intentional default-deny; confirm that trusted admin-only provisioning is correct.
   https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
2. WARN `authenticated_security_definer_function_executable` on public `organotiko_can_read()` accessible as RPC. It returns only a boolean and checks entitlements, but prefer moving helper to a non-exposed private schema, with least privilege and policy retesting before production.
   https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
3. WARN `auth_leaked_password_protection`: breached-password protection is disabled. Enable before onboarding real users.
   https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Status

This audit is **not a security certification**. No active staging project or production deployment was created during this iteration. The new draft migrations must be applied and tested on an **isolated staging** environment first, including denied-by-default role tests and advisor rerun.
