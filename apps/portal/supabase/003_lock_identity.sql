-- v1.1 hardening: the login handle and internal email alias are immutable.
-- An Admin changes roles/active status, but never changes the auth identity in profiles.
-- Future renames need coordinated Supabase Auth + profiles transaction handling.
create or replace function public.protect_profile_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.username is distinct from old.username or new.email is distinct from old.email then
  raise exception 'Login username and internal email cannot be edited in profiles';
 end if;
 return new;
end;
$$;
create trigger protect_profile_identity_before_update
before update on public.profiles
for each row execute function public.protect_profile_identity();
revoke execute on function public.protect_profile_identity() from public, anon, authenticated;
