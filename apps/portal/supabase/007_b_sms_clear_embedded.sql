-- ADDITIONAL v2.0.2 BACKEND RPC; already applied to live ORGANOSI.
CREATE OR REPLACE FUNCTION public.sms_clear_embedded_contacts(p_actor uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_deleted integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND active
 AND (role='admin' OR (sms_access AND sms_manage_contacts)))
 THEN RAISE EXCEPTION 'SMS contacts management permission required'; END IF;
 DELETE FROM public.sms_contacts WHERE list='EMBEDDED';
 GET DIAGNOSTICS v_deleted=ROW_COUNT;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(p_actor,'sms_contacts','EMBEDDED','clear',jsonb_build_object('deleted',v_deleted));
 RETURN v_deleted;
END;$$;
REVOKE EXECUTE ON FUNCTION public.sms_clear_embedded_contacts(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_clear_embedded_contacts(uuid) TO service_role;
