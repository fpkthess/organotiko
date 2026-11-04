# Development database change — 2026-11-04

## Confirmed authorization and scope

The user designated hosted project `ikoqtvcobkmwshowgetc` as development until the
applications are released and requested the database push. Only migration
`20261104000100_organotiko_read_foundation.sql` was applied. No seeds, role files,
Vault/config push, data imports, user changes or deployment were included.
Existing Portal/website projects were not touched. The platform main branch still
reports “production”; project use is development per the user's clarification.

## Preflight and backup/restore

A fresh read-only inspection found PostgreSQL 17.11, no application tables and one
Auth account. The preview contained exactly one migration. The public schema was
dumped to ignored local storage with owner-only file permissions and successfully
restored into an isolated local PostgreSQL container. The restored public schema
contained zero tables, matching the target baseline. The temporary test container
was removed afterward.

Backup SHA256: `b00f958bedc16f70e43e1aa0afed00267262d8dee106accb336a8da88ffba35a`.
Migration SHA256: `632732fa7210f9d52dd7f5336e8c9d69bdd4a766c51beba81f876d82caae4918`.

Backup scope is the pre-change public application schema. It is not a full
Auth/Storage/configuration backup. Auth and those services were outside the change.
The prior isolated migration tests used synthetic Auth helper functions; hosted
end-to-end login/MFA and complete release recovery remain pending.

## Result

The CLI applied migration `20261104000100` successfully and recorded it in
`supabase_migrations.schema_migrations`. Read-only postflight confirmed:

- RLS enabled on all six public foundation tables and the private read-access table.
- Student projection uses `security_invoker=true`.
- Anonymous view reads, authenticated browser writes and access self-grants denied.
- Zero student records; one Auth account, unchanged from preflight.

## Recovery plan and limits

The migration is additive and wrapped in a transaction. A failure before commit
rolls back its DDL. After a successful commit, prefer a reviewed forward correction.
If reverting this empty development foundation becomes necessary, stop application
writes, take a fresh backup, verify no new records/dependencies have appeared, and
prepare a reviewed reverse migration removing only the objects introduced here in
reverse dependency order. Restore the pre-change public schema into an isolated
replacement first and reconcile migration history before switching environments.
Do not blindly drop schemas or delete migration-history rows. Any future data must
be retained before reversal; the empty baseline backup cannot restore later data.

## Unresolved

Initial account authorization, TOTP enrollment/recovery, audited central provisioning,
real data import/matching, complete domain persistence and write APIs remain pending.
Before release, define the final production/staging split and rehearse complete
backup/restore and data migration with the relevant Auth/Storage/configuration scope.
