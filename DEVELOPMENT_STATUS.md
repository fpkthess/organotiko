# Development status — 2026-11-02

## Milestone 1: local shell and organizational grid

Implemented a React/TypeScript npm workspace in this repository. No existing repository was modified. No production connection, SQL execution, deployment, account change or external message delivery occurred.

| Backlog | Current status |
|---|---|
| B007 | Synthetic student generator and local test/build setup complete. Hosted staging, schema baseline, Auth, fake provider contracts and restore drills remain pending. |
| B008 | Greek home, responsive navigation, persisted sidebar preference and Cmd/Ctrl K search implemented. |
| B009 | Minimal person/student fixture identifiers and operational visibility implemented. Reviewed identity linking, full provenance and archival commands pending. |
| B010 | Paginated grid, combined search/department/registration filters, sort, column visibility, local personal/default views, quick-search cards and visible/all-field CSV implemented. Arbitrary filter builder, shared views and large-scale backend queries pending. |
| B011 | Editable name/surname/notes, in-memory attributable field deltas and compare-and-set domain function implemented. Persistent audit, field permissions, database concurrency enforcement and custom fields pending. |
| B012 | Read-only synthetic nucleus counts and filtered-grid navigation implemented. Managers, taxonomy, assignment history and reassignment pending. |
| Remaining modules | Navigation and explicit planned-function lists only. No parity claim. |

Student records and change history are memory-only; refresh resets edits. Personal views/default selection and sidebar preference persist in this browser. The prototype is deliberately unauthenticated and must use synthetic data only. Notes preserve entered case as a provisional UI choice; final normalization/history rules remain subject to requirements validation.

## Verification

- Strict TypeScript compilation and Vite production build passed.
- Four domain tests passed: 250 unique fixture identities and active visibility; independent-field updates and stale-field conflict; Greek accent normalization and blank-name rejection; CSV escaping/formula neutralization.
- Browser checks: grid render, Enter save and next-row edit, Escape cancel, edit appearing in search, combined department/EFΕΚΘ filters, saved view restore and export choices.
- Visual inspection at the default narrow viewport and a 1440 × 1000 desktop viewport. Desktop grid screenshot: [preview](docs/previews/grid-desktop.jpg).
- CI workflow added for install, tests and build. CI has not run remotely.

These checks do not certify multi-user operation, RLS/MFA, full accessibility, delivery behavior, migration or production readiness. The UI's change log is session-local, not a secure audit trail.

## Next implementation slice

Refactor the grid interaction and view persistence into dedicated modules; add an arbitrary typed filter builder, robust cell focus/navigation and tested conflict-resolution UX. Then implement local review-session domain invariants and session UI with synthetic data. Introduce a validated backend adapter and server authorization only against an independently identified staging project. Access schema, current deployed Portal schema, granular authorization decisions and retention rules remain gates for real-data integration.

See [README.md](README.md) for run commands and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the full phased backlog.

## Scope revision — 2026-11-03

Organotiko navigation now contains only organizational work, members, Bluepass/offers, organizational reports and central users. Tasks, operational events/teams, finance, newsletter, SMS and website settings were removed from its planned screens and home shortcuts; they belong in the separate Portal. The user-creation plan explicitly covers both applications. The earlier complete-superset plan is superseded. No production, existing Portal or website changes were made.

## Delivery clarification — 2026-11-03

Confirmed separate app domains: `organotikos.com` and `portal.protoporiathess.com`; one shared production database. Existing Portal and website modules will be migrated/reused, not rebuilt. New development is focused on Organotiko's organizational capabilities and required integration. Current member/Bluepass placeholders represent pending migration of existing functionality, not a plan to reinvent those modules. No DNS, deployment, database or source-application changes were made.

## Milestone 2 — filters and review sessions, 2026-11-03

Implemented modular domain logic (`filters.ts`, `reviews.ts`) and reusable React filter/session components. Existing Portal and website modules remain unchanged.

- Arbitrary flat filter conditions across names, department, year, nucleus, notes and membership/Bluepass booleans; typed comparisons, empty/not-empty, accent-insensitive Greek matching, AND/OR groups. Grid views now save these filters along with sort and columns. Search exposes inherited advanced conditions and clearing removes them.
- Session planning with editable start filters, cloning settings, frozen cohort/baseline at actual start, active/paused/completed/cancelled lifecycle, and one active session within the current app's domain state.
- Active sessions allow view-only filtering, surname sorting and notes-column visibility without changing the frozen cohort. There is no dedicated student search or live statistics in the session; examination progress is X/Y.
- Editable name/surname/notes; Enter/Down saves and examines the current row, then moves down; Up moves back; Tab/Shift+Tab navigate adjacent editable fields, including row boundaries; Escape cancels the unsaved cell. Explicit mark-examined action handles row review without editing. Validation/conflicts leave progress unchanged.
- Completion/cancellation confirmation, terminal state locking, unique examined IDs, saved student changes surviving cancellation, own-session change history, immutable baseline/final snapshots and examined/all-cohort summary scopes. Partial completion is explicitly disclosed before confirmation; no invented requirement to examine everyone.
- A grid shortcut transfers AND conditions and existing department/registration filters to a new session plan. Free-text search and OR groups currently require preparing session filters directly; the shortcut is disabled with an explanation rather than silently changing filter semantics.

