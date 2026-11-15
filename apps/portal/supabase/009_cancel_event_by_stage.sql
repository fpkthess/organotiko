-- PROTOPORIA Portal v2.0.5 — cancel confirmed events, permanently delete planning events.
-- Additive migration. Does not change existing events or their tasks.

-- Lock down dangerous client privileges that bypass RLS (TRUNCATE) or modify schema triggers.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
-- Events may only be created/edited through the existing RLS policies and cancelled by RPC.
REVOKE DELETE ON public.events FROM PUBLIC, anon, authenticated;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_stage_check;
ALTER TABLE public.events ADD CONSTRAINT events_stage_check
 CHECK (stage IN ('planning','confirmed','cancelled'));

CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.events%rowtype;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Πρέπει να είσαι συνδεδεμένος.';
 END IF;
 SELECT * INTO e FROM public.events WHERE id = p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Η εκδήλωση δεν βρέθηκε ή έχει ήδη διαγραφεί.'; END IF;
 IF NOT public.can_manage_event_team(e.team_id) THEN
  RAISE EXCEPTION 'Μόνο Admin και Ηγεσία μπορούν να ακυρώνουν εκδηλώσεις.';
 END IF;
 IF e.stage='planning' THEN
  IF EXISTS(SELECT 1 FROM public.tasks WHERE event_id=e.id) THEN
   RAISE EXCEPTION 'Η εκδήλωση έχει ήδη συνδεδεμένες εργασίες. Χρειάζεται έλεγχος πριν τη διαγραφή.';
  END IF;
  DELETE FROM public.events WHERE id=e.id;
  INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
  VALUES(auth.uid(),'events',e.id::text,'delete',
     jsonb_build_object('stage','planning','title',e.title,'team_id',e.team_id));
  RETURN 'deleted';
 ELSIF e.stage='confirmed' THEN
  UPDATE public.events SET stage='cancelled' WHERE id=e.id;
  -- The existing audit_event trigger records the confirmed -> cancelled transition.
  -- Keep already-assigned event tasks, rather than silently marking them done/deleting them.
  RETURN 'cancelled';
 ELSE
  RAISE EXCEPTION 'Η εκδήλωση είναι ήδη ακυρωμένη.';
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_event(uuid) TO authenticated;
