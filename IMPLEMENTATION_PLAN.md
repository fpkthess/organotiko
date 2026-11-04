# Staged implementation plan and initial backlog

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

## Delivery rule

[R] Build in this repository. This audit implements no application code. Prioritize complete organizational, member, Bluepass and offer workflows in Organotiko. Preserve operational capabilities in Portal, with account creation for both apps centralized in Organotiko. Portal remains independent; public member/Bluepass/newsletter intake continues. Separate staging first; no production mutation, migration, user deletion or deployment without explicit approval and tested recovery.

Each phase produces reviewable staging evidence. Later phase work may overlap isolated UI development, but unmet data/security gates cannot be bypassed. No dates or performance targets are asserted without workload measurements.

## Phases, dependencies and exit criteria

| Phase | Scope | Exit gate |
|---|---|---|
| 0: audit completion | Current documents; obtain missing Access schema/Portal deployed export and project configuration; validate action-level feature ledger | Evidence gaps recorded/resolved; decisions that affect semantics have owners |
| 1: staging foundation | Workspace and CI, isolated Supabase, mock providers, synthetic 200–300 students and nonstudents; baseline replay and backup drill; contracts/authz/audit skeleton | Reproducible clean staging restore; no production credentials or deliveries; denied-access tests pass |
| 2: Organotiko core | Home/shell, keyboard grid, views/mobile lookup, person/provenance, nuclei, typed custom fields, notes/history, conflicts | Operator scenarios with accessibility and concurrent edits pass; unknown legacy rules remain explicitly blocked |
| 3: organizational depth | Sessions, manual year advancement, EFΕΚΘ windows/annual history, assemblies/snapshots, dynamic/nucleus PDF reports | Frozen cohorts and attribution verified; no history loss on archive/year change; rule mappings signed off |
| 4A: Portal parity | Preserve teams/work/notifications/events/templates, finance, SMS and operational audit in Portal; share service contracts and integrate central Organotiko provisioning | Every P row accepted in its owning app; Portal regression scenarios and Organotiko-only provisioning checks pass |
| 4B: website parity | Organotiko: members/member cards, Bluepass/Pass2U, offers and related analytics; Portal: newsletter/config/content/jobs; Organotiko: central users for both apps | Every in-scope W row accepted; public URL/forms compatible; new authorization boundary tested |
| 5: migration/security rehearsal | Account/person linking, full import/reconciliation, performance/concurrency/RLS, backup/restore, operational failure drills | Rehearsal report, approved mappings, zero unexplained discrepancies and complete parity ledger |
| 6: approved production integration | Execute separately reviewed cutover and observation plan | Explicit approval, tested backup/restore and all prior gates; production acceptance with recovery readiness |
| Later | Sheets event-day audit/rebuild, frozen roster attendance/reconciliation and unique EFΕΚΘ ID; MASTER evaluation | Separate requirements/security review; no invented election behavior now |

A core-only staging milestone is useful, but it is not the complete integrated production release requested here.

## Initial backlog [P]

