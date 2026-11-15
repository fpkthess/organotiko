-- Portal v2.1.3: a template may have no assignee. Confirming its event
-- still creates an unassigned task, which can be assigned later.
BEGIN;
ALTER TABLE public.event_task_templates ALTER COLUMN assignee_id DROP NOT NULL;
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
  IF t.assignee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.team_members m JOIN public.profiles p ON p.id=m.user_id
                  WHERE m.team_id=e.team_id AND m.user_id=t.assignee_id AND p.active)
  THEN RAISE EXCEPTION 'Προεπιλεγμένο στέλεχος δεν είναι ενεργό μέλος της ομάδας.'; END IF;
  INSERT INTO public.tasks(team_id,event_id,event_template_id,title,description,priority,due_at,review_required,created_by)
  VALUES(e.team_id,e.id,t.id,t.title,'Αυτόματη ανάθεση από επιβεβαίωση εκδήλωσης',t.priority,
         e.starts_at-(t.days_before*interval '1 day'),false,auth.uid())
  RETURNING id INTO v_task;
  IF t.assignee_id IS NOT NULL THEN
   INSERT INTO public.task_assignees(task_id,user_id) VALUES(v_task,t.assignee_id);
  END IF;
  v_count:=v_count+1;
 END LOOP;
 UPDATE public.events SET stage='confirmed',confirmed_at=now(),confirmed_by=auth.uid() WHERE id=e.id;
 RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_event(uuid) TO authenticated;
COMMIT;