Verification: strict TypeScript/Vite build passed; all ten domain tests passed. Tests cover typed filters, freeze timing, archived/zero exclusion, pause/resume preservation, single-active guard, failed edits, unique examination, terminal locks, cancellation retaining changes and fixed report snapshots/session-only attribution. Browser checks exercised planning, editing, Enter progress, Tab/Shift+Tab, Escape, pause/resume, completion, summary and clone/filter-form regression. Fixed an add-filter button that inadvertently submitted the parent plan form. Preview: [review session](docs/previews/review-session.jpg).

Limits: still synthetic and in-memory. Refresh loses records/session history. Single-active enforcement is local to one app instance, not global across browsers/users; a database transaction/constraint is required before real use. There is no authenticated actor, durable audit, RLS/MFA or backend concurrency boundary. Session columns beyond notes, configurable report metrics/templates, printable reports, shared presets and durable saved sessions remain pending. Existing filter UI supports flat AND/OR groups, not nested Boolean expressions. Sessions edit only the fixture's name/surname/notes fields; unverified Access fields and registration semantics are not invented.

## Milestone 3 — nucleus management, 2026-11-03

Added `packages/domain/src/nuclei.ts` and the modular `NucleiManager` interface. Nuclei, categories, manager people, student assignments and manager assignments have separate stable IDs. The grid projects primary/secondary nucleus names from the assignment model; a nucleus rename does not rewrite assignment identities. The secondary nucleus column is also available in typed filters and CSV exports.

Implemented:

- Category creation and filtering, nucleus creation, name/category/placeholder edits with history and change reasons. Initial category is explicitly synthetic; no unverified legacy taxonomy is enforced.
- Primary and optional secondary student assignment, reassignment and clearing. Previous assignments retain start/end dates. Same primary/secondary nucleus is rejected, and one current assignment per kind is maintained by domain commands.
- Independent manager people, optional explicit student links, multiple nuclei per manager, activation/deactivation, and explicit manager replacement with history. Deactivation preserves links and flags affected nuclei for reassignment. No membership or student-card requirement is imposed on managers; same-name people are not merged.
- Unique active-student counts by nucleus/category, with EFΕΚΘ registered/unregistered splits and separate primary/secondary counts. Archive/status-0 records remain excluded from operational counts. Placeholder groups are counted separately from real nuclei. Managers are not silently counted as assigned students.
- Assignment/change history and an exact primary-nucleus grid shortcut. Student and manager changes are visible across the local app without a database connection.

Verification: TypeScript/Vite build and all 16 domain tests pass. Six new tests cover primary/secondary conflict prevention, historical reassignment, de-duplicated counts, stable-ID rename/category movement, independent multi-nucleus managers, inactivity/replacement preservation and explicit identity links. Browser checks exercised category/nucleus creation, manager assignment, secondary student assignment, independent manager creation, deactivation warning, replacement and history.

Limits: all records, people, assignments and history remain synthetic and memory-only. Domain guards do not replace server/database constraints, authorization or concurrent mutation checks. No production schema or external app was modified. Category rename/retirement, manager identity provenance/review, bulk reassignment, automatic/year-roll operations and printable nucleus reports remain pending. One optional secondary assignment is the prototype's current interpretation; confirm legacy cardinality before final database constraints. Category totals count unique assigned active students, not manager identities or unassigned people. Existing text-based saved filters match names and do not yet retarget automatically after a nucleus rename.

## Milestone 4 — organizational reports, 2026-11-03

Added a report domain module and report builder UI, using the same stable nucleus IDs, student assignments and active-record visibility as the grid.

