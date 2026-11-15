-- PROTOPORIA Portal v2.0.9: individualized encrypted SMS per uploaded Excel/CSV row.
-- Apply ONCE through Supabase migration. Does not modify existing campaigns.
ALTER TABLE public.sms_recipients
 ADD COLUMN IF NOT EXISTS encrypted_message text;
-- Ciphertext, never passwords/other personalized fields in plaintext database columns.
ALTER TABLE public.sms_recipients DROP CONSTRAINT IF EXISTS sms_recipients_encrypted_message_check;
ALTER TABLE public.sms_recipients ADD CONSTRAINT sms_recipients_encrypted_message_check
 CHECK (encrypted_message IS NULL OR (length(encrypted_message) BETWEEN 45 AND 2500 AND encrypted_message ~ '^ENC1:[A-Za-z0-9+/=]+$'));

-- Transactionally create a campaign with encrypted per-recipient messages; service-role only.
CREATE OR REPLACE FUNCTION public.sms_create_personalized_campaign(
 p_actor uuid,p_request uuid,p_hash text,p_title text,p_provider text,p_sender text,
 p_template text,p_planned_at timestamptz,p_rows jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_count integer;
BEGIN
 SELECT id INTO v_id FROM public.sms_campaigns WHERE request_id=p_request;
 IF FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.sms_campaigns WHERE id=v_id AND created_by=p_actor AND request_hash=p_hash)
  THEN RAISE EXCEPTION 'Idempotency key used with different campaign'; END IF;
  RETURN v_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND active AND (role='admin' OR sms_access))
 THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_provider NOT IN ('APIFON','MICROSMS') OR char_length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180
   OR char_length(coalesce(p_template,'')) NOT BETWEEN 1 AND 612 OR p_hash !~ '^[0-9a-f]{64}$'
   OR p_planned_at IS NULL OR p_planned_at<now()-interval '5 minutes' OR p_planned_at>now()+interval '365 days'
 THEN RAISE EXCEPTION 'Invalid personalized campaign'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sms_sender_ids WHERE sender=p_sender AND enabled AND archived_at IS NULL)
 THEN RAISE EXCEPTION 'Sender inactive'; END IF;
 IF jsonb_typeof(p_rows)<>'array' THEN RAISE EXCEPTION 'Invalid rows'; END IF;
 v_count=jsonb_array_length(p_rows);
 IF v_count NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION '1-500 personalized recipients required'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(phone text,first_name text,last_name text,encrypted_message text)
   WHERE r.phone !~ '^(3069[0-9]{8}|3579[4-9][0-9]{6})$'
      OR length(coalesce(r.first_name,''))>100 OR length(coalesce(r.last_name,''))>100
      OR r.encrypted_message IS NULL OR r.encrypted_message !~ '^ENC1:[A-Za-z0-9+/=]+$'
      OR length(r.encrypted_message) NOT BETWEEN 45 AND 2500)
 THEN RAISE EXCEPTION 'Invalid encrypted recipient snapshot'; END IF;
 IF (SELECT count(DISTINCT x.phone) FROM jsonb_to_recordset(p_rows) AS x(phone text))<>v_count
 THEN RAISE EXCEPTION 'Duplicate phone numbers'; END IF;
 INSERT INTO public.sms_campaigns(request_id,request_hash,created_by,title,provider,sender,source,message,planned_at,status,total)
 VALUES(p_request,p_hash,p_actor,btrim(p_title),p_provider,p_sender,'MANUAL',p_template,p_planned_at,
  CASE WHEN p_planned_at>now()+interval '30 seconds' THEN 'SCHEDULED' ELSE 'QUEUED' END,v_count)
 RETURNING id INTO v_id;
 INSERT INTO public.sms_recipients(campaign_id,phone,first_name,last_name,encrypted_message,status)
 SELECT v_id,r.phone,coalesce(r.first_name,''),coalesce(r.last_name,''),
  CASE WHEN EXISTS(SELECT 1 FROM public.sms_exclusions e WHERE e.phone=r.phone) THEN NULL ELSE r.encrypted_message END,
  CASE WHEN EXISTS(SELECT 1 FROM public.sms_exclusions e WHERE e.phone=r.phone) THEN 'EXCLUDED' ELSE 'QUEUED' END
 FROM jsonb_to_recordset(p_rows) AS r(phone text,first_name text,last_name text,encrypted_message text);
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(p_actor,'sms_campaign',v_id::text,'create',jsonb_build_object('title',left(p_title,180),'provider',p_provider,
 'sender',p_sender,'source','PERSONALIZED','recipients',v_count,'scheduled',p_planned_at>now()+interval '30 seconds',
 'planned_at',p_planned_at,'has_sensitive_data',true));
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.sms_create_personalized_campaign(uuid,uuid,text,text,text,text,text,timestamptz,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_create_personalized_campaign(uuid,uuid,text,text,text,text,text,timestamptz,jsonb)
 TO service_role;

-- Remove temporary ciphertext as soon as the recipient reaches a terminal state.
CREATE OR REPLACE FUNCTION public.sms_personalized_ciphertext_cleanup()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status IN ('ACCEPTED','FAILED','UNCERTAIN','EXCLUDED','CANCELLED') THEN NEW.encrypted_message:=NULL; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sms_personalized_ciphertext_cleanup ON public.sms_recipients;
CREATE TRIGGER sms_personalized_ciphertext_cleanup BEFORE UPDATE ON public.sms_recipients
 FOR EACH ROW EXECUTE FUNCTION public.sms_personalized_ciphertext_cleanup();
REVOKE ALL ON FUNCTION public.sms_personalized_ciphertext_cleanup() FROM PUBLIC,anon,authenticated;

-- Same six-column result signature; queued personalized rows now yield encrypted payload.
CREATE OR REPLACE FUNCTION public.sms_claim_batch(p_limit integer DEFAULT 8)
RETURNS TABLE(recipient_id uuid,campaign_id uuid,phone text,provider text,sender text,message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_limit NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
 -- Reconcile stuck reservations conservatively.
 UPDATE public.sms_recipients r SET status='UNCERTAIN',processed_at=now(),note='Worker interruption; verify before any manual resend'
 WHERE r.status='SENDING' AND r.claimed_at<now()-interval '10 minutes';
 -- Newly added exclusions must also apply to already scheduled campaigns.
 UPDATE public.sms_recipients r SET status='EXCLUDED',processed_at=now(),note='Excluded before dispatch'
 FROM public.sms_campaigns c
 WHERE c.id=r.campaign_id AND r.status='QUEUED' AND
 EXISTS(SELECT 1 FROM public.sms_exclusions x WHERE x.phone=r.phone);
 RETURN QUERY
 WITH chosen AS (
  SELECT r.id FROM public.sms_recipients r
  JOIN public.sms_campaigns c ON c.id=r.campaign_id
  JOIN public.sms_sender_ids s ON s.sender=c.sender AND s.enabled AND s.archived_at IS NULL
  WHERE r.status='QUEUED' AND r.encrypted_message IS NULL AND c.status IN ('QUEUED','SCHEDULED','SENDING') AND c.planned_at <= now()
  ORDER BY c.planned_at,c.created_at,r.id
  FOR UPDATE OF r SKIP LOCKED LIMIT p_limit
 ), updated AS (
  UPDATE public.sms_recipients r SET status='SENDING',claimed_at=now()
  WHERE r.id IN(SELECT id FROM chosen)
  RETURNING r.id,r.campaign_id,r.phone
 )
 SELECT u.id,u.campaign_id,u.phone,c.provider,c.sender,c.message
 FROM updated u JOIN public.sms_campaigns c ON c.id=u.campaign_id;
 UPDATE public.sms_campaigns c SET status='SENDING'
 WHERE status IN ('QUEUED','SCHEDULED') AND EXISTS(SELECT 1 FROM public.sms_recipients r WHERE r.campaign_id=c.id AND r.status='SENDING');
END;$$;
REVOKE ALL ON FUNCTION public.sms_claim_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_claim_batch(integer) TO service_role;

-- Separate queue for encrypted SMS. Old Worker versions do not call this RPC,
-- so if the Worker is rolled back the encrypted messages remain safely queued.
CREATE OR REPLACE FUNCTION public.sms_claim_personalized_batch(p_limit integer DEFAULT 8)
RETURNS TABLE(recipient_id uuid,campaign_id uuid,phone text,provider text,sender text,message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_limit NOT BETWEEN 1 AND 8 THEN RAISE EXCEPTION 'Invalid personalized batch size'; END IF;
 UPDATE public.sms_recipients r SET status='UNCERTAIN',processed_at=now(),note='Worker interruption; verify before any manual resend'
 WHERE r.status='SENDING' AND r.claimed_at<now()-interval '10 minutes';
 UPDATE public.sms_recipients r SET status='EXCLUDED',processed_at=now(),note='Excluded before dispatch'
 FROM public.sms_campaigns c
 WHERE c.id=r.campaign_id AND r.status='QUEUED' AND
 EXISTS(SELECT 1 FROM public.sms_exclusions x WHERE x.phone=r.phone);
 RETURN QUERY
 WITH chosen AS (
  SELECT r.id FROM public.sms_recipients r
  JOIN public.sms_campaigns c ON c.id=r.campaign_id
  JOIN public.sms_sender_ids s ON s.sender=c.sender AND s.enabled AND s.archived_at IS NULL
  WHERE r.status='QUEUED' AND r.encrypted_message IS NOT NULL AND c.status IN ('QUEUED','SCHEDULED','SENDING') AND c.planned_at<=now()
  ORDER BY c.planned_at,c.created_at,r.id FOR UPDATE OF r SKIP LOCKED LIMIT p_limit
 ), updated AS (
  UPDATE public.sms_recipients r SET status='SENDING',claimed_at=now()
  WHERE r.id IN(SELECT id FROM chosen) RETURNING r.id,r.campaign_id,r.phone,r.encrypted_message
 )
 SELECT u.id,u.campaign_id,u.phone,c.provider,c.sender,u.encrypted_message
 FROM updated u JOIN public.sms_campaigns c ON c.id=u.campaign_id;
 UPDATE public.sms_campaigns c SET status='SENDING'
 WHERE status IN ('QUEUED','SCHEDULED') AND EXISTS(SELECT 1 FROM public.sms_recipients r WHERE r.campaign_id=c.id AND r.status='SENDING');
END;$$;
REVOKE ALL ON FUNCTION public.sms_claim_personalized_batch(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_claim_personalized_batch(integer) TO service_role;
