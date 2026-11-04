# Feature inventory and module ownership

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

Status labels: **[R]** confirmed requirement; **[E]** confirmed in supplied source/export, not verified in production; **[P]** proposed design; **[A]** assumption requiring validation; **[D]** unresolved consequential decision; **[G]** missing evidence / gate. No application code, database connections, migrations, deliveries, or deployments were performed during this audit.

## Reading the matrix

All existing rows below are [E]: source workflows exist, but are not runtime-certified. Application ownership follows the current split above [R]. Proposed owners are [P]. Portal access to website modules is permission-based; it does not grant everyone access. A feature is complete only when its actions, validation, permissions, side effects, history, error handling, filtering and exports pass fixture-driven parity scenarios in its owning application.

Source roots: **P** = `../organizer-kypros`; **W** = `../website`.

| ID | Existing interface and verified source | Workflow inventory to preserve | Proposed owner / other consumers |
|---|---|---|---|
| P01 | P `src/App.tsx`, `types.ts` | Overview, personal task list, all-task directory, priorities, due dates, statuses todo/in_progress/in_review/done, review requirement, assignment | Work module; Portal |
| P02 | P `App.tsx`; SQL 001,010 | Create personal/team tasks; edit/delete; multiple assignees; checklist ordering/toggle; comments; linked event label; notifications and mark-read | Work module; Portal |
| P03 | P `App.tsx` TeamsPage; SQL 004,007 | Groups, membership, team coordinator access, team-scoped management | Teams module; independent from nuclei |
| P04 | P `EventsPage.tsx`; SQL 004,009,012,018 | Calendar/program; planning/confirmation/cancellation; types, colors, active state and ordering; task templates, optional template assignee and ad hoc event tasks | Operational events; Portal |
| P05 | P `FinancePage.tsx`; SQL 012–021 | Accounts/categories; income/expense registers; first and later payments; full entry edit; transfers; opening balances; event allocations/filter; expected items with unknown amount/date; settlement and cancellation; reversals | Finance; Portal |
| P06 | Same finance sources; `financeMath.js`, `financePeriod.js`, `financeEventFilter.js` | Monthly and June–May fiscal summaries/CSV; sequential past-month close snapshots, admin reopening with reason; reconciliation without automatic balance correction; finance audit; admin permanent register deletion with confirmation, reason, dependency/month-lock guards | Finance; preserve historical import provenance. SQL 020 removes receipt subsystem conditionally: deployed state pending |
| P07 | P `SmsPage.tsx`, `smsImport.ts`; `worker/sms-core.js`, `sms-providers.js`, `personalized.js`; SQL 006,011 | Provider/sender choice, preview/confirmation, bulk and personalized campaigns; Excel/CSV validation; APPEND/REPLACE lists; contact add/remove/search/paging; embedded list clear; exclusions; sender-ID administration | Messaging; Portal |
| P08 | Same SMS sources | Campaign history and full recipient CSV; queued cancellation; accepted/failed/uncertain statuses; personalized values hidden from history; claim/reconcile/cleanup logic | Messaging + job runtime; preserve encryption/retention behavior after verification |
| P09 | P `App.tsx` PeoplePage; `worker/index.js` | Username login, profile display, independent position title, active state and role/extras; user create, temporary reset, password change, permanent delete; task/group links | Organotiko central identity. Existing Portal provisioning must transition to Organotiko-only [R] |
| P10 | P `App.tsx` AuditPage; SQL 008; Worker | Operational audit and validated security events; final audit access restricted by later migration | Audit; explicit access policy, no old `view_audit` assumption |
| W01 | W `MemberManager.jsx`, modals; `MemberRegistration.jsx` | Public application; duplicate checks; member search/status/filter/sorting/paging; approve, edit, comment, flag and deletion reason/history; bulk SMS and approval email | Protoporia membership; Organotiko + unchanged public intake |
| W02 | W `modals/MemberCardModal.jsx`; `lib/pass2uClient.js`; Netlify Pass2U function | Member-card creation/status/update, void/unvoid controls, link/QR presentation and SMS | Wallet adapter + membership; distinct from Bluepass |
| W03 | W `BluepassManager.jsx`, `EditBluepassModal.jsx`, `DeleteBluepassModal.jsx`; `BluepassApplication.jsx` | Public application, duplicate checks, pending/approved/deployed/deleted lifecycle, edit/flag/delete, batches/barcodes/deployment timestamps, SMS tracking and bulk SMS | Bluepass; Organotiko + public intake |
| W04 | W `modals/Pass2UModal.jsx`, `NotifyPassModal.jsx`; Pass2U client/proxy | Create/update/status, void controls, wallet link and notifications; proxy reset-attribute/reset-field actions must be inventoried even if not directly surfaced | Wallet + Bluepass; provider state is not disposable migration data |
| W05 | W `OffersManager.jsx`; public `BluepassOffers.jsx`, `DealFinderMap.jsx` | Offer create/edit/delete, category/discount/image/link, activation and ordering, address/geocoding/coordinates; public offers and map | Offers/publication; Organotiko + public website |
| W06 | W `NewsletterManager.jsx`, `NewsletterRegistration.jsx`; `scripts/schedule_message.py` | Public subscription, event/generic/student alert preferences, department filtering, subscriber soft deletion; immediate/scheduled message, editing/sending scheduled messages, cancellation/history/errors and counts | Newsletter + Messaging; preserve preference semantics and scheduled work |
| W07 | W `AnalyticsDashboard.jsx`, `BluepassAnalytics.jsx`, `AdminDashboard.jsx` | Separate membership/Bluepass distributions and trends, dashboard counts, filters/charts | Reporting over membership and Bluepass; Organotiko for membership/Bluepass analytics |
| W08 | W `ConfigManager.jsx`, `lib/configService.js`, `ConfigContext.jsx` | Typed text/boolean/object/JSON/select configuration editing; maintenance and public notification/content controls; provider and wallet configuration dependencies | Website configuration; public-safe projection separated from private integration settings |
| W09 | W `UserActivityPage.jsx`, `LogsModal.jsx`, `LogsButton.jsx`; invitation function; admin auth components | Display names/roles/member link, invite acceptance, users and filtered activity/history, MFA setup/login/profile controls | Central identity + Audit; replace future invites with required central account flow, preserve attribution |
| W10 | W `NewsManager.jsx`, `EventsManager.jsx`, `App.jsx` | News CRUD/public article data and public event CRUD components exist; their `/admin/news` and `/admin/events` routes are commented out in `App.jsx` lines 183–184, so these are dormant components rather than confirmed active admin screens | Content/public events; preserve separately from operational events |
| W11 | W public components, `lib/validations.js`, Netlify notification/SMS functions | Member/Bluepass/newsletter forms, validation and feedback, privacy/terms and public content; Telegram registration alerts; EmailJS approval integration | Public intake/content + delivery adapters; public URLs preserved |
| W12 | W `scripts/birthday-bot.js`, `schedule_message.py`, `send-sms.mjs` | Ubuntu birthday messages and scheduled newsletter/SMS jobs, direct database access and provider dependencies | Job runtime + Messaging; credentials/delivery disabled in staging |
| W13 | W remote schema `quiz.*`; `adminNav.jsx` external Quiz link | Hosts/quizzes/players and create/join/session/status/submit RPCs exist in export; separate Quiz frontend is not supplied | Preserve as external dependency; ownership and full interface scope unresolved [D] |

