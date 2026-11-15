-- PROTOPORIA Portal v1.4
-- Execute only after reviewing/testing the v1.4 build, before Worker deployment.
-- Preserves existing tasks, event registrations, logins, SMS Google Sheet and SMS Worker.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_access boolean NOT NULL DEFAULT false;
-- Existing profiles role policy is admin-only for updates.
GRANT UPDATE (sms_access) ON public.profiles TO authenticated;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS other_label text NOT NULL DEFAULT '';
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_kind_check;
ALTER TABLE public.events ADD CONSTRAINT events_kind_check CHECK
 (kind IN ('meeting','event','party','efekth','mobilization','other','conference'));
-- Keep existing v1.3 'other' records valid without changing their titles.
UPDATE public.events SET other_label='Άλλο' WHERE kind='other' AND btrim(other_label)='';
ALTER TABLE public.events ADD CONSTRAINT events_other_label_check CHECK
 (char_length(other_label)<=80 AND (kind <> 'other' OR char_length(btrim(other_label)) BETWEEN 2 AND 80));
GRANT UPDATE (other_label) ON public.events TO authenticated;

ALTER TABLE public.event_task_templates DROP CONSTRAINT IF EXISTS event_task_templates_kind_check;
ALTER TABLE public.event_task_templates ADD CONSTRAINT event_task_templates_kind_check CHECK
 (kind IN ('meeting','event','party','efekth','mobilization','other','conference'));

-- Regular assigned work is freely checked as complete by its assignee;
-- managers also retain the right to mark it complete themselves.
-- Review-required work remains available as an explicit option on individual tasks.
CREATE OR REPLACE FUNCTION public.confirm_event(p_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.events%rowtype; t public.event_task_templates%rowtype; v_task uuid; v_count integer:=0;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Η εκδήλωση δεν βρέθηκε.'; END IF;
 IF NOT public.can_manage_event_team(e.team_id) THEN RAISE EXCEPTION 'Δεν έχεις δικαίωμα επιβεβαίωσης.'; END IF;
 IF e.stage='confirmed' THEN RETURN 0; END IF;
 IF e.stage<>'planning' THEN RAISE EXCEPTION 'Η εκδήλωση δεν μπορεί να επιβεβαιωθεί.'; END IF;
 FOR t IN SELECT * FROM public.event_task_templates WHERE team_id=e.team_id AND kind=e.kind AND enabled ORDER BY created_at,id LOOP
  IF NOT EXISTS (SELECT 1 FROM public.team_members m JOIN public.profiles p ON p.id=m.user_id
                  WHERE m.team_id=e.team_id AND m.user_id=t.assignee_id AND p.active)
  THEN RAISE EXCEPTION 'Προεπιλεγμένο στέλεχος δεν είναι ενεργό μέλος της ομάδας.'; END IF;
  INSERT INTO public.tasks(team_id,event_id,event_template_id,title,description,priority,due_at,review_required,created_by)
  VALUES(e.team_id,e.id,t.id,t.title,'Αυτόματη ανάθεση από επιβεβαίωση εκδήλωσης',t.priority,
         e.starts_at-(t.days_before*interval '1 day'),false,auth.uid())
  RETURNING id INTO v_task;
  INSERT INTO public.task_assignees(task_id,user_id) VALUES(v_task,t.assignee_id);
  v_count:=v_count+1;
 END LOOP;
 UPDATE public.events SET stage='confirmed',confirmed_at=now(),confirmed_by=auth.uid() WHERE id=e.id;
 RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_event_task(
 p_event_id uuid,p_title text,p_description text,p_priority text,p_due_at timestamptz,p_assignees uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.events%rowtype; v_id uuid; v_count integer;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=p_event_id FOR SHARE;
 IF NOT FOUND OR e.stage<>'confirmed' OR NOT public.can_manage_event_team(e.team_id)
 THEN RAISE EXCEPTION 'Η εκδήλωση πρέπει να είναι επιβεβαιωμένη και να έχεις δικαιώματα.'; END IF;
 IF char_length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180 THEN RAISE EXCEPTION 'Μη έγκυρος τίτλος εργασίας.'; END IF;
 IF char_length(coalesce(p_description,''))>5000 THEN RAISE EXCEPTION 'Η περιγραφή είναι πολύ μεγάλη.'; END IF;
 IF p_priority NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'Μη έγκυρη προτεραιότητα.'; END IF;
 SELECT count(DISTINCT a) INTO v_count FROM unnest(coalesce(p_assignees,array[]::uuid[])) a;
 IF v_count NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Επίλεξε 1–30 υπεύθυνους.'; END IF;
 IF (SELECT count(*) FROM public.team_members m JOIN public.profiles p ON p.id=m.user_id
     WHERE m.team_id=e.team_id AND m.user_id=ANY(p_assignees) AND p.active)<>v_count
 THEN RAISE EXCEPTION 'Οι υπεύθυνοι πρέπει να είναι ενεργά μέλη της ομάδας.'; END IF;
 INSERT INTO public.tasks(team_id,event_id,title,description,priority,due_at,review_required,created_by)
 VALUES(e.team_id,e.id,btrim(p_title),coalesce(p_description,''),p_priority,p_due_at,false,auth.uid())
 RETURNING id INTO v_id;
 INSERT INTO public.task_assignees(task_id,user_id) SELECT v_id,a FROM (SELECT DISTINCT unnest(p_assignees) a) s;
 RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_event(uuid) FROM public,anon;
REVOKE EXECUTE ON FUNCTION public.create_event_task(uuid,text,text,text,timestamptz,uuid[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.confirm_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_task(uuid,text,text,text,timestamptz,uuid[]) TO authenticated;
