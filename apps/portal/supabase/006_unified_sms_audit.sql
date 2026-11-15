-- PROTOPORIA Portal v2 - Supabase native SMS. APPLY ONLY ONCE AFTER REVIEW/BACKUP.
-- The previous Google Apps Script/Sheets SMS backend is NOT modified by this migration.
-- SMS tables intentionally expose NO browser read/write grants: requests go only via the
-- Cloudflare Worker, which authenticates Portal identity and permissions server-side.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_manage_contacts boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_manage_settings boolean NOT NULL DEFAULT false;
GRANT UPDATE (sms_manage_contacts,sms_manage_settings) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.sms_sender_ids (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender text NOT NULL UNIQUE CHECK(sender ~ '^[A-Za-z0-9]{1,11}$'),
 enabled boolean NOT NULL DEFAULT true,
 archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sms_exclusions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 phone text NOT NULL UNIQUE CHECK(phone ~ '^(30|357)[0-9]{8,10}$'),
 reason text NOT NULL DEFAULT '' CHECK(length(reason)<=200),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sms_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 list text NOT NULL CHECK(list IN ('STAFF','EMBEDDED')),
 first_name text NOT NULL DEFAULT '' CHECK(length(first_name)<=100),
 last_name text NOT NULL DEFAULT '' CHECK(length(last_name)<=100),
 phone text NOT NULL CHECK(phone ~ '^(30|357)[0-9]{8,10}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(list,phone)
);
CREATE INDEX IF NOT EXISTS sms_contacts_by_list ON public.sms_contacts(list,last_name,first_name);
CREATE TABLE IF NOT EXISTS public.sms_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 request_hash text NOT NULL CHECK(length(request_hash)=64),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 3 AND 180),
 provider text NOT NULL CHECK(provider IN ('APIFON','MICROSMS')),
 sender text NOT NULL REFERENCES public.sms_sender_ids(sender),
 source text NOT NULL CHECK(source IN ('STAFF','EMBEDDED','BOTH','MANUAL')),
 message text NOT NULL CHECK(char_length(message) BETWEEN 1 AND 612),
 planned_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('SCHEDULED','QUEUED','SENDING','COMPLETED','COMPLETED_WITH_ERRORS','REVIEW','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 total integer NOT NULL CHECK(total BETWEEN 1 AND 1500)
);
CREATE INDEX IF NOT EXISTS sms_campaigns_by_time ON public.sms_campaigns(status,planned_at,created_at);
CREATE TABLE IF NOT EXISTS public.sms_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.sms_campaigns(id),
 first_name text NOT NULL DEFAULT '', last_name text NOT NULL DEFAULT '',
 phone text NOT NULL,
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','SENDING','ACCEPTED','FAILED','UNCERTAIN','EXCLUDED','CANCELLED')),
 claimed_at timestamptz,
 processed_at timestamptz,
 provider_message_id text NOT NULL DEFAULT '' CHECK(length(provider_message_id)<=200),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=260),
 UNIQUE(campaign_id,phone)
);
CREATE INDEX IF NOT EXISTS sms_recipients_pending ON public.sms_recipients(status,campaign_id);
CREATE INDEX IF NOT EXISTS sms_recipients_by_campaign ON public.sms_recipients(campaign_id,status);

ALTER TABLE public.sms_sender_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_sender_ids,public.sms_exclusions,public.sms_contacts,public.sms_campaigns,public.sms_recipients FROM public,anon,authenticated;
-- service_role retains privileges; no authenticated policies are defined.

