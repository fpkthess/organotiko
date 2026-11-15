-- PROTOPORIA ORGANIZER v1.1
-- Add username to profiles for email-free user-facing sign-in.
-- Apply to the existing ORGANOSI project after 001_schema.sql.
-- Username is a unique, lowercase, immutable login handle in v1.1.
-- Authentication continues through Supabase Auth via internal aliases username@users.organotiko.com.

alter table public.profiles add column username text;

-- Handles any manual bootstrap account already inserted into auth.users.
-- Current ORGANOSI project was empty before v1.0 schema initialization.
update public.profiles
set username = lower(split_part(email, '@', 1))
where username is null;

alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-z][a-z0-9._-]{2,31}$');

alter table public.profiles alter column username set not null;
create unique index profiles_username_unique on public.profiles (username);

-- Auth admin createUser attaches user_metadata but cannot elevate roles.
-- As with v1.0, every new user is MEMBER; role changes require an Admin.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_username text;
begin
  v_username := lower(split_part(coalesce(new.email,''), '@', 1));
  if coalesce(new.email,'') <> v_username || '@users.organotiko.com' then
    raise exception 'Only internal username identities are accepted';
  end if;
  insert into public.profiles (id, email, username, full_name, role, active)
  values (
    new.id,
    new.email,
    v_username,
    left(coalesce(new.raw_user_meta_data->>'full_name',''),100),
    'member',
    true
  ) on conflict (id) do nothing;
  return new;
end;
$$;

-- Restore least-privilege function permissions (triggers remain callable by triggers).
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
