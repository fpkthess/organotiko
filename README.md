> Database update (2026-11-04): the hosted project is development until release,
> per user clarification. Migration `20261104000100` is applied and verified.
> The database contains no students; its existing Auth account was preserved.
> See [database change record](docs/DATABASE_CHANGE_2026-11-04.md).

> Current runtime (2026-11-04): database mode is now the default. The local public
> Supabase connection is configured; the app opens at login. Production currently
> has no application tables or Auth users. The proposed schema remains local and
> no real records have been imported. Earlier milestone descriptions below describe
> the development-only synthetic prototype. See [Supabase setup](supabase/README.md).

# Organotiko

First local implementation of the platform described in [PROJECT_SPEC.md](PROJECT_SPEC.md). React + TypeScript + Vite workspace, with domain logic separated from the interface.

## Two applications and migration-first delivery — confirmed 2026-11-03

- **Organotiko: `organotikos.com`**. Independent application for organizational workflows, member management, Bluepass and offers, plus user creation for both applications.
- **Portal: `portal.protoporiathess.com`**. Independent application for tasks/operational teams, events, finance, newsletter, SMS and other operational administration.
- **One shared central production database**, with shared Auth/services and enforced application permissions; independent staging. Two domains mean separate applications and deployment entry points, not separate production databases. This records target domains; it does not claim DNS or hosting has been configured.
- **Migrate existing functionality; build only new Organotiko capabilities from scratch.** Reuse the supplied Portal implementation and website member/Bluepass/offer implementation, preserving behavior and adapting shared data, identity, authorization and application integration as necessary. Do not replace existing modules with newly invented implementations. Required compatibility and security changes are migration work, not authorization for a wholesale rewrite.
- New implementation centers on the organizational grid, nuclei, review sessions, academic-year/EFΕΚΘ workflows, assembly analysis, organizational reporting and their shared identity links. Central account creation for both apps is integrated in Organotiko; Portal does not retain its own provisioning path.
- Migrate shared database schemas/data and existing accounts through staging rehearsals, provenance mapping and reconciliation. Existing public website forms remain operational. Production changes and deployment still require explicit approval and a tested backup/restore plan.

## Run locally