## New organizational modules [R], proposed ownership [P]

| ID | Module | Required Organotiko capabilities / invariants |
|---|---|---|
| N01 | People + students | General person, optional student record, provenance and reviewed links; status 0/archive hidden from normal grid/search; identity matching never silently merges |
| N02 | Grid + views | Editable scalable grid, hide/show, compound filters and sorting, personal/shared/default views; mobile quick search; visible/all-field filtered export modes; uppercase rules and configurable typed fields |
| N03 | Nuclei | Categories/managers, primary/secondary assignment history, multi-nucleus managers independent of student membership, reassignment, placeholder annual roll, registered/unregistered counts |
| N04 | Review sessions | Multiple plans/templates, globally one active, frozen cohort at start; no additions; Enter/Down save-next, Up previous, Tab/Shift+Tab adjacent, Esc cancel; downward movement marks examined; progress only X/Y; lifecycle and locked snapshots; examined/all-cohort reports; own-change attribution and clone settings |
| N05 | Academic progression | Explicit manual advancement, audited preview and approval; year codes 01→02, postgraduate 9→91/92; unresolved N/N1/IEK rules; never reset EFΕΚΘ boolean automatically |
| N06 | EFΕΚΘ | Independent membership boolean; annual blank registration field, date/source and intentions; configured registration windows/ad hoc periods; daily/historic comparisons stable after archive/status changes |
| N07 | Assembly analysis | Intention, attendance and outcome separately; daily/manual aggregate snapshots and trends; faction/year/department/university reports and previous-assembly comparison; preserve unsupported legacy codes without enabling obsolete groups |
| N08 | Reports | Saved dynamic templates, printing/export, nucleus assignment report preview; combined PDF with new page per nucleus or separate PDFs; historical denominators stable |
| N09 | Security/admin | Equal ORGANOTIKOS, granular grants, bulk accounts, forced change/reset, TOTP/recovery, permanent credential deletion, retained lawful operational history |
| N10 | Later expansion | Event-day frozen roster, unique-ID attendance/duplicates and reconciliation; Sheets audit and MASTER permissions deferred |

## Parity acceptance ledger [P]

For every P/W row record: source revision, scenario IDs, permission/resource scope, input fixture, before/after records, integration side effects, errors/retry behavior, exports, owning application route, shared/public consumer, test result and reviewer. Current state for every row: **source inventoried; implementation and runtime parity unverified**. No integrated release until every in-scope row is accepted. A missing route or undocumented production-only behavior expands the inventory; it is not silently dropped.

[D] Confirm whether the separate Quiz application is part of full website-admin scope or only a preserved external dependency. News/event admin routes are commented out in the supplied snapshot; retain the components in the parity discovery scope and confirm whether they should be re-enabled. Existing website users named viewer-members can read members but cannot mutate them under exported external-table policies; do not map role names without action-level review.
