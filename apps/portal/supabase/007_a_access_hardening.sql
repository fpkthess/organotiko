-- PROTOPORIA Portal 2.0.2 access model - on an existing v2.0.1 database.
-- Apply only 007 & 008 on an existing deployed Supabase. Earlier migrations already present.
CREATE OR REPLACE FUNCTION public.can_manage_all_teams()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role IN ('admin','leadership'));
$$;
-- The previous rights flag must not grant Member/Coordinator global access.
UPDATE public.profiles SET manage_all_tasks=false, manage_events=false
WHERE role NOT IN ('admin','leadership') AND (manage_all_tasks OR manage_events);