Requires Node 22.18+ (or Node 24+) and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` runs strict TypeScript validation and creates `dist/`. `npm test` verifies domain invariants using Node's test runner.

## Implemented in this milestone

- Greek home screen, persistent collapsible navigation, responsive workspace shell and Cmd/Ctrl K quick search.
- 250 deterministic synthetic student records. Archived/status-0 records excluded from daily grid, search and nucleus counts.
- Paginated grid with combined search/department/EFΕΚΘ filters, sorting and column visibility.
- Editable surname, name and notes; Enter/Down saves and moves to the next row, Up saves and moves back, Esc cancels. Tab commits. Names normalize to uppercase; note text retains its case.
- Session-local change history and a field-level compare-and-set domain function, tested for stale-field conflicts and independent-field updates.
- Personal filter/column views saved in this browser, optional default view, and view deletion.
- Filtered CSV export: visible columns or all fixture fields; quoted values and formula-injection protection.
- Quick-search result cards and nucleus summaries linking to the filtered grid.

Student edits and their history are held in memory and reset on reload. Views and sidebar preference use localStorage. The local prototype has no authenticated user, shared persistence, backend, RLS, TOTP, or production connection. Browser-side conflict checks are groundwork, not multi-user concurrency enforcement. Backend invariants and security must be implemented and tested before real data is accepted.

Current application ownership (user clarification 2026-11-03): Organotiko owns organizational workflows, members, Bluepass including offers, and user creation for both apps. The separate Portal owns tasks/teams, events, finance, newsletter, SMS and other administration. Shared database/Auth/services remain planned.

Other navigation entries show explicitly planned functionality. They are not completed modules. Portal, website-admin, review sessions, custom fields, registrations and reporting remain tracked in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [MODULE_MATRIX.md](MODULE_MATRIX.md).

No environment variables or credentials are needed. There are no Supabase clients or delivery adapters in this milestone. Do not enter real personal data into this prototype.

## Layout

- `apps/organotiko`: local React interface and Vite entry point.
- `packages/domain/src/students.ts`: synthetic fixture, operational visibility, normalization, narrow field updates and export.
- `tests`: domain behavior tests.
- Root planning documents: source audit, target architecture and gated migration plan.

This milestone does not complete phase 1's database/security/restore gates. Access field mappings and current Portal schema remain discovery prerequisites for real integrations. Production cutover remains separately gated by explicit authorization and a tested backup/restore plan.

## Review sessions and advanced filters (milestone 2)

Use **Συνεδρίες οργανωτικού** to create a plan, configure its typed filters and start a frozen cohort. Review using Enter/Down, Up, Tab/Shift+Tab and Escape; pause/resume or finish with confirmation. Completed summaries switch between examined students and the full cohort, using fixed before/after snapshots and session-attributed changes. Cancellation keeps saved student edits and cannot be resumed.

The grid now includes flat AND/OR advanced filters, saved with personal views, plus a shortcut for preparing a session from AND filters. Session progress and all records remain local/in-memory. This is not yet the globally enforced multi-user implementation. See [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) for verification and remaining scope.

## Nucleus management (milestone 3)

**Πυρήνες** now supports categories, nucleus creation/editing, primary and secondary assignments, independent manager people and explicit manager replacement. Inactive managers flag their nuclei without removing history. Counts show unique active students and EFΕΚΘ registration splits; placeholders are distinguished from real nuclei. The grid reflects assignments and includes a secondary-nucleus column/filter.

Assignments and change reasons are retained only in this local app session. Refresh resets them. Final legacy taxonomy, backend constraints, bulk actions and printed reports remain pending.

## Organizational reports (milestone 4)

**Αναφορές** supports configurable nucleus assignment lists and flat student reports: choose columns, filters, sort, selected nuclei and primary/secondary assignment scope. Generate a fixed preview, save personal settings and export the preview as CSV. Nucleus detail also links directly to its report.

Print one section or the combined report, with a new page per nucleus. Use the browser's Save as PDF destination for PDF output; individual PDFs currently require printing each section separately. No automated bulk-PDF archive is generated. Report snapshots remain in memory; templates alone persist in this browser. Production data remains disconnected.

## Student cards, custom fields and archive (milestone 5)

Open a student card from a grid row or quick-search result. Cards show current information and note history from grid/card/review edits. **Προσαρμοσμένα πεδία** defines typed text/number/date/boolean/selection values; these can be edited on active cards and displayed as optional grid columns. Read-only or retired definitions retain their values. Custom field filter/report/session integration is still pending.

Archive and restore require a reason. Archived/status-0 students remain accessible through **Αρχείο φοιτητών**, outside daily views. Restore explicitly chooses active or status 0. No person, assignment, membership or old snapshot is deleted. All of this milestone's data/history remains local and resets on reload; editability controls are not a substitute for the planned backend authorization.

## Annual EFΕΚΘ registrations (milestone 6)

**Εγγραφές ΕΦΕΚΘ** separates annual intention/actual registration from the current EFΕΚΘ membership boolean. Record a dated registration in an explicit period, correct it with a reason/revision check, and inspect the annual ledger and daily/source totals. Membership changes preserve annual history and other memberships. Periods support optional Sunday exclusion. Student cards link directly into this workflow, and current-year values appear in grid filters, CSV and report columns.

Source codes and sample dates are provisional synthetic configuration. Adding a blank reporting year does not activate it, promote student year codes or reset EFΕΚΘ membership. Real legacy rules, storage/security, bulk entry and detailed comparison/export templates are still pending. All registration state resets on reload.

## Supabase CLI setup

The root workspace includes the pinned Supabase CLI and local configuration for the shared database. See [supabase/README.md](supabase/README.md) for authentication, production project linking, unresolved decisions and migration gates. No production migrations have been applied.
