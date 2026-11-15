-- Apply to current ORGANOSI before creating the next Portal user.
-- Already applied to ORGANOSI via Supabase connector on 2026-10-18. DO NOT run twice unnecessarily.
CREATE OR REPLACE FUNCTION public.can_view_audit() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='admin');
$$;
UPDATE public.profiles SET view_audit=false WHERE view_audit=true;
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text:=lower(btrim(coalesce(new.email,'')));v_username text;
BEGIN
 v_username:=split_part(v_email,'@',1);
 IF v_email<>v_username||'@protoporiathess.com' OR v_username !~ '^[a-z][a-z0-9._-]{2,31}$'
 THEN RAISE EXCEPTION 'Internal identity must have form username@protoporiathess.com'; END IF;
 INSERT INTO public.profiles(id,email,username,full_name,role,active)
 VALUES(new.id,new.email,v_username,left(coalesce(new.raw_user_meta_data->>'full_name',''),100),'member',true)
 ON CONFLICT(id) DO NOTHING;
 RETURN new;
END;$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC,anon,authenticated;
