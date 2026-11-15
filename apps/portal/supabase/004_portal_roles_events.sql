-- PROTOPORIA ORGANIZER v1.3 (apply once, AFTER v1.1 migrations)
-- Role hierarchy: admin, leadership, coordinator, member.
-- Admin grants per-account extras; organizational titles are independent of permissions.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin','leadership','coordinator','member'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position_title text NOT NULL DEFAULT '' CHECK (char_length(position_title)<=100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manage_all_tasks boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manage_events boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS view_audit boolean NOT NULL DEFAULT false;
-- Permissions are modified only through the admin-only profiles UPDATE RLS policy.
GRANT UPDATE (position_title,manage_all_tasks,manage_events,view_audit) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_all_teams()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles
               WHERE id=auth.uid() AND active AND (role IN ('admin','leadership') OR manage_all_tasks));
$$;
CREATE OR REPLACE FUNCTION public.can_manage_events()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active
   AND (role IN ('admin','leadership') OR manage_events));
$$;
CREATE OR REPLACE FUNCTION public.can_view_audit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active
   AND (role='admin' OR view_audit));
$$;
CREATE OR REPLACE FUNCTION public.can_manage_team(p_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.can_manage_all_teams() OR (
    public.is_active() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='coordinator')
    AND EXISTS(SELECT 1 FROM public.team_members WHERE team_id=p_team AND user_id=auth.uid() AND access='coordinator')
 );
$$;
CREATE OR REPLACE FUNCTION public.can_manage_event_team(p_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.can_manage_team(p_team) OR
        (public.can_manage_events() AND public.is_team_member(p_team));
$$;
DROP POLICY IF EXISTS teams_read ON public.teams;
CREATE POLICY teams_read ON public.teams FOR SELECT TO authenticated
  USING (public.can_manage_all_teams() OR public.is_team_member(id));
DROP POLICY IF EXISTS team_members_read ON public.team_members;
CREATE POLICY team_members_read ON public.team_members FOR SELECT TO authenticated
  USING (public.can_manage_all_teams() OR public.is_team_member(team_id));
DROP POLICY IF EXISTS audit_admin_read ON public.audit_log;
CREATE POLICY audit_admin_read ON public.audit_log FOR SELECT TO authenticated
  USING (public.can_view_audit());

CREATE TABLE public.events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id),
 kind text NOT NULL CHECK (kind IN ('party','conference','event','meeting','other')),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 180),
 details text NOT NULL DEFAULT '' CHECK (char_length(details)<=5000),
 venue text NOT NULL DEFAULT '' CHECK (char_length(venue)<=200),
 starts_at timestamptz NOT NULL,
 stage text NOT NULL DEFAULT 'planning' CHECK (stage IN ('planning','confirmed')),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 confirmed_by uuid REFERENCES public.profiles(id),
 confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_by_date ON public.events(starts_at);
CREATE TABLE public.event_task_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id),
 kind text NOT NULL CHECK (kind IN ('party','conference','event','meeting','other')),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 180),
 assignee_id uuid NOT NULL REFERENCES public.profiles(id),
 priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
 days_before integer NOT NULL DEFAULT 2 CHECK (days_before BETWEEN 0 AND 365),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_templates_type_team ON public.event_task_templates(team_id,kind);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS event_template_id uuid REFERENCES public.event_task_templates(id);
CREATE UNIQUE INDEX tasks_once_per_event_template ON public.tasks(event_id,event_template_id)
 WHERE event_id IS NOT NULL AND event_template_id IS NOT NULL;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_read ON public.events FOR SELECT TO authenticated
 USING (public.can_manage_all_teams() OR public.is_team_member(team_id));
CREATE POLICY events_insert ON public.events FOR INSERT TO authenticated
 WITH CHECK (public.can_manage_event_team(team_id) AND created_by=auth.uid() AND stage='planning'
             AND confirmed_at IS NULL AND confirmed_by IS NULL);
CREATE POLICY events_edit ON public.events FOR UPDATE TO authenticated
 USING (public.can_manage_event_team(team_id) AND stage='planning')
 WITH CHECK (public.can_manage_event_team(team_id) AND stage='planning');
CREATE POLICY templates_read ON public.event_task_templates FOR SELECT TO authenticated
 USING (public.can_manage_event_team(team_id));
CREATE POLICY templates_insert ON public.event_task_templates FOR INSERT TO authenticated
 WITH CHECK (public.can_manage_event_team(team_id));
CREATE POLICY templates_update ON public.event_task_templates FOR UPDATE TO authenticated
 USING (public.can_manage_event_team(team_id)) WITH CHECK (public.can_manage_event_team(team_id));
