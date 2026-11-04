-- NEW EMPTY TARGET ONLY. Not applied to production. No imports or account creation.
begin;
create schema if not exists organotiko_private;
revoke all on schema organotiko_private from public, anon, authenticated;

-- App-specific access: never trust self-editable user_metadata or Portal roles.
create table organotiko_private.read_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false
);
alter table organotiko_private.read_access enable row level security;
revoke all on organotiko_private.read_access from public, anon, authenticated;

create function public.organotiko_can_read() returns boolean
language sql stable security definer set search_path = ''
as $$
 select coalesce((select auth.jwt()->>'aal') = 'aal2',false)
 and exists(select 1 from organotiko_private.read_access a
            where a.user_id=(select auth.uid()) and a.enabled);
$$;
revoke all on function public.organotiko_can_read() from public, anon;
grant execute on function public.organotiko_can_read() to authenticated;

create table public.organotiko_people (
 id uuid primary key default gen_random_uuid(),
 surname text not null check (length(btrim(surname))>0),
 name text not null check (length(btrim(name))>0),
 created_at timestamptz not null default now()
);
create table public.organotiko_students (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null unique references public.organotiko_people(id) on delete restrict,
 department text not null,
 year_code text not null,
 ef_registered boolean not null, -- Explicitly supplied on import; never derived from annual history.
 notes text not null default '',
 status text not null check(status in ('active','zero','archived')),
 created_at timestamptz not null default now()
);
create table public.organotiko_nucleus_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique
);
create table public.organotiko_nuclei (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 category_id uuid not null references public.organotiko_nucleus_categories(id) on delete restrict,
 placeholder boolean not null default false
);
create table public.organotiko_student_assignments (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.organotiko_students(id) on delete restrict,
 nucleus_id uuid not null references public.organotiko_nuclei(id) on delete restrict,
 kind text not null check(kind in ('primary','secondary')),
 started_at timestamptz not null, ended_at timestamptz,
 check(ended_at is null or ended_at>=started_at)
);
create unique index organotiko_one_current_assignment_kind
 on public.organotiko_student_assignments(student_id,kind) where ended_at is null;
create unique index organotiko_no_duplicate_current_nucleus
 on public.organotiko_student_assignments(student_id,nucleus_id) where ended_at is null;

-- Reviewed linkage only. These are organizational read-side membership projections,
-- not replacements for website member/Bluepass application or card histories.
create table public.organotiko_person_membership_links (
 person_id uuid primary key references public.organotiko_people(id) on delete restrict,
 protoporia boolean not null,
 bluepass boolean not null,
 source_system text not null check(length(btrim(source_system))>0),
 source_record_id text not null check(length(btrim(source_record_id))>0),
 confirmed_at timestamptz not null,
 unique(source_system,source_record_id)
);
-- Unresolved linkage remains NULL: the client rejects incomplete projections instead
-- of silently omitting people or reporting unknown membership flags as false.
create view public.organotiko_student_read_model with (security_invoker=true) as
 select s.id,s.person_id,p.surname,p.name,s.department,s.year_code,s.notes,s.status,
 s.ef_registered,m.protoporia,m.bluepass,
 coalesce(n1.name,'') as nucleus,coalesce(n2.name,'') as secondary_nucleus
 from public.organotiko_students s
 join public.organotiko_people p on p.id=s.person_id
 left join public.organotiko_person_membership_links m on m.person_id=p.id
 left join public.organotiko_student_assignments a1 on a1.student_id=s.id and a1.kind='primary' and a1.ended_at is null
 left join public.organotiko_nuclei n1 on n1.id=a1.nucleus_id
 left join public.organotiko_student_assignments a2 on a2.student_id=s.id and a2.kind='secondary' and a2.ended_at is null
 left join public.organotiko_nuclei n2 on n2.id=a2.nucleus_id;

do $$
declare t text;
begin
 foreach t in array array['organotiko_people','organotiko_students','organotiko_nucleus_categories','organotiko_nuclei','organotiko_student_assignments','organotiko_person_membership_links'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy organotiko_read on public.%I for select to authenticated using ((select public.organotiko_can_read()))',t);
 end loop;
end $$;
revoke all on public.organotiko_student_read_model from public, anon, authenticated;
grant select on public.organotiko_student_read_model to authenticated;
commit;
