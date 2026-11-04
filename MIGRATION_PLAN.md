# Safe staged integration and migration plan

## Two applications and migration-first delivery — confirmed 2026-11-03

- **Organotiko: `organotikos.com`**. Independent application for organizational workflows, member management, Bluepass and offers, plus user creation for both applications.
- **Portal: `portal.protoporiathess.com`**. Independent application for tasks/operational teams, events, finance, newsletter, SMS and other operational administration.
- **One shared central production database**, with shared Auth/services and enforced application permissions; independent staging. Two domains mean separate applications and deployment entry points, not separate production databases. This records target domains; it does not claim DNS or hosting has been configured.
- **Migrate existing functionality; build only new Organotiko capabilities from scratch.** Reuse the supplied Portal implementation and website member/Bluepass/offer implementation, preserving behavior and adapting shared data, identity, authorization and application integration as necessary. Do not replace existing modules with newly invented implementations. Required compatibility and security changes are migration work, not authorization for a wholesale rewrite.
- New implementation centers on the organizational grid, nuclei, review sessions, academic-year/EFΕΚΘ workflows, assembly analysis, organizational reporting and their shared identity links. Central account creation for both apps is integrated in Organotiko; Portal does not retain its own provisioning path.
- Migrate shared database schemas/data and existing accounts through staging rehearsals, provenance mapping and reconciliation. Existing public website forms remain operational. Production changes and deployment still require explicit approval and a tested backup/restore plan.

## Current application split — confirmed 2026-11-03

This user clarification supersedes every earlier requirement for Organotiko to be a complete Portal/website-admin superset. Older source inventories remain evidence of existing functionality, not instructions to duplicate Portal screens in Organotiko.

| Application | Confirmed scope |
|---|---|
| Organotiko | All organizational workflows: student grid/search, nuclei, review sessions, academic years, EFΕΚΘ registrations, assembly analysis and organizational reports; complete member management; complete website-equivalent Bluepass management including offers; central user creation for **both** applications. |
| Separate Portal | Tasks and operational teams, operational events, finance, newsletter, SMS, and other operational/website administration outside the Organotiko scope. |
| Public website | Existing public forms/content/offers remain operational; management ownership follows the split above. |

Both apps share the planned central database/Auth/services and permission model; staging remains separate. Account creation is available only through Organotiko, including Portal-only users. Portal must not expose an independent create/invite/bulk-provision path. Organotiko TOTP, Portal access policy, provenance and migration/backup safeguards remain required. Splitting the UI does not grant cross-application access automatically.

Member/Bluepass parity includes the existing website workflows and wallet/card/offer capabilities. Cross-module actions such as SMS/newsletter execution belong to Portal; their navigation/context handoff must be designed without copying delivery screens into Organotiko or weakening authorization. Organizational assemblies and their analysis remain in Organotiko; operational event planning belongs to Portal. Organotiko reports cover its own domains; operational/financial reports remain in Portal.

Status: navigation/plans updated; member and Bluepass functionality is still planned, not implemented. No existing Portal/website repository or production system was modified by this scope update.


Audit date: 2026-11-02. Requirements authority: [PROJECT_SPEC.md](PROJECT_SPEC.md) and [AGENTS.md](AGENTS.md).

Labels: **[R]** confirmed requirement; **[E]** source/export evidence, not live verification; **[P]** proposal; **[A]** assumption; **[D]** unresolved decision; **[G]** missing evidence/gate. This is a design document, not executable DDL or authorization to migrate.

## Current authorization and scope

[R] Audit supplied repositories and exports, create planning Markdown only. No production connections or changes occurred. No application implementation, database replay or provider delivery was run. Future production writes, schema migrations, deletion and deployment require explicit approval plus a tested backup/restore plan. Existing repository instructions are not permission to execute their deployment commands.

[P] Use staged replacement with one authoritative writer per module at each transition. Keep Portal/public website working while extracting contracts and adding the scoped Organotiko interface. No uncontrolled dual writes. Final single-production-project destination remains undecided.

## Stage 0: establish trustworthy source manifests [G]

