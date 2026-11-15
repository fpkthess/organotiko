-- PROTOPORIA Portal v2.0.7: Task editing and deletion by authorized team managers.
-- This migration does not change or delete existing tasks.
-- Execute once on the ORGANOSI Supabase project, BEFORE publishing the new frontend.

CREATE OR REPLACE FUNCTION public.edit_task_details(
 p_task_id uuid,
 p_title text,
 p_description text,
 p_priority text,
 p_due_at timestamptz,
 p_review_required boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.tasks%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Απαιτείται σύνδεση.'; END IF;
 SELECT * INTO v_task FROM public.tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Η εργασία δεν βρέθηκε.'; END IF;
 IF NOT public.can_manage_team(v_task.team_id) THEN
  RAISE EXCEPTION 'Μόνο Admin, Ηγεσία ή Συντονιστής της ομάδας μπορούν να επεξεργαστούν την εργασία.';
 END IF;
 IF char_length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180 THEN
  RAISE EXCEPTION 'Ο τίτλος πρέπει να έχει 3 έως 180 χαρακτήρες.';
 END IF;
 IF char_length(coalesce(p_description,'')) > 5000 THEN
  RAISE EXCEPTION 'Η περιγραφή μπορεί να έχει έως 5000 χαρακτήρες.';
 END IF;
 IF p_priority IS NULL OR p_priority NOT IN ('low','normal','high','urgent') THEN
  RAISE EXCEPTION 'Μη έγκυρη προτεραιότητα.';
 END IF;
 IF p_review_required IS NULL THEN
  RAISE EXCEPTION 'Επίλεξε αν απαιτείται έγκριση ολοκλήρωσης.';
 END IF;
 UPDATE public.tasks
 SET title=btrim(p_title),description=coalesce(p_description,''),priority=p_priority,
     due_at=p_due_at,review_required=p_review_required
 WHERE id=v_task.id;
 -- Existing AFTER UPDATE audit trigger captures the edit.
END; $$;

CREATE OR REPLACE FUNCTION public.delete_task_record(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_task public.tasks%ROWTYPE;
DECLARE v_assignee_count integer;
DECLARE v_check_count integer;
DECLARE v_comment_count integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Απαιτείται σύνδεση.'; END IF;
 SELECT * INTO v_task FROM public.tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Η εργασία δεν βρέθηκε ή έχει ήδη διαγραφεί.'; END IF;
 IF NOT public.can_manage_team(v_task.team_id) THEN
  RAISE EXCEPTION 'Μόνο Admin, Ηγεσία ή Συντονιστής της ομάδας μπορούν να διαγράψουν την εργασία.';
 END IF;
 SELECT count(*) INTO v_assignee_count FROM public.task_assignees WHERE task_id=v_task.id;
 SELECT count(*) INTO v_check_count FROM public.task_checklist WHERE task_id=v_task.id;
 SELECT count(*) INTO v_comment_count FROM public.task_comments WHERE task_id=v_task.id;
 -- FK ON DELETE CASCADE removes assignees, checklist items, comments, notifications.
 DELETE FROM public.tasks WHERE id=v_task.id;
 -- Persist only minimal context; the deleted task cannot be restored from this entry.
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES(auth.uid(),'tasks',v_task.id::text,'delete',jsonb_build_object(
  'title',v_task.title, 'team_id',v_task.team_id, 'event_id',v_task.event_id,
  'assignees_removed',v_assignee_count,'checklist_items_removed',v_check_count,
  'comments_removed',v_comment_count
 ));
END; $$;

-- The final-assignee guard must allow the foreign-key cleanup when its task
-- is already being deleted, while still preventing manual removal of the last assignee.
CREATE OR REPLACE FUNCTION public.prevent_last_assignee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 PERFORM 1 FROM public.tasks WHERE id=old.task_id FOR UPDATE;
 IF NOT FOUND THEN RETURN old; END IF;
 IF (SELECT count(*) FROM public.task_assignees WHERE task_id=old.task_id) <= 1 THEN
  RAISE EXCEPTION 'Δεν μπορείς να αφαιρέσεις τον τελευταίο υπεύθυνο εργασίας.';
 END IF;
 RETURN old;
END; $$;

REVOKE ALL ON FUNCTION public.edit_task_details(uuid,text,text,text,timestamptz,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_task_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_task_details(uuid,text,text,text,timestamptz,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_task_record(uuid) TO authenticated;
