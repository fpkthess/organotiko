-- RECONSTRUCTED DEVELOPMENT BASELINE for an EMPTY staging project.
-- Existing remote organotiko already has migration 20261104000100 installed.
-- DO NOT run against the legacy ORGANOSI production project.
create schema if not exists organotiko_private;
revoke all on schema organotiko_private from public, anon, authenticated;
create table if not exists organotiko_private.read_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);
revoke all on organotiko_private.read_access from public, anon, authenticated;

create table if not exists public.organotiko_people (
  id uuid primary key default gen_random_uuid(),
  surname text not null check (length(btrim(surname))>0),
  name text not null check (length(btrim(name))>0),
  created_at timestamptz not null default now()
);
create table if not exists public.organotiko_students (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.organotiko_people(id),
  department text,
  year_code text,
  ef_registered boolean not null default false,
  notes text not null default '',
  status text not null default 'active' check(status in('active','zero','archived')),
  created_at timestamptz not null default now()
);
create table if not exists public.organotiko_nucleus_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
create table if not exists public.organotiko_nuclei (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category_id uuid references public.organotiko_nucleus_categories(id),
  placeholder boolean not null default false
);
create table if not exists public.organotiko_student_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.organotiko_students(id),
  nucleus_id uuid not null references public.organotiko_nuclei(id),
  kind text not null check(kind in('primary','secondary')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create table if not exists public.organotiko_person_membership_links (
  person_id uuid primary key references public.organotiko_people(id),
  protoporia boolean not null,
  bluepass boolean not null,
  source_system text not null check(length(btrim(source_system))>0),
  source_record_id text not null check(length(btrim(source_record_id))>0),
  confirmed_at timestamptz not null default now()
);
-- This helper deliberately uses read-only entitlements and app-authenticated aal2; no client write grant.
create or replace function public.organotiko_can_read() returns boolean
language sql stable security definer set search_path=''
as $$select coalesce((select auth.jwt()->>'aal')='aal2',false)
 and exists(select 1 from organotiko_private.read_access a where a.user_id=(select auth.uid()) and a.enabled)$$;
revoke all on function public.organotiko_can_read() from public, anon;
grant execute on function public.organotiko_can_read() to authenticated;

-- In any exposed schema RLS must be enabled before opening Data API grants.
do $$declare t text; begin
 for t in select unnest(array['organotiko_people','organotiko_students','organotiko_nucleus_categories','organotiko_nuclei','organotiko_student_assignments','organotiko_person_membership_links']) loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='organotiko_read') then
   execute format('create policy organotiko_read on public.%I for select to authenticated using ((select public.organotiko_can_read()))',t);
  end if;
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

create or replace view public.organotiko_student_read_model with (security_invoker=true) as
 select p.id as person_id,p.surname,p.name,s.id as student_id,s.department,s.year_code,s.ef_registered,s.status,s.notes,
 a.nucleus_id as primary_nucleus_id,n.name as primary_nucleus
 from public.organotiko_people p join public.organotiko_students s on s.person_id=p.id
 left join public.organotiko_student_assignments a on a.student_id=s.id and a.kind='primary' and a.ended_at is null
 left join public.organotiko_nuclei n on n.id=a.nucleus_id;
revoke all on public.organotiko_student_read_model from anon,authenticated;
grant select on public.organotiko_student_read_model to authenticated;
