# ORGANOTIKO — Codex Project Specification

Status: requirements handoff, 2026-11-02; application scope revised by user on 2026-11-03. Source: extended user discovery conversation. This is NOT an audited description of existing repositories. Greek terminology is intentional.

## Development database — confirmed 2026-11-04

The supplied hosted project `ikoqtvcobkmwshowgetc` acts as the shared development
database until application release. The user explicitly authorized pushing the
prepared schema migration there. Existing Portal and website databases are outside
this authorization. The final production/staging split and release cutover remain
separate readiness decisions. Supabase CLI may label the hosted main branch
“production”; that platform label does not change its current development use.

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

## Vision and non-negotiables
Build an extensible, fast, keyboard-first organizational management platform, not merely an Access clone. Clean, restrained UI, collapsible persistent sidebar, no unnecessary animations. Organotiko contains organizational workflows, complete member management, and complete Bluepass management including offers. Tasks, operational teams/events, finance, newsletter, SMS and other administration belong in the separate Portal. Portal continues as a separate interface for other users, backed by shared services/data. Prefer shared business logic/components, not independently maintained duplicate implementations. Add capabilities later without destructive rewrites.

## Existing estate (verify before migration)
1. Legacy Microsoft Access organizational student table, historically operated on office network. Contains years, school/department, contact, core assignments, notes, annual event intention/attendance columns, etc. Real data migration only after comprehensive tests.
2. Existing internal Portal: Cloudflare-hosted, Supabase-backed, functions reported include teams/groups, tasks, events, finance, SMS, action history and users. Keep its domain. Do not assume its precise schemas without inspecting code and database.
3. Separate Netlify website-admin project with **different Supabase database/project** and users. Screens reportedly show Members, Bluepass, offers, newsletter, analytics, website settings, users/action history. Inspect repo, database, RLS, auth and flows before deciding migrations. Public website application forms remain operational.
4. Google Sheets-based election and general assembly attendance application, near-finished; rebuild/integrate later, not initial scope. Intended independent vote URL e.g. vote.organotiko.com.
5. Ubuntu office server available for scheduled jobs, backups, exports, monitoring; system must remain online if office server unavailable (only its jobs pause).

## Architecture
- Target: one central production Supabase project/database for all integrated functions, with independent staging project and synthetic data. Logical modules/schemas, stable IDs and foreign keys; strong RLS, server-side authorization, audited mutations.
- Frontends may run on multiple domains/deployments (Organotiko, existing Portal, public site, later vote), but share centralized identity, data and business services. Avoid treating domain boundaries as database boundaries.
- Common codebase/monorepo is a recommendation pending repository inspection. No premature rewrites of working apps.
- Auth shared across apps; enforce TOTP MFA for access to Organotiko on server/database, not just UI. Portal does not require MFA. Cross-domain SSO requires deliberate implementation; don't assume cookie sharing.
- Server runs backup automation, periodic aggregations, scheduled messages/jobs and heavy exports where appropriate. Queue/retry/idempotency and logs. Backups encrypted, off-server copies, restore drills; distinguish Postgres dump from Supabase Storage/Auth/config coverage. No public database admin ports.
- Separate staging and production, versioned migrations, rollback strategy, CI tests, seeded 200–300 synthetic student records. Preserve data during migration with reconciliation and audit.

## Data model concepts (design, do not assume exact field names)
- `person` is a general identity, potentially not a student in Thessaloniki. `student_record` optional; people may exist as Protoporia members, Bluepass applicants, Portal users, or nucleus managers without student record.
- Person matching across sources: candidates by name variants, surname spelling, phone, ID where lawfully held, department, social context; require human confirmation for ambiguous matches. Never silently merge based on fuzzy name. Preserve source identifiers and provenance. If confirmed, enrich missing organizational details only after approval; no destructive overwrite.
- Membership in Protoporia is **distinct** from EFΕΚΘ association membership. Protoporia membership and Bluepass statuses should reflect in organizational student view if linked, but persons can be outside student table.
- `nucleus` (πυρήνας) has category, name/manager (manager need not be a student or Protoporia member), assigned students, primary and optional secondary nucleus. Categories include στελέχη-μέλη, μη στελέχη, άλλες παρατάξεις, απυρήνωτοι and others to be verified. Placeholder ΑΠ26 rolls annually to ΑΠ27 etc; it is a grouping, not a meaningful real nucleus. Need category and per-nucleus counts of registered/unregistered and total people/nuclei. Reassignment when manager inactive; maintain history.
- Student status 0 and archived records excluded from everyday operational table/search, while permissible history remains intact. Archiving/deletion must not retroactively corrupt registration, assembly, election or reporting history. User selected remove from active table while preserving permitted history.
- Uppercase input is standard throughout Organotiko, with exceptions where explicitly specified; latest clarification: only information/notes history needs special handling rather than annual columns. Notes show latest text and optional change history.
- Organotikos can define custom columns/fields such as Instagram/address with metadata, types and permissions; design typed extensibility rather than unsafe arbitrary SQL column creation.