1. Obtain a current sanitized Portal schema-only export, applied migration inventory, function definitions/owners/search paths/execution grants, RLS/grants, indexes, triggers, constraints, extensions, custom roles, publications and schedules. Never assume all numbered SQL ran.
2. Confirm website export capture and drift. Inventory `external`, `public`, `external_fdw_backup`, quiz and remote FDW dependencies; identify which tables each active route/job uses. Do not copy backup foreign tables as live regular data.
3. Obtain Access schema/relationships, stable keys, queries/reports/forms/macros, de-identified examples and year/symbol dictionaries; obtain registration statistics template. Raw production records stay outside Git.
4. Inventory Auth settings and trigger hooks, user counts and identity collisions without publishing personal data; Storage bucket metadata/policies/objects; deployed function/config versions; scheduled jobs, provider queues, wallet models/pass IDs, redirects/domains and external consumers.
5. Build an encrypted, access-controlled manifest: source version/time, export checksum, schema coverage, row counts, dependency graph and known omissions. Schema dumps do not back up Auth users, Storage objects, secrets or hosting configuration.

No production pull/link command is run as part of this audit: even tools described as pull can write migration-history metadata.

## Stage 1: isolated rehearsal platform [P]

Create independent staging only in a later authorized implementation task. Use synthetic 200–300 student fixtures plus nonstudents, duplicate candidate identities, archived/status-0 records, membership/Bluepass and permission edge cases. No copied personal production data. Keep SMTP/SMS/Telegram/Pass2U integrations mocked or in dedicated test accounts; database isolation alone is insufficient. Disable real birthdays/scheduled campaigns.

Prepare reviewed schema baselines, excluding historical data INSERT scripts and FDW backup objects unless specifically required. Portal SQL 016 contains historical finance import content: preserve provenance in migration mapping but do not execute blindly as a schema baseline. Website `SCHEMA.sql` and access-only migration are not alternate full baselines. Verify custom roles before restoring policies. Restore into disposable isolated databases; test dependencies and fresh installs.

## Stage 2: identity and mapping rehearsal [P]

Import source records to restricted staging namespaces with source project/entity/key, batch and checksum. Import is rerunnable and stops on conflicting source keys. Produce field-by-field mapping worksheets: source name/type/nullability, target, transform, dictionary/timezone, relationship, sensitivity, conflict rule, test and reviewer. Access field mapping remains blocked until supplied.

Separate account linking from person linking. Preserve legacy principal IDs with source project qualifier. Review equal emails, technical username emails, inactive accounts and conflicting grants. Do not merge roles by union, auto-promote website admin to ORGANOTIKOS, or infer MASTER permissions. Choose supported Auth migration versus controlled reenrollment/password reset only after inspecting actual Auth constraints; never promise portable passwords or MFA secrets. Any forced reset preserves the MFA security requirement. Audit every approved account/person link and attribute enrichment.

## Stage 3: complete Organotiko in staging [R/P]

Implement core organizational/member/Bluepass/offer workflows in Organotiko, and preserve tasks/events/finance/newsletter/SMS in Portal per [MODULE_MATRIX.md](MODULE_MATRIX.md), sharing tested services and central Organotiko provisioning. Use adapters for existing contracts rather than an immediate rewrite. Migration of feature ownership is not release approval: Each owning application must pass its complete in-scope parity ledger before integrated production launch.

Preserve member/Bluepass forms and submission outcomes, private duplicate detection, pending/approval/deployment and wallet references. Keep membership and EFΕΚΘ separate. Preserve task assignments, team scopes, event-task templates, finance lock/reversal semantics, SMS exclusions and uncertain-delivery handling, newsletter schedules/preferences and lawful history.

## Stage 4: reconciliation and restoration drills [P]

| Domain | Required acceptance evidence |
|---|---|
| Every source table | Count by lifecycle/year, null distributions, duplicate/orphan report, source-to-target key coverage, transformed field checksums or documented exceptions, sequences/constraints/indexes |
| People and accounts | Approved mapping register; unmatched/quarantined list; no fuzzy auto-links or unauthorized privilege increases; account-person and manager links validated |
| Finance | Exact account balances by date, legs, allocations, reversals, expected settlement links, month-close snapshots and June–May totals; historical source references retained |
| Work/events | Assignment/checklist/comment/notification counts, stage/template linkage, no duplicate generated tasks; public versus operational events preserved separately |
| Membership/Bluepass | Counts/status/timestamps and deletion reasons; pass/model/batch/barcode references; no duplicate card issuance during reruns |
| Messaging | Subscriber preferences, exclusions, schedules and campaign recipients; accepted/failed/uncertain retained; no migrated job accidentally resends old messages |
| Organizational history | Year/symbol mappings reviewed; archived/status-0 reports stable; session before/after denominators and attribution stable |
| Storage/Auth/config | Private object access, restored object checksums, grants, redirects, factors/recovery policy and provider configuration verified separately |

