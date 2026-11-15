# Staging security acceptance tests (not run remotely yet)
1. With `anon` session, SELECT on all `organotiko_*` tables returns no rows / is denied.
2. With signed-in Portal-only `aal1`, SELECT/UPDATE denied.
3. With signed-in read entitlement but `aal1`, SELECT denied.
4. With signed-in read entitlement + verified `aal2`, SELECT granted, UPDATE denied.
5. With write entitlement + `aal2`, permitted editable columns update, versions increment.
6. Updating `ef_registered`, `member`, `bluepass`, `version` via public Data API is denied.
7. Register EF `p_source=''` or `1`, date NULL, invalid year, duplicate first registration: rejects atomically.
8. Valid registration creates dated event, annual record, and TRUE flag atomically; changing school year alone never resets TRUE.
9. Two simultaneous updates to same student with matching old version: exactly one succeeds.
10. Verify `organotiko_single_active_session` disallows second active/paused record.
11. Views must be `security_invoker=true`; no leakage of sensitive identifiers into general Portal.
12. Test DELETE and direct INSERT denied except safe RPC; auth/session invalidation tests before production.

Run Supabase database tests in an ISOLATED staging project with dedicated fake auth users. Do NOT execute against the existing production Portal.