-- Atomic creation of campaign & recipient snapshot, with durable idempotency.
-- Cloudflare validates actor's role/permissions BEFORE calling this service-role-only RPC.
CREATE OR REPLACE FUNCTION public.sms_create_campaign(
 p_actor uuid,p_request uuid,p_hash text,p_title text,p_provider text,p_sender text,
 p_source text,p_message text,p_planned_at timestamptz,p_rows jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_count integer;
BEGIN
 SELECT id INTO v_id FROM public.sms_campaigns WHERE request_id=p_request;
 IF FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.sms_campaigns WHERE id=v_id AND created_by=p_actor AND request_hash=p_hash)
  THEN RAISE EXCEPTION 'Idempotency key reused with different request'; END IF;
  RETURN v_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND active AND (role='admin' OR sms_access)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_provider NOT IN ('APIFON','MICROSMS') OR p_source NOT IN ('STAFF','EMBEDDED','BOTH','MANUAL')
  OR length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180 OR length(coalesce(p_message,'')) NOT BETWEEN 1 AND 612
  OR p_hash !~ '^[0-9a-f]{64}$' OR p_planned_at IS NULL OR p_planned_at > now()+ interval '365 days'
  OR p_planned_at < now()-interval '5 minutes' THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sms_sender_ids WHERE sender=p_sender AND enabled AND archived_at IS NULL) THEN RAISE EXCEPTION 'Sender is disabled'; END IF;
 IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Invalid recipient snapshot'; END IF;
 v_count=jsonb_array_length(p_rows);
 IF v_count NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'Recipient count outside limits'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(phone text,first_name text,last_name text)
           WHERE phone !~ '^(3069[0-9]{8}|3579[4-9][0-9]{6})$' OR length(coalesce(first_name,''))>100 OR length(coalesce(last_name,''))>100)
 THEN RAISE EXCEPTION 'Invalid recipient data'; END IF;
 IF (SELECT count(distinct x.phone) FROM jsonb_to_recordset(p_rows) AS x(phone text))<>v_count THEN RAISE EXCEPTION 'Duplicate recipients'; END IF;
 INSERT INTO public.sms_campaigns(request_id,request_hash,created_by,title,provider,sender,source,message,planned_at,status,total)
 VALUES(p_request,p_hash,p_actor,btrim(p_title),p_provider,p_sender,p_source,p_message,p_planned_at,
   CASE WHEN p_planned_at>now()+interval '30 seconds' THEN 'SCHEDULED' ELSE 'QUEUED' END,v_count)
 RETURNING id INTO v_id;
 INSERT INTO public.sms_recipients(campaign_id,phone,first_name,last_name,status)
 SELECT v_id,r.phone,coalesce(r.first_name,''),coalesce(r.last_name,''),
   CASE WHEN EXISTS(SELECT 1 FROM public.sms_exclusions e WHERE e.phone=r.phone) THEN 'EXCLUDED' ELSE 'QUEUED' END
 FROM jsonb_to_recordset(p_rows) AS r(phone text,first_name text,last_name text);
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(p_actor,'sms_campaign',v_id::text,'create',jsonb_build_object('title',left(p_title,180),'provider',p_provider,'sender',p_sender,
 'source',p_source,'recipients',v_count,'scheduled',p_planned_at>now()+interval '30 seconds','planned_at',p_planned_at,
 'message_length',length(p_message)));
 RETURN v_id;
END;$$;

-- Claim atomically with SKIP LOCKED. If execution times out, claims become UNCERTAIN,
-- NOT QUEUED again: no automatic duplicate SMS after ambiguous provider responses.
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
  WHERE r.status='QUEUED' AND c.status IN ('QUEUED','SCHEDULED','SENDING') AND c.planned_at <= now()
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