Restore both source backups and the proposed central backup to isolated targets. Record duration, integrity checks, responsible operator, versions and encrypted off-server copy retrieval. Test loss of office server, failed jobs, partial import, queue retries and unauthorized API access. Define and approve recovery point/time targets and maximum downtime [D]. A dump file without a successful restore is not the gate.

## Stage 5: reviewed production cutover runbook [P; execution prohibited now]

1. Freeze a release manifest: source/target schemas and application versions, tested mappings, parity signoff, permission mapping, restore report, exact commands, responsible operator and go/no-go criteria.
2. Obtain explicit production approval covering the destination project, operations, maintenance window, legal retention/deletion decisions and tested recovery plan.
3. Back up each source and destination including Auth/Storage/config coverage. Stop all affected writers at API/job/database boundaries: Portal, website forms/admin, Ubuntu jobs, webhooks and worker queues. A maintenance banner alone is insufficient. Preserve queued work and provider acknowledgments.
4. Take consistent final exports with watermarks; import into approved central project; apply reviewed migrations in rehearsed order. Reconcile all tables, balances and statuses before permitting writes. Unrelated modules only continue if their independence was demonstrated.
5. Switch consumer contracts/configuration in an explicit dependency order; verify central Auth, RLS, MFA, account creation restrictions, private storage and public intake using approved smoke tests. Ensure old endpoints/jobs cannot continue writing or sending.
6. Reopen one authoritative writer per domain, then remaining clients; reconcile pending jobs against provider IDs before release. Observe queue health, errors, registrations and financial balances. Keep old systems secured read-only for the approved retention period.

## Rollback and failure boundaries [P]

Before central writes reopen: fail closed, retain new artifacts, restore old configuration and source writer ownership using rehearsed backups; verify schema/client compatibility before resuming. Revert migrations only through the rehearsed data-safe procedure, not improvised destructive down SQL.

After central writes or provider deliveries occur: switching back to an older source loses new work. Stop affected writers, preserve a durable delta ledger and delivery references, assess replay/forward repair or restore plus reconciliation, and obtain authorization for the selected recovery. SMS/email/wallet side effects cannot be undone with a database restore. Do not blindly resend uncertain items or regenerate wallet passes. Never delete source projects at cutover.

## Decision register

| ID | Unresolved decision / evidence | Why it matters / gate |
|---|---|---|
| D01 | Central project destination and hosting/DNS for confirmed domains | Auth continuity, data move size, dependent Quiz/FDW consumers; before deployment plan |
| D02 | Access schema, year rules, categories, symbols and report templates | No final mapping, progression or historical report signoff without them |
| D03 | Account/person matching, sensitive identifiers, retention/deletion policy | Lawful enrichment/history and safe credential deletion; before real data migration |
| D04 | Existing website action-level grants → central scopes; MASTER deferred | Prevent privilege escalation; before permission implementation signoff |
| D05 | Cross-domain login and recovery/session design | Assurance cannot depend on hostname/enrollment alone; before security acceptance |
| D06 | Website public/external table authority, FDW/Quiz ownership and consumers | Avoid duplicate imports and broken dependencies; before source retirement |
| D07 | Timezone/default conversion and historical registration/attendance codes | Avoid silent historic-data changes; before transformation approval |
| D08 | Nucleus secondary limits, student cardinality, annual registration corrections, paused-session exclusivity | Business invariants; before corresponding constraints |
| D09 | RPO/RTO, downtime, backup destination, office server connectivity and costs | Restoration and cutover go/no-go |

Only consequential business/data/security decisions need user resolution. Routine internal module structure and documentation can proceed without extra approval.