## Core organizational grid
- First home dashboard: clear function choices. First main option is Πίνακας Οργανωτικού.
- Spreadsheet/Access-like editable grid, hide/unhide columns, compound filters (add/change/remove any), sorting, keyboard interaction, saved personal/shared views, user-selected default view. Efficient at large scale and concurrent use.
- Quick separate search form/tab optimized for mobile and targeted lookups. Results show name, department, year, EFΕΚΘ registered status, primary nucleus; exclude archived/0 from normal daily lookup.
- Export either (a) visible columns of filtered students or (b) all fields of filtered students, chosen per export.
- Dynamic reports and saved templates, printing; charge/assignment reports by nucleus with dropdown, preview, bulk printing as combined PDF (new page per nucleus) or individual PDFs.
- On concurrent edits, permit different-field updates; detect same-field conflicts, offer resolution, preserve audit and avoid silent overwrites.

## Dedicated «Οργανωτικό» review sessions
- Prepare multiple sessions/templates with filters and columns; only **one active review session at a time globally**. Filters can be created at session start, including via shortcut from current main grid filters; other ORGANOTIKOS can see shared presets.
- Freeze session student cohort at actual start. No adding students to an active session; handle omitted people later separately. During session display/edit grid; change filters, sorting, visible columns without changing frozen cohort.
- Sequential keyboard navigation: Enter and Down both save current cell and go to same column next row; Up previous row; Tab/Shift+Tab adjacent fields; Esc cancel unsaved edit. Moving downward marks previous row examined; returning to examined rows allowed; no skipped status.
- During session only show progress X/Y (unique examined students / frozen total), not live stats or distracting widgets. No internal dedicated student search needed.
- Session lifecycle: planned, active, paused, completed, cancelled. Completed locked; cancelled cannot be resumed; previously saved student changes persist even if cancelled. Preserve session history and attributable change log. Existing session changes only counted in its own summary, not other users' external edits.
- After completion configurable reports, compare before/after for (a) examined students and (b) entire cohort, switchable. Choose metrics before or after, re-analyze later, save templates, optional detailed change log. Clone session settings into a new session. Historical snapshots should be stable.

## Academic years and EFΕΚΘ registrations
- Academic-year advancement is manually triggered with a button, never automatic. Roll normal year codes, including 01→02 etc; postgraduate 9 becomes 91/92 to distinguish years; handle degree duration N per school and transition beyond N into N1 and subsequent rules to finalize from legacy data. Distinguish IEK, postgraduate, N+ counts. Year advancement must NEVER automatically set EFΕΚΘ membership false.
- EFΕΚΘ status is an independently controlled boolean. Registration requires date (default today) and result/source code. Before registration intention can be blank or 1/2/3; after true, actual registration source is one of +, ψ2, ψ3, ψ4, ψ5, μ (confirm allowed values in migration). Annual registration field starts blank for new academic year, previous years retained.
- Registration windows: two ~7-day periods in first semester plus ΑΓΣ day, two in second plus ΒΓΣ day; optional extra ad hoc periods. Sundays may have no registrations. Reports show daily and historic-year comparisons; preserve statistics when student status changes or record archived. Never conflate Protoporia membership with EFΕΚΘ registration.
- A unique ID for EFΕΚΘ registered persons will be added in a later phase for election/assembly attendance; do not implement complete election workflow now.