CREATE OR REPLACE FUNCTION public.sms_complete_recipient(
 p_id uuid,p_status text,p_provider_id text DEFAULT '',p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_c uuid;v_counts record;v_status text;v_was text;
BEGIN
 IF p_status NOT IN ('ACCEPTED','FAILED','UNCERTAIN','EXCLUDED') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
 SELECT campaign_id INTO v_c FROM public.sms_recipients WHERE id=p_id AND status='SENDING' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.sms_recipients SET status=p_status,processed_at=now(),provider_message_id=left(coalesce(p_provider_id,''),200),note=left(coalesce(p_note,''),260)
 WHERE id=p_id;
 SELECT count(*) filter(where status IN ('QUEUED','SENDING')) AS pending,
        count(*) filter(where status='FAILED') AS failed,
        count(*) filter(where status='UNCERTAIN') AS uncertain,
        count(*) filter(where status='CANCELLED') AS cancelled
 INTO v_counts FROM public.sms_recipients WHERE campaign_id=v_c;
 SELECT status INTO v_was FROM public.sms_campaigns WHERE id=v_c FOR UPDATE;
 IF v_counts.pending=0 THEN
  v_status:=CASE WHEN v_counts.uncertain>0 THEN 'REVIEW'
   WHEN v_counts.failed>0 THEN 'COMPLETED_WITH_ERRORS'
   WHEN v_counts.cancelled>0 THEN 'CANCELLED' ELSE 'COMPLETED' END;
  UPDATE public.sms_campaigns SET status=v_status,finished_at=now() WHERE id=v_c;
  IF v_status<>v_was THEN
   INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
   VALUES(NULL,'sms_campaign',v_c::text,'finished',jsonb_build_object('status',v_status,'failed',v_counts.failed,'uncertain',v_counts.uncertain,'cancelled',v_counts.cancelled));
  END IF;
 END IF;
END;$$;

CREATE OR REPLACE FUNCTION public.sms_cancel_campaign(p_actor uuid,p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND active AND (role='admin' OR sms_access)) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sms_campaigns WHERE id=p_id) THEN RAISE EXCEPTION 'Campaign not found'; END IF;
 UPDATE public.sms_recipients SET status='CANCELLED',processed_at=now()
 WHERE campaign_id=p_id AND status='QUEUED';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE public.sms_campaigns SET status=CASE WHEN EXISTS(SELECT 1 FROM public.sms_recipients WHERE campaign_id=p_id AND status='SENDING') THEN 'SENDING' ELSE 'CANCELLED' END,
 finished_at=CASE WHEN EXISTS(SELECT 1 FROM public.sms_recipients WHERE campaign_id=p_id AND status='SENDING') THEN NULL ELSE now() END
 WHERE id=p_id;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(p_actor,'sms_campaign',p_id::text,'cancel',jsonb_build_object('cancelled_queued',v_count));
 RETURN v_count;
END;$$;

