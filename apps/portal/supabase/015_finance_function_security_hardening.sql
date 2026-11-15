-- RC4: Security hardening after 012-014 (production and staging).
-- No data changes. Remove anonymous / PUBLIC access to privileged RPCs.
BEGIN;
DO $access$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',f.signature);
 END LOOP;
END $access$;
-- These are trigger or internal-only functions; they do not require authenticated RPC execution.
REVOKE ALL ON FUNCTION public.audit_changes() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_on_assignment() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM authenticated;
REVOKE ALL ON FUNCTION public.prevent_last_assignee() FROM authenticated;
REVOKE ALL ON FUNCTION public.protect_last_admin() FROM authenticated;
REVOKE ALL ON FUNCTION public.event_kind_change_audit() FROM authenticated;
REVOKE ALL ON FUNCTION public.validate_active_event_kind() FROM authenticated;
DO $verify$
BEGIN
 IF EXISTS(
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')
 ) THEN RAISE EXCEPTION 'Unexpected anonymous SECURITY DEFINER permission remains'; END IF;
 IF NOT has_function_privilege('authenticated','public.finance_create_register_with_first_payment(text,text,uuid,text,numeric,date,uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.finance_post(text,date,numeric,uuid,uuid,uuid,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Finance RPC permission is missing'; END IF;
END $verify$;
COMMIT;