## Assemblies, intentions and reporting
- Per assembly/year store intention symbols (commonly 1,2,3, λ, ψ2, ψ3, ψ4, ψ5, others to validate) and actual attendance and vote/outcome separately; 9 may indicate attendance in legacy workflow. Reports: counts by initial intention, actual behavior by intention, totals by faction, year, department, university; optional previous assembly comparison.
- Intention fluctuations: automatic daily aggregate snapshots plus manual snapshots whenever needed, spanning weeks before event; maintain timeline and history.
- Exclude obsolete symbol groups ΚΦ, ΑΓ, ΜΠΕ, ΑΝΑΓ from planned supported faction codes per latest instruction; ψ2–ψ5 remain relevant.
- Event-day application later: freeze roster snapshot before vote/assembly, record unique ID attendance, timestamp and duplicate detection in separate event-day system, leave central organizational records untouched during event, reconcile afterward. Assemblies may allow same-day registration of someone not on roster; elections may need live individualized charge lists. These details are deferred until later Google Sheet audit.

## Accounts and authorization
- All user accounts are created **only** from Organotiko central user management, including bulk creation. Existing Portal and Netlify users need audited migration/identity linking. New accounts have temporary password, forced change on first login. Organotikos can reset password to temporary password, not reveal old password; resetting password must not bypass MFA.
- Roles: ORGANOTIKOS all equal and highest; has full Organotiko capabilities and central account management for both applications; Portal ADMIN functionality is accessed in Portal subject to its authorization policy. MASTER: Organotiko permissions deferred until real app can be evaluated; each MASTER separately assigned Portal ADMIN or ΗΓΕΣΙΑ. Other roles Portal-only: ADMIN, ΗΓΕΣΙΑ, ΣΥΝΤΟΝΙΣΤΗΣ, ΜΕΛΟΣ. Add granular permissions by feature (e.g. a ΜΕΛΟΣ may administer only Bluepass or newsletter in Portal), independent of broad role.
- Users may have optional link to a person/student, and nucleus assignment even without student record. Nucleus ownership/management associations must avoid invalid conflicting assignments; managers may manage multiple nuclei.
- Organotiko requires TOTP authenticator MFA, Portal does not. Recovery: 10 one-use codes shown once, stored securely hashed, not emailed/SMS; optional supervised MFA reset by another ORGANOTIKOS after identity verification and audit. Note recovery-code functionality may require custom implementation beyond Supabase native MFA.
- User explicitly wants **permanent account deletion**, not merely disable. Revoke sessions and credentials, allow recreation later; delete account independently of linked person/student/nucleus records, preserve only legally permitted operational audit/history under defined retention policy. Design cascading foreign keys carefully.

## Integrations and UI parity
- Application ownership follows the confirmed 2026-11-03 split above. Preserve all existing capabilities in their owning application; do not embed tasks, operational events, finance, newsletter or SMS screens in Organotiko.
- Organotiko must include complete website-equivalent member management and Bluepass management, including offers, cards and wallet workflows. Shared logic/services are preferred.
- Portal and public website can stay on their domains. Account creation for both apps occurs only in Organotiko; shared Auth does not imply automatic cross-domain SSO.
- Keep member signup, Bluepass and newsletter public forms operational. Link reviewed identities to organizational student cards where authorized.

## Phasing
1. Audit existing Access schema/workflows, Portal code/DB, Netlify code/DB and current authorization. Write mapping and migration plan.
2. Build modular core Organotiko, grid, sessions, nuclei, registrations, reporting, identity framework in staging with synthetic records.
3. Integrate shared services/data while implementing each module in its owning application; complete member/Bluepass/offer parity in Organotiko and central account creation for both apps. Preserve Portal operational workflows and public forms.
4. Test backups, concurrent edits, performance, security, migration and restore. Only then move real Access and external project data to production.
5. Later: election/general assembly event-day app from Sheets, refined MASTER permissions, new features and automation.

## Critical open discovery items (do not guess)
- Full Access columns, exact year-code transitions, category taxonomy, event symbols, reports, Excel registration statistics template.
- Netlify project source, DB schema, auth, roles, workflows, public forms, newsletters, consent, Bluepass card issuance, offers, storage and action logs.
- Portal source and database schema, finance and SMS integration, user migration details.
- Matching policy for existing users/persons and GDPR retention, deletion and lawful access.
- Production domain names, hosting and deployment, server connectivity, backup destinations and operational costs.

## Codex implementation instruction
Begin with repository/database **read-only audit** and output `ARCHITECTURE.md`, `DATA_MODEL.md`, `MIGRATION_PLAN.md`, `MODULE_MATRIX.md`, `IMPLEMENTATION_PLAN.md`, and an initial backlog. Do not mutate production data or deploy until explicitly authorized. Preserve working systems; test with synthetic data. Distinguish confirmed requirements above from implementation recommendations and unresolved details. Ask only consequential questions, not trivial UI confirmations.