-- Central audit: log relevant changes, not page views. Avoid passwords, tokens,
-- complete phone numbers, message body, and large/sensitive free-text fields.
CREATE OR REPLACE FUNCTION public.audit_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;v_payload jsonb;v_old jsonb;v_new jsonb;v_changes jsonb;
BEGIN
 IF TG_TABLE_NAME='tasks' THEN
  v_id:=(CASE WHEN TG_OP='DELETE' THEN old.id ELSE new.id END)::text;
  IF TG_OP='INSERT' THEN v_payload:=jsonb_build_object('title',new.title,'team_id',new.team_id,'priority',new.priority,'due_at',new.due_at);
  ELSE
   v_payload:=jsonb_build_object('title',new.title,'old_status',old.status,'new_status',new.status,'old_due_at',old.due_at,'new_due_at',new.due_at,'old_priority',old.priority,'new_priority',new.priority,'description_changed',old.description IS DISTINCT FROM new.description);
   IF old.status=new.status AND old.title=new.title AND old.due_at IS NOT DISTINCT FROM new.due_at AND old.priority=new.priority AND old.description=new.description THEN RETURN new; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='profiles' THEN
  v_id:=new.id::text;
  v_old:=jsonb_build_object('role',old.role,'active',old.active,'position',old.position_title,'full_name',old.full_name,'manage_all_tasks',old.manage_all_tasks,'manage_events',old.manage_events,'view_audit',old.view_audit,'sms_access',old.sms_access,'sms_manage_contacts',old.sms_manage_contacts,'sms_manage_settings',old.sms_manage_settings);
  v_new:=jsonb_build_object('role',new.role,'active',new.active,'position',new.position_title,'full_name',new.full_name,'manage_all_tasks',new.manage_all_tasks,'manage_events',new.manage_events,'view_audit',new.view_audit,'sms_access',new.sms_access,'sms_manage_contacts',new.sms_manage_contacts,'sms_manage_settings',new.sms_manage_settings);
  IF v_old=v_new THEN RETURN new; END IF;
  v_payload:=jsonb_build_object('before',v_old,'after',v_new);
 ELSIF TG_TABLE_NAME='teams' THEN
  v_id:=(CASE WHEN TG_OP='DELETE' THEN old.id ELSE new.id END)::text;
  v_payload:=CASE WHEN TG_OP='INSERT' THEN jsonb_build_object('name',new.name) ELSE jsonb_build_object('before',old.name,'after',new.name) END;
  IF TG_OP='UPDATE' AND old.name=new.name AND old.description=new.description AND old.color=new.color THEN RETURN new; END IF;
 ELSIF TG_TABLE_NAME='team_members' THEN
  v_id:=(CASE WHEN TG_OP='DELETE' THEN old.team_id ELSE new.team_id END)::text;
  v_payload:=CASE WHEN TG_OP='DELETE' THEN jsonb_build_object('user_id',old.user_id,'access',old.access)
    ELSE jsonb_build_object('user_id',new.user_id,'access',new.access) END;
 ELSIF TG_TABLE_NAME='task_assignees' THEN
  v_id:=(CASE WHEN TG_OP='DELETE' THEN old.task_id ELSE new.task_id END)::text;
  v_payload:=jsonb_build_object('user_id',CASE WHEN TG_OP='DELETE' THEN old.user_id ELSE new.user_id END);
 ELSIF TG_TABLE_NAME='task_checklist' THEN
  v_id:=(CASE WHEN TG_OP='DELETE' THEN old.task_id ELSE new.task_id END)::text;
  v_payload:=CASE WHEN TG_OP='DELETE' THEN jsonb_build_object('item_id',old.id) ELSE jsonb_build_object('item_id',new.id,'done',new.is_done,'title_changed',CASE WHEN TG_OP='UPDATE' THEN old.title IS DISTINCT FROM new.title ELSE false END) END;
  IF TG_OP='UPDATE' AND old.is_done=new.is_done AND old.title=new.title AND old.sort_order=new.sort_order THEN RETURN new; END IF;
 ELSIF TG_TABLE_NAME='task_comments' THEN
  v_id:=new.task_id::text;
  v_payload:=jsonb_build_object('comment_id',new.id);
 ELSE RETURN coalesce(new,old); END IF;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(auth.uid(),TG_TABLE_NAME,v_id,lower(TG_OP),v_payload);
 RETURN coalesce(new,old);
END;$$;

-- EVENT audit already exists; add sender, exclusions, contacts audit via row triggers.
CREATE OR REPLACE FUNCTION public.sms_audit_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id text;v_data jsonb;
BEGIN
 v_id:=(CASE WHEN TG_OP='DELETE' THEN old.id ELSE new.id END)::text;
 IF TG_TABLE_NAME='sms_sender_ids' THEN
  v_data:=CASE WHEN TG_OP='DELETE' THEN jsonb_build_object('sender',old.sender) ELSE
   jsonb_build_object('sender',new.sender,'enabled',new.enabled,'archived',new.archived_at IS NOT NULL) END;
 ELSIF TG_TABLE_NAME='sms_exclusions' THEN
  -- Partial masking: no full phone or free-text reason in the audit trail.
  v_data:=jsonb_build_object('phone_suffix',right(CASE WHEN TG_OP='DELETE' THEN old.phone ELSE new.phone END,4));
 ELSIF TG_TABLE_NAME='sms_contacts' THEN
  v_data:=jsonb_build_object('list',CASE WHEN TG_OP='DELETE' THEN old.list ELSE new.list END);
 ELSE RETURN coalesce(new,old); END IF;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(auth.uid(),TG_TABLE_NAME,v_id,lower(TG_OP),v_data);
 RETURN coalesce(new,old);
