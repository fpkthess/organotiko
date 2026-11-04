## Initial sign-in update — 2026-11-04

The sole existing development account now has Organotiko read authorization.
Open the local app, sign in with its existing email/password, select **Ρύθμιση
Authenticator**, scan the QR in your authenticator app and verify the six-digit
code. The database still requires AAL2 plus explicit application access. No
account password or verified factor was changed by the bootstrap. Hosted TOTP
enrollment/verification must be enabled in Supabase Auth; the client displays an
error if the service does not permit enrollment. Recovery codes and supervised
reset remain unimplemented. Earlier notes describing initial authorization or
enrollment as pending are superseded by this update.

# Current database status — 2026-11-04

The user designated `ikoqtvcobkmwshowgetc` as **development until release** and
explicitly authorized applying the prepared schema. Migration `20261104000100`
has now been pushed successfully. The CLI main-branch label remains “production”;
that is not the project's current operational use. Existing Portal/website
production databases were not touched.

Verified after push: all seven new tables have RLS, the projection view uses
`security_invoker=true`, anonymous SELECT and browser INSERT/UPDATE/DELETE are
denied, and clients cannot grant themselves read access. There are zero students;
the one pre-existing Auth account was preserved. No account access was granted,
no seeds/imports were run, and hosted Auth configuration was not changed.

The schema-only pre-change backup is stored locally in ignored
`supabase/.temp/backups/pre-read-foundation-schema.sql` (owner-only access). It was
restored successfully into an isolated PostgreSQL container before the push.
It covers the empty public application schema, not Auth, Storage or full hosted
configuration. This narrow rehearsal is sufficient evidence for this empty-target
additive development change; a full release backup/restore rehearsal remains pending.
See [application record](../docs/DATABASE_CHANGE_2026-11-04.md).

The earlier planning/setup notes below are historical where they describe the
migration as unapplied or the project as production. Current work is development;
release and final staging/production separation remain separate decisions.

# Shared Supabase project

## Confirmed

Both applications will share the hosted production project `ikoqtvcobkmwshowgetc`
(`https://ikoqtvcobkmwshowgetc.supabase.co`). The CLI is pinned to version 3.0.0
in the root workspace. Run commands from the repository root.

Local initialization and project linking are complete. A read-only audit on
2026-11-04 confirmed PostgreSQL 17.11, zero Auth users, and no application tables.
No hosted schema, data or Auth configuration was changed.

## Complete local authentication and linking

Run in your own terminal (do not paste credentials into chat):

```sh
npx --no-install supabase login
npx --no-install supabase link --project-ref ikoqtvcobkmwshowgetc
```

Linking stores local project metadata under ignored `.temp/`; each developer or CI
runner must configure their own credentials and link. It does not connect the frontend,
configure GitHub integration, or apply migrations. Never commit tokens, database
passwords, service-role keys, or generated environment files.

## Local configuration

`config.toml` configures the local development stack: signup is disabled, TOTP
enrollment/verification is enabled, development redirects use ports 5173/5174,
and automatic seeds are disabled. It does not enforce application-level MFA or
permissions. These settings have not been applied to hosted Auth.

## Required migration sequence

1. Authenticate and verify the linked project identity.
2. Inspect the current hosted schema and migration history read-only. Do not replay
   old Portal or website migrations against this project blindly.
3. Establish a baseline and create a separate staging project. Review migrations
   for shared Auth, permissions, RLS, histories and the two application boundaries.
4. Test migrations, concurrency, RLS and backup restoration in isolation/staging.
5. Obtain explicit approval for the exact production migration after the tested
   backup/restore plan is available, as required by `AGENTS.md`.
6. Only then apply the reviewed migration set and verify the result.

A proposed read-only foundation migration is prepared locally and tested in an isolated
PostgreSQL container. It is not approved for production and is not a complete domain schema. Do not run production `db push`, `db reset`,
`config push`, migration repair, or remote seed commands during setup. A dry run
is a review aid, not production authorization. Review installed CLI help before
using remote commands; CLI versions may differ.

## Assumptions and unresolved decisions

- Assumption: this newly supplied project is the intended central production target;
  it is not assumed empty.
- Unresolved: staging project, complete backup/restore procedure, reviewed imports,
  initial administrator provisioning, TOTP enrollment/recovery, full domain schema and
  production Auth/redirect configuration. No application migration-history table exists.
- Database mode now reads the student projection with Auth, MFA and RLS. Mutations,
  central provisioning and other domain persistence remain separate work. Synthetic
  data requires explicit development-only demo mode.


## Read integration (2026-11-04)

This machine now has an ignored `apps/organotiko/.env.local` configured with the
project URL and public publishable key. For another machine, copy
`apps/organotiko/.env.example` to `.env.local` in that same directory, set only
its public publishable/anon key, and restart Vite. Never use a service-role/secret
key in a VITE variable. CLI linking and browser credentials are separate.

Database mode is the default. It uses password authentication, an existing verified
TOTP factor, and `organotiko_can_read()` before selecting the security-invoker
`organotiko_student_read_model` view. All base tables enforce RLS; no authenticated
or anonymous writes are granted. Access is recorded in the private read-access
registry, not user-editable metadata. This narrow registry is a proposed foundation,
not the final broad-role/granular permission system. No initial operator is seeded.

Supported live surfaces: student grid, quick search, archive, read-only student
cards, filters/sorting, personal browser views and CSV export. Nucleus names and
membership flags are read from explicit relations. Annual columns are hidden until
annual persistence is implemented. Other modules show an integration-pending state;
they never receive synthetic data in database mode. Writes remain disabled.

Database pages are ordered by stable ID and loaded in batches of 500. Failed pages
or duplicate IDs discard the load. This is not a transactionally frozen snapshot;
concurrent imports/deletions require a later server snapshot/keyset mechanism.
Unknown membership linkage causes a visible load error, never a false flag or a
silently omitted student. A genuine empty authorized response displays zero records.

For the isolated prototype only, set `VITE_DATA_SOURCE=demo` during development.
Production builds always choose database mode. Demo records are never written to
Supabase. No migration imports legacy records; provenance and matching must be
reviewed separately before any data migration.

Validation: 41 domain/data tests and build pass. The proposed migration and SQL
access tests (`tests/read_foundation.sql`) passed against an isolated Supabase
PostgreSQL 17 container with synthetic Auth JWT helper functions. Tests cover
AAL1 denial, an unauthorized AAL2 user, authorized AAL2 reads, anonymous denial,
write denial and self-grant denial. Fixtures roll back. This is not an end-to-end
hosted Auth test or a complete production backup/restore rehearsal.