| ID | Priority / dependency | Deliverable and acceptance |
|---|---|---|
| B001 | P0 / none | Obtain Access schema/workflow/report inventory and exact year/symbol/category dictionaries; preserve unmapped values |
| B002 | P0 / none | Capture supplied sanitized current Portal schema and drift against SQL 001–021; distinguish schema from historical imports |
| B003 | P0 / none | Validate website baseline, public/external authority, FDW backup/quiz dependencies, Auth/Storage and all active jobs |
| B004 | P0 / B001–003 | Approve field mapping, account/person matching and lawful retention policy; resolve conflicting identifiers without automatic merges |
| B005 | P0 / B002–003 | Action-level legacy permission worksheet; central ORGANOTIKOS/Portal granular grants; no automatic highest-role assignment |
| B006 | P0 / B005 | Define and test server/database assurance, temporary-password restriction, TOTP enrollment/challenge/recovery and permanent account deletion without history cascades |
| B007 | P0 / B002–003 | Reproducible staging baseline, synthetic fixture generator, fake providers and secret isolation checks |
| B008 | P1 / B007 | Organotiko home, collapsible sidebar, command shortcuts, accessible focus and minimal animation |
| B009 | P1 / B004,B007 | Person/student/source-link model, review queue, history and archive/status-0 behavior; nonstudent managers/applicants work |
| B010 | P1 / B008–009 | Grid/filter AST/sort/pagination/virtualization, saved personal/shared/default views, mobile search and two export modes |
| B011 | P1 / B005,B010 | Field-level concurrency, permission-aware custom fields and note history; stale same-cell writes conflict and different-field edits survive |
| B012 | P1 / B009 | Nuclei/categories/manager and student assignment history, placeholder roll and counts; overlapping primary assignment rejected |
| B013 | P1 / B010–011 | Review session lifecycle, atomic cohort/global active guard, keyboard movement/progress; completion/cancel behavior and attributable summaries |
| B014 | P1 / B001,B009 | Manual progression preview/apply history; correct postgraduate/year rules; EFΕΚΘ boolean unchanged |
| B015 | P1 / B001,B009 | Annual EFΕΚΘ registration/intention/source/date/windows and comparisons; historical denominator stable after archiving |
| B016 | P1 / B001,B015 | Assembly intention/attendance/outcome separation; versioned codes, daily/manual snapshots and comparisons |
| B017 | P1 / B012–016 | Saved reports/templates, accessible preview/printing, nucleus individual/combined PDFs and stable historic snapshots |
| B018 | P1 / B005–007 | Extract shared work/team/event contracts and preserve P01–04/P10 behavior in Portal; validate cancellation/template generation |
| B019 | P1 / B005–007 | Preserve finance P05–06 in Portal; exact ledger, locks, reversals, expected items, reconciliation, CSV and guarded deletion behavior |
| B020 | P1 / B005–007 | Preserve SMS P07–08 in Portal; imports/previews/lists/exclusions/senders, personalized secrecy, campaign exports and uncertain handling |
| B021 | P1 / B004–007 | Membership and member-wallet flows W01–02 with forms/approval/email/SMS/flags/history |
| B022 | P1 / B004–007 | Bluepass/batches/wallet/notification W03–04 with preserved pass references and no duplicate issuance |
| B023 | P1 / B005–007 | Organotiko offers/public map W05; Portal content and typed configuration W08/W10; restrict public projection |
| B024 | P1 / B005–007 | Portal newsletter/subscriber preferences, schedules/history/cancellation and birthday/job adapter W06/W12 |
| B025 | P1 / B021–024 | Analytics, central users/activity and trusted audit W07/W09; retain legacy client-log provenance separately |
| B026 | P0 release gate / B018–025 | Replace unauthenticated privileged provider proxies with validated scoped commands; public intake abuse/privacy checks; remove browser-build privileged-key fallbacks |
| B027 | P0 release gate / all in-scope features | Full parity ledger for MODULE_MATRIX P/W/N rows, migration mapping and regression suite across Organotiko/Portal/public site |
| B028 | P0 release gate / B027 | Restore drill, reconciliation report, performance/failure tests and approved RPO/RTO/runbook; no production action yet |
| B029 | Explicit later approval / B028 | Production cutover with bounded writer freeze, final export, checks, observe and recover |
| B030 | Deferred | Audit Sheets event-day and separate Quiz repository if brought into scope; evaluate MASTER only against real app |

## Verification strategy [P]

