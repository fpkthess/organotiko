# Changelog — real platform

## 2026-11-15 / foundation 0.1.0
- Created separate React/Vite Organotiko project and shared pure domain package.
- Preserved Portal v2.1.11 reference source without existing production env.
- Added 260 synthetic in-memory fixtures, table/search/analytics UI foundation, annual preview, basic demo modules.
- Added Supabase/Auth adapter and TOTP setup/challenge UI for staging. This has not yet been tested against a live staging project.
- Created proposed, NOT APPLIED migrations for registration events/years, sessions, reports, locks, privileged EF registration RPC, RLS and version controls.
- Extracted and classified 52 Access columns, 4 NUMERA sheets, and all agreed features in explicit registry.
- Verified 9/9 pure business-rule tests and TS/TSX syntactic transpilation (not a Vite build).
- DID NOT migrate production data, deploy to Netlify, create a GitHub repo, modify the original ORGANOSI Portal, or send SMS.
- Read-only audited Supabase existing 6-table foundation and captured 3 security advisor findings in `SUPABASE_READONLY_AUDIT.md`; no remote changes.
