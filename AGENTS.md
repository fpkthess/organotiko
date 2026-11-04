# Codex Instructions — Organotiko

Read `PROJECT_SPEC.md` before proposing architecture or modifying code. This project replaces and unifies three distinct existing systems (Access Organotiko, Cloudflare/Supabase Portal, Netlify/other-Supabase website-admin) and later integrates a Google Sheets event-day election/assembly system.

## Current environment — confirmed 2026-11-04
- Supabase project `ikoqtvcobkmwshowgetc` is development until application release, per explicit user clarification. The CLI may still label its main branch production.
- The user authorized applying the prepared database migration to this development project. This does not authorize changes to the existing Portal/website databases or release deployment.
- Reassess production readiness, environments, data migration and backup/restore before release.

## Operating principles
- Confirmed domains: independent Organotiko app at `organotikos.com` and Portal app at `portal.protoporiathess.com`, sharing one central production database.
- Migration-first: reuse/migrate existing Portal and website member/Bluepass/offer functionality. Build only new organizational capabilities from scratch; adapt existing modules only for necessary integration, compatibility and security.
- User wants a very powerful, extensible system with an exceptionally clean, fast, keyboard-driven UI.
- Current scope (2026-11-03): Organotiko contains organizational workflows, complete member management, Bluepass management including offers, and central user creation for both apps. Tasks/operational teams, events, finance, newsletter, SMS and other administration belong in the separate Portal. The earlier complete-superset requirement is superseded. Portal stays independently usable by authorized users.
- One central Supabase production database; separate staging; shared auth, granular permission enforcement, secure TOTP for Organotiko.
- Do not infer existing code, schema, APIs, or roles from descriptions. Inspect actual repositories and DBs first.
- No production writes, schema migrations, destructive actions, user deletions, or deployment without explicit approval and tested backup/restore plan.
- Never expose secrets in code, commits, logs, or prompts. Use environment variables and least-privilege service credentials.
- Preserve histories and data provenance; do not auto-merge fuzzy identity matches.
- Build shared business logic and modular apps; test accessibility, keyboard navigation, concurrency, and RLS.
- Election-day app and MASTER permissions are deferred, but architecture must leave expansion points.
- Ask only when a decision changes business semantics, data integrity, or security.

## First task
Perform a read-only inventory of supplied repositories and schemas. Produce an architecture diagram, feature inventory by existing app, proposed module ownership, identity mapping, migration strategy, and staged implementation plan. Reference `PROJECT_SPEC.md` as requirements source.