- **Authorization:** role × granular grant × team/resource × assurance × active/password-change state; use direct REST/RPC/function calls, not menu visibility. Cover anonymous intake, restricted Portal users, ORGANOTIKOS and unauthorized object IDs; inspect SECURITY DEFINER grants/search paths and service-role bypass paths.
- **Keyboard/accessibility:** full grid/session workflow without pointer; exact Enter/Down/Up/Tab/Shift+Tab/Esc behavior, save errors, focus restoration, Greek IME/uppercase, screen-reader labels, zoom and mobile lookup. No save failure marks a row examined silently.
- **Concurrency:** simultaneous session starts, same/different-field edits, concurrent account grant changes, recovery code consumption, year-roll reruns, template task creation, expected settlement and finance close/post races; preserve atomic audit.
- **History/reporting:** fixed before/after cohorts, own-session changes, cancellation retaining saved edits, archived/status-0 exclusions only in operational views, academic-year and source-code comparisons, PDF pagination and export authorization.
- **Integrations:** mock timeout/retry/duplicate webhook, rejected/accepted/uncertain SMS, wallet partial success, newsletter cancel-versus-send, job lease expiry, source migration reruns; never real deliveries in staging by default.
- **Performance:** measure realistic column counts, filters, sort, imports, largest expected cohort, exports and concurrent users; then agree response-time budgets. Use query plans and bounded pagination, not only the 200–300-row fixture set.
- **Recovery:** restore independent DB/Auth/Storage/config coverage, off-server retrieval and unavailable Ubuntu; prove interactive app continuity and observable queued-job delay.

Existing Portal test files cover permissions, auth loading, finance/events, SMS and responsive UI. They are regression evidence to review and extend, not proof of current production parity. No tests/builds were executed in this documentation-only audit, and no baseline SQL was replayed. Website has build/lint scripts but no dedicated test script in inspected package.json.

## Ready-to-start boundary

Documentation and source inventory are complete for the supplied material. Final data mapping and production readiness are not complete: Access, current Portal schema, deployment configuration and legal/security decisions remain missing. The next implementation task can begin with isolated scaffolding/synthetic UI only when requested, while discovery resolves those gates. Production remains untouched.

## Implementation update — 2026-11-02

The user subsequently authorized starting development. Milestone 1 implements an isolated local shell and synthetic organizational grid; see [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) for completed portions, test evidence and outstanding gates. Earlier audit-only statements describe the original audit, not the current filesystem. No production work has been authorized or performed.

## Implementation update — review-session slice, 2026-11-03

B010 now includes typed flat AND/OR condition building and saving these conditions in personal views. B013 has an initial in-memory domain/UI implementation: preparation/clone, start-time frozen cohort, lifecycle, unique examined progress, keyboard traversal, own-session change attribution and immutable scoped summaries. This is not completion of B013's global database/security/persistence gates or its configurable reports/shared-template requirements. Ten domain tests and the build pass; browser workflow verification is recorded in [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).

## Implementation update — nucleus-management slice, 2026-11-03

B012 now has a local domain/UI implementation for categories, stable nucleus IDs, independent manager people, primary/secondary student assignments, manager replacement/inactivity warnings, preserved assignment history and unique registration counts. Grid projection and secondary-nucleus filters/exports use the same model. Six added domain tests bring the suite to 16 passing tests; browser verification is recorded in [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md). Backend persistence/constraints, final taxonomy/secondary cardinality, bulk workflows, year-roll semantics and printable reports are still outstanding.

## Implementation update — reporting slice, 2026-11-03

B017 now includes configurable student/nucleus report previews, stable snapshots, unique/count reconciliation, personal saved settings, CSV and single/combined browser printing with page boundaries per nucleus. A nucleus detail shortcut uses its stable ID. Automated individual PDF/ZIP export, shared/durable templates, session metric configuration and legacy-specific reporting remain outstanding. Seven new domain tests bring the suite to 23; build and browser/native print-preview checks pass. See [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) for evidence and limits.

## Implementation update — student-card slice, 2026-11-03

B009/B011 now include local student cards, note-version/source history across grid/card/review edits, typed custom definitions/values with guarded updates, custom grid columns/CSV and reasoned archive/restore with a separate inactive-record view. Existing snapshots remain stable under archive changes. Custom-field filter/report/session integration and server-side permissions/persistence remain outstanding. Seven new tests bring the suite to 30; see [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) for browser evidence and limits.

## Implementation update — registration slice, 2026-11-03

B015 has a synthetic annual registration model/UI: configured years/periods, intention/actual-source separation, date/source validation, reasoned corrections, independent current EFΕΚΘ membership, annual ledgers, daily/source/previous-year totals and student-card/grid/report integration. B014 academic progression remains unimplemented pending legacy rules; adding a blank reporting year performs no advancement or membership reset. Seven new tests bring the suite to 37; browser evidence and provisional semantics are in [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).