- Nucleus assignment reports with all/selected nucleus scope, primary/secondary/both assignments, optional empty sections, typed filters, selected columns, sorting and a configurable title. A separate flat student report includes unassigned active students.
- Fixed preview snapshots: student fields, category, manager label, totals and report configuration are copied at generation. Later changes to source records or names do not rewrite an existing preview. Previews survive navigation within this app instance; reload still resets memory-only data.
- Unique student count and total row count are separate. Students can appear in two nucleus sections under the combined-assignment scope without inflating the distinct-person total. Each section reconciles registered plus unregistered against its row count.
- Personal report templates persist validated configuration in browser storage, with load/remove controls. Templates store stable selected nucleus IDs and no student snapshot data. Invalid/stale nucleus selections fail explicitly rather than silently widening to all nuclei.
- CSV exports include group/category/manager context, selected columns, Greek text, quoted delimiters/newlines and formula neutralization. Exports use the displayed snapshot; changed settings disable export/print until preview regeneration.
- Single-section and combined browser printing/Save as PDF, with A4 landscape layout, new page per nucleus, repeated table headers and printable-only output isolation. Separate PDFs currently require selecting/printing each section manually; automatic bulk individual PDF files/ZIP is not implemented.
- Nucleus detail provides an exact-ID shortcut into its assignment report. Report snapshots and templates are independent of Portal operations.

Verification: strict TypeScript/Vite build passes and all 23 domain tests pass. Seven report tests cover scope/counts, secondary de-duplication, sort, active-only visibility, unassigned student reports, rename-stable IDs, immutable snapshots, malformed templates, invalid selections, empty-section policy and CSV handling. Browser checks verified report generation, settings-change export guards, template save/load, the nucleus-to-report shortcut, combined print preview and single-section print preview. Native Chrome print preview rendered Greek text and repeated headers; spacing was tightened after visual inspection. Print dialogs were cancelled, with no physical print or PDF file saved. Screen preview: [organizational report](docs/previews/reports.jpg).

Limits: still local/synthetic, with no backend authorization, RLS/MFA, durable snapshots or shared templates. Browser print settings influence pagination, headers/footers and PDF filenames; no exact identical pagination across browsers is claimed. No automatic bulk individual PDF export or custom-field/report-metric system yet. Registration-year, assembly and Access-specific report semantics remain gated on the missing legacy definitions. No production or existing external-app changes were made.

## Milestone 5 — student cards, custom fields and archive, 2026-11-03

Implemented student cards accessible from grid rows and mobile quick-search results. Cards display independent EFΕΚΘ, Protoporia and Bluepass states, primary/secondary nuclei, and the synthetic source identifier. Notes are editable on active cards; previous values are retained and combined with grid/review-session changes, with source attribution. Custom-value and archive-status changes have separate local history.

Typed custom fields now support text, number, date, boolean and selection-list values. Empty, false and zero remain distinct; date/number/selection validation is centralized. Field definitions have stable IDs, labels, normalization rules, editability and retirement flags. Types/options/normalization cannot be changed in place; retirement preserves existing values/history. Address and Instagram are synthetic starter definitions. Value writes compare the expected value to prevent stale same-field overwrites and reject inactive-card or read-only/retired-field changes. The editability flag is an application-level prototype rule, not authenticated role authorization.

Active custom fields can be shown/hidden as grid columns, with visibility saved in personal views. Clicking a custom cell opens the typed card editor. Visible-column CSV includes selected custom columns; all-field CSV includes retained retired custom values too. Dynamic custom-field filters, custom-column sorting, review-session custom editors and custom columns in report templates remain pending.

Archive/restore requires a reason, preserves the person record, memberships, assignments, note/custom histories and existing report/session snapshots, and changes only operational visibility. A separate archive/status-0 view provides access outside normal daily search. Restore requires an explicit choice between active and status 0, rather than guessing historical status. No deletion workflow was added. Existing active review cohorts stay frozen; archive actions do not remove their members retroactively.

Verification: build and all 30 domain tests pass. Seven added tests cover typed values, read-only/retirement behavior, stale edits, status/history preservation, historical report/session stability, note attribution and CSV export scope/formula safety. Browser checks verified opening from quick search, multiple note versions, text normalization/case preservation, creating a numeric field, invalid numeric rejection and zero preservation, archive exclusion/read-only card state, restore with values/history intact, and custom values displayed as grid columns. Preview: [student card](docs/previews/student-card.jpg).

Limits: all student/custom/status state remains synthetic and memory-only; refresh resets it. No schema migration, production access or external application change occurred. Authentication, field-level server permissions, durable provenance/audit and multi-user concurrency remain pending. No legacy Access columns, code dictionaries or retention rules were inferred.

## Milestone 6 — annual EFΕΚΘ registrations, 2026-11-03

Added a registration domain and UI, linked from student cards and the main navigation. Student grid/filter/report projections now expose the current year's annual value and registration date separately from the current EFΕΚΘ boolean.

Implemented:

- Configurable registration reporting years and periods, including ad hoc/assembly-day periods and optional Sunday exclusion. Dates must be real calendar dates within the selected period/year. Synthetic fixture boundaries and source codes are explicitly provisional, not an audited legacy mapping.
- Blank/1/2/3 intention before actual registration; dated actual registration with an allowed source and explicit period. The saved intention remains separately attributable after registration. A duplicate person/year actual record is rejected in the prototype.
- Registration sets current EFΕΚΘ membership true and records that change. Independent membership changes require a reason and do not remove or rewrite annual entries or their counts. Protoporia/Bluepass attributes remain untouched.
- Reasoned, revision-checked date/source/period corrections retain prior values in local history. Historical corrections do not silently alter current membership. The original name/department/year/nucleus snapshot remains fixed on the annual record.
- Daily and source totals, cumulative period totals including zero-registration days, and a clearly labeled previous-year total. Statistics count annual records independently of current student status; archived/status-0 records remain in historic counts.
- A new reporting year starts empty without switching the active registration year, advancing academic codes or clearing membership. The current prototype does not implement academic-year activation/advancement; unverified N/N1/IEK/postgraduate transitions remain blocked.
- Existing and historical annual ledgers are visible; new actual records/intention edits require active students and the current registration year. Historical records can receive reasoned date/source corrections. No registration deletion/cancellation policy was invented.

Verification: build and all 37 domain tests pass. Seven added registration tests cover intention/actual/current-status separation, person/year duplicate guards, date/source/period validation, Sunday exclusion, revision conflicts, independent membership, archive-stable statistics, zero-count dates and blank future years. Browser checks verified the student-card shortcut, intention save, actual registration, native date correction, source correction, independent membership false with annual record retained, period creation/Sunday rejection, blank reporting year and daily totals. Preview: [registration statistics](docs/previews/registrations.jpg).

Limits: synthetic, in-memory, unauthenticated. No production schema, data, deployment or external app changed. Current fixture codes `+`, `ψ2`–`ψ5`, `μ`, date boundaries and one-person/year uniqueness are provisional until the actual Access data/workflows and repeat-registration/correction policy are reviewed. The date default uses Asia/Nicosia for the local prototype; the production operating-timezone contract still needs validation. Previous-year figures are whole-year totals, not an aligned-day comparison. Registration-statistics CSV/PDF templates, bulk entry, period editing/closing, source-code governance, central person-only registrations, permanent storage, RLS/MFA and global concurrent-write enforcement remain pending.


## Database read foundation — 2026-11-04

Confirmed: linked production is PostgreSQL 17.11 with no application tables or Auth users.
Implemented locally: Supabase client/configuration, login and existing-factor TOTP,
RLS-gated paginated student reads, strict mapping, live read-only grid/search/archive/cards,
explicit errors and no mock fallback. Demo is opt-in during development only.
Proposed: versioned normalized read foundation migration, private application access
registry and security-invoker projection. No production migration or import was executed.
Validated: 41 tests, build and isolated PostgreSQL migration/access-policy tests.
Unresolved: staging, backup/restore rehearsal, initial account/TOTP provisioning,
reviewed data import, full granular permissions, write services and remaining domain
persistence. See supabase/README.md for precise limitations.


## Development database migration applied — 2026-11-04

User clarified the hosted project is development until release and authorized push.
Migration 20261104000100 is applied; all seven tables have RLS, the view is security
invoker, and anonymous reads/browser writes/self-grants are denied. Zero students
and the pre-existing Auth account remain unchanged. A public-schema backup was
restored in isolation before applying. No imports, user access grants or hosted Auth
changes were performed. See docs/DATABASE_CHANGE_2026-11-04.md for scope and limits.


## Initial development sign-in — 2026-11-04

User authorized completing initial access/TOTP setup. The sole existing development
account was granted the narrow Organotiko read permission; no passwords, Auth users,
verified factors or existing production systems were changed. A targeted reversal
statement is stored locally under ignored `supabase/.temp/backups/`.

The app now offers explicit TOTP enrollment after password authentication when no
verified factor exists: scan a QR or manually enter the setup key, then verify a
six-digit code before any student reads. Enrollment starts on user action, with
duplicate submission protection. The setup secret lives only in component memory;
no storage/logging is added. Cancellation removes only the newly created unverified
factor. Existing-factor challenge flow remains available on subsequent sign-ins.

Build and 41 domain/data tests pass. Actual hosted password/TOTP enrollment must be
completed by the account owner; it was not impersonated or verified by the agent.
Initial access is read-only, not a completed central user-management implementation.
Recovery codes, supervised reset and forced temporary-password change remain pending.