CREATE POLICY templates_delete ON public.event_task_templates FOR DELETE TO authenticated
 USING (public.can_manage_event_team(team_id));
GRANT SELECT,INSERT ON public.events TO authenticated;
GRANT UPDATE (title,details,venue,starts_at,kind) ON public.events TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.event_task_templates TO authenticated;
GRANT UPDATE (title,assignee_id,priority,days_before,enabled) ON public.event_task_templates TO authenticated;

-- Confirm atomically. On confirmation, preset tasks are created once and are normal tasks.
-- If a default assignee is no longer an active team member, reject the whole confirmation.
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
  THEN RAISE EXCEPTION 'Ένα προεπιλεγμένο στέλεχος δεν είναι ενεργό μέλος της ομάδας. Διόρθωσε πρώτα τα πρότυπα.'; END IF;
  INSERT INTO public.tasks(team_id,event_id,event_template_id,title,description,priority,due_at,review_required,created_by)
  VALUES (e.team_id,e.id,t.id,t.title,'Αυτόματη ανάθεση από επιβεβαίωση εκδήλωσης',t.priority,
          e.starts_at-(t.days_before * interval '1 day'),true,auth.uid())
  RETURNING id INTO v_task;
  INSERT INTO public.task_assignees(task_id,user_id) VALUES(v_task,t.assignee_id);
  v_count:=v_count+1;
 END LOOP;
 UPDATE public.events SET stage='confirmed',confirmed_at=now(),confirmed_by=auth.uid() WHERE id=e.id;
 RETURN v_count;
END;
$$;
-- Add manually assigned work to a confirmed event while reusing the validated task RPC.
CREATE OR REPLACE FUNCTION public.create_event_task(p_event_id uuid,p_title text,p_description text,
 p_priority text,p_due_at timestamptz,p_assignees uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.events%rowtype; v_id uuid;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 IF NOT FOUND OR e.stage<>'confirmed' OR NOT public.can_manage_event_team(e.team_id)
 THEN RAISE EXCEPTION 'Η εκδήλωση πρέπει να είναι επιβεβαιωμένη και να έχεις δικαιώματα.'; END IF;
 v_id := public.create_task(e.team_id,p_title,p_description,p_priority,p_due_at,true,p_assignees);
 UPDATE public.tasks SET event_id=e.id WHERE id=v_id;
 RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.confirm_event(uuid) FROM public,anon;
REVOKE EXECUTE ON FUNCTION public.create_event_task(uuid,text,text,text,timestamptz,uuid[]) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.confirm_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_task(uuid,text,text,text,timestamptz,uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_event_team(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_event_team(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_all_teams() FROM public,anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_events() FROM public,anon;
REVOKE EXECUTE ON FUNCTION public.can_view_audit() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_all_teams(), public.can_manage_events(), public.can_view_audit() TO authenticated;

-- Event audit tracks stage transitions without logging secrets.
CREATE OR REPLACE FUNCTION public.audit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,details)
 VALUES (auth.uid(),'events',new.id::text,lower(TG_OP),
         jsonb_build_object('title',new.title,'kind',new.kind,'stage',new.stage));
 RETURN new;
END;
$$;
CREATE TRIGGER audit_event_insert AFTER INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.audit_event();
CREATE TRIGGER audit_event_update AFTER UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.audit_event();
REVOKE EXECUTE ON FUNCTION public.audit_event() FROM public,anon,authenticated;

-- One permanent central roster. Every new account automatically belongs to it.
INSERT INTO public.teams(name,description,color,created_by)
SELECT 'Κεντρική Ομάδα Πρωτοπορίας','Κοινή οργανωτική ομάδα όλων των ενεργών στελεχών','#2158b0',NULL
WHERE NOT EXISTS (SELECT 1 FROM public.teams WHERE name='Κεντρική Ομάδα Πρωτοπορίας');
INSERT INTO public.team_members(team_id,user_id,access)
SELECT t.id,p.id,'member' FROM public.teams t CROSS JOIN public.profiles p
WHERE t.name='Κεντρική Ομάδα Πρωτοπορίας'
ON CONFLICT (team_id,user_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.auto_join_central_team()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.team_members(team_id,user_id,access)
 SELECT t.id,new.id,'member' FROM public.teams t
 WHERE t.name='Κεντρική Ομάδα Πρωτοπορίας'
 ON CONFLICT (team_id,user_id) DO NOTHING;
 RETURN new;
END;
$$;
CREATE TRIGGER auto_join_central_team AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_join_central_team();
REVOKE EXECUTE ON FUNCTION public.auto_join_central_team() FROM public,anon,authenticated;