END;$$;
CREATE TRIGGER sms_sender_audit AFTER INSERT OR UPDATE OR DELETE ON public.sms_sender_ids FOR EACH ROW EXECUTE FUNCTION public.sms_audit_changes();
CREATE TRIGGER sms_exclusion_audit AFTER INSERT OR UPDATE OR DELETE ON public.sms_exclusions FOR EACH ROW EXECUTE FUNCTION public.sms_audit_changes();
-- Contact file operations are audited as ONE summary record by the Worker, not 1500 row records.
REVOKE ALL ON FUNCTION public.sms_audit_changes() FROM public,anon,authenticated;

-- Protect central audit from all edits even by normal Admin clients. Only service_role
-- and trusted SECURITY DEFINER trigger functions may insert. No DELETE policy.
REVOKE ALL ON public.audit_log FROM anon,authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
REVOKE ALL ON FUNCTION public.sms_create_campaign(uuid,uuid,text,text,text,text,text,text,timestamptz,jsonb) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.sms_claim_batch(integer) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.sms_complete_recipient(uuid,text,text,text) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.sms_cancel_campaign(uuid,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_create_campaign(uuid,uuid,text,text,text,text,text,text,timestamptz,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_claim_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_complete_recipient(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_cancel_campaign(uuid,uuid) TO service_role;

-- Transactional admin-controlled settings and contact imports: attribution and data
-- changes commit together, and the frontend never receives service-role permissions.
CREATE OR REPLACE FUNCTION public.sms_manage_sender(p_actor uuid,p_sender text,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_before boolean;v_after boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin' AND active) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF p_sender !~ '^[A-Za-z0-9]{1,11}$' OR p_action NOT IN ('enable','disable','archive') THEN RAISE EXCEPTION 'Invalid sender operation'; END IF;
 SELECT enabled INTO v_before FROM public.sms_sender_ids WHERE sender=p_sender;
 IF p_action='archive' THEN
  IF NOT FOUND THEN RAISE EXCEPTION 'Sender not found'; END IF;
  UPDATE public.sms_sender_ids SET enabled=false,archived_at=now(),updated_at=now() WHERE sender=p_sender;
  v_after:=false;
 ELSE
  INSERT INTO public.sms_sender_ids(sender,enabled,archived_at) VALUES(p_sender,p_action='enable',NULL)
  ON CONFLICT(sender) DO UPDATE SET enabled=excluded.enabled,archived_at=NULL,updated_at=now();
  v_after:=p_action='enable';
 END IF;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(p_actor,'sms_sender',p_sender,p_action,jsonb_build_object('old_enabled',v_before,'enabled',v_after));
END;$$;

CREATE OR REPLACE FUNCTION public.sms_manage_exclusion(p_actor uuid,p_phone text,p_reason text,p_remove boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND active AND (role='admin' OR (sms_access AND sms_manage_settings))) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_phone !~ '^(3069[0-9]{8}|3579[4-9][0-9]{6})$' OR length(coalesce(p_reason,''))>200 THEN RAISE EXCEPTION 'Invalid exclusion'; END IF;
 IF p_remove THEN DELETE FROM public.sms_exclusions WHERE phone=p_phone;
 ELSE INSERT INTO public.sms_exclusions(phone,reason) VALUES(p_phone,coalesce(p_reason,''))
   ON CONFLICT(phone) DO UPDATE SET reason=excluded.reason; END IF;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(p_actor,'sms_exclusion',right(p_phone,4),CASE WHEN p_remove THEN 'remove' ELSE 'upsert' END,
 jsonb_build_object('phone_suffix',right(p_phone,4)));
END;$$;

CREATE OR REPLACE FUNCTION public.sms_import_contacts(p_actor uuid,p_list text,p_mode text,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_valid integer;v_added integer;v_existing integer;v_duplicates integer;v_bad integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND active AND (role='admin' OR (sms_access AND sms_manage_contacts))) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_list NOT IN ('STAFF','EMBEDDED') OR p_mode NOT IN ('APPEND','REPLACE') OR jsonb_typeof(p_rows)<>'array'
 OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'Invalid import'; END IF;
 SELECT count(*) INTO v_bad FROM jsonb_to_recordset(p_rows) AS x(first_name text,last_name text,phone text)
 WHERE x.phone !~ '^(3069[0-9]{8}|3579[4-9][0-9]{6})$'
 OR length(coalesce(x.first_name,''))>100 OR length(coalesce(x.last_name,''))>100;
 IF v_bad>0 THEN RAISE EXCEPTION 'File contains invalid phone or name'; END IF;
 SELECT count(*),count(DISTINCT phone) INTO v_valid,v_added FROM jsonb_to_recordset(p_rows) AS x(first_name text,last_name text,phone text);
 v_duplicates:=v_valid-v_added;
 SELECT count(*) INTO v_existing FROM public.sms_contacts WHERE list=p_list;
 IF p_mode='REPLACE' THEN DELETE FROM public.sms_contacts WHERE list=p_list; END IF;
 WITH ranked AS(
  SELECT x.first_name,x.last_name,x.phone,row_number() over(partition by x.phone ORDER BY x.phone) rn
  FROM jsonb_to_recordset(p_rows) AS x(first_name text,last_name text,phone text)
 )
 INSERT INTO public.sms_contacts(list,first_name,last_name,phone)
 SELECT p_list,coalesce(first_name,''),coalesce(last_name,''),phone FROM ranked WHERE rn=1
 ON CONFLICT(list,phone) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(p_actor,'sms_contacts',p_list,'import',jsonb_build_object('mode',p_mode,'file_rows',v_valid,'unique_rows',v_added,'duplicate_rows',v_duplicates,'previous_total',v_existing));
 RETURN jsonb_build_object('file_rows',v_valid,'unique_rows',v_added,'duplicates',v_duplicates,'previous_total',v_existing);
END;$$;

CREATE OR REPLACE FUNCTION public.sms_manage_contact(p_actor uuid,p_list text,p_phone text,p_first text,p_last text,p_remove boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND active AND (role='admin' OR (sms_access AND sms_manage_contacts))) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_list NOT IN ('STAFF','EMBEDDED') OR p_phone !~ '^(3069[0-9]{8}|3579[4-9][0-9]{6})$'
 OR length(coalesce(p_first,''))>100 OR length(coalesce(p_last,''))>100 THEN RAISE EXCEPTION 'Invalid contact'; END IF;
 IF p_remove THEN DELETE FROM public.sms_contacts WHERE list=p_list AND phone=p_phone;
 ELSE INSERT INTO public.sms_contacts(list,phone,first_name,last_name) VALUES(p_list,p_phone,coalesce(p_first,''),coalesce(p_last,''))
      ON CONFLICT(list,phone) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name; END IF;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(p_actor,'sms_contacts',p_list,CASE WHEN p_remove THEN 'remove' ELSE 'upsert' END,
 jsonb_build_object('phone_suffix',right(p_phone,4)));
END;$$;

DROP TRIGGER sms_sender_audit ON public.sms_sender_ids;
DROP TRIGGER sms_exclusion_audit ON public.sms_exclusions;
REVOKE ALL ON FUNCTION public.sms_manage_sender(uuid,text,text) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.sms_manage_exclusion(uuid,text,text,boolean) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.sms_import_contacts(uuid,text,text,jsonb) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.sms_manage_contact(uuid,text,text,text,text,boolean) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_manage_sender(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_manage_exclusion(uuid,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_import_contacts(uuid,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sms_manage_contact(uuid,text,text,text,text,boolean) TO service_role;

-- Finalize campaigns with no runnable recipients (all excluded or cancelled), including
-- stalled claims converted into UNCERTAIN. Historical campaigns are never auto-pruned.
CREATE OR REPLACE FUNCTION public.sms_reconcile_campaigns()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 UPDATE public.sms_recipients SET status='UNCERTAIN',processed_at=now(),note='Worker interruption; verify before any resend'
 WHERE status='SENDING' AND claimed_at<now()-interval '10 minutes';
 WITH completed AS (
  SELECT c.id,CASE
    WHEN count(*) FILTER(WHERE r.status='UNCERTAIN')>0 THEN 'REVIEW'
    WHEN count(*) FILTER(WHERE r.status='FAILED')>0 THEN 'COMPLETED_WITH_ERRORS'
    WHEN count(*) FILTER(WHERE r.status='CANCELLED')>0 THEN 'CANCELLED'
    ELSE 'COMPLETED' END AS next_status
  FROM public.sms_campaigns c JOIN public.sms_recipients r ON r.campaign_id=c.id
  WHERE c.status IN ('SCHEDULED','QUEUED','SENDING') AND c.planned_at<=now()
  GROUP BY c.id HAVING count(*) FILTER(WHERE r.status IN ('QUEUED','SENDING'))=0
 ),updated AS(
  UPDATE public.sms_campaigns c SET status=finished.next_status,finished_at=now()
  FROM completed finished WHERE c.id=finished.id RETURNING c.id,c.status
 )
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 SELECT NULL,'sms_campaign',id::text,'finished',jsonb_build_object('status',status) FROM updated;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION public.sms_reconcile_campaigns() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_reconcile_campaigns() TO service_role;

-- Event program changes (including place, date, type, confirmation), stored with
-- the real Portal actor when changed via an authenticated RPC.
CREATE OR REPLACE FUNCTION public.audit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old jsonb;v_new jsonb;
BEGIN
 v_new:=jsonb_build_object('title',new.title,'kind',new.kind,'other_label',new.other_label,
  'venue',new.venue,'starts_at',new.starts_at,'stage',new.stage,'team_id',new.team_id);
 IF TG_OP='INSERT' THEN
  INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
  VALUES(auth.uid(),'events',new.id::text,'insert',v_new);
 ELSE
  v_old:=jsonb_build_object('title',old.title,'kind',old.kind,'other_label',old.other_label,
   'venue',old.venue,'starts_at',old.starts_at,'stage',old.stage,'team_id',old.team_id);
  IF v_old IS DISTINCT FROM v_new THEN
   INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
   VALUES(auth.uid(),'events',new.id::text,'update',jsonb_build_object('before',v_old,'after',v_new));
  END IF;
 END IF;
 RETURN new;
END;$$;
REVOKE ALL ON FUNCTION public.audit_event() FROM public,anon,authenticated;

-- Release ONLY claims for which there was CERTAINLY no provider request, e.g.
-- a Sender ID was disabled after claim or credentials are missing. Unlike
-- uncertain provider attempts, these can safely return to QUEUED.
CREATE OR REPLACE FUNCTION public.sms_release_unattempted(p_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_c uuid;
BEGIN
 SELECT campaign_id INTO v_c FROM public.sms_recipients WHERE id=p_id AND status='SENDING' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.sms_recipients SET status='QUEUED',claimed_at=NULL,note=left(coalesce(p_reason,''),260) WHERE id=p_id;
 IF NOT EXISTS (SELECT 1 FROM public.sms_recipients WHERE campaign_id=v_c AND status='SENDING') THEN
   UPDATE public.sms_campaigns SET status='QUEUED' WHERE id=v_c AND status='SENDING';
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.sms_release_unattempted(uuid,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_release_unattempted(uuid,text) TO service_role;
