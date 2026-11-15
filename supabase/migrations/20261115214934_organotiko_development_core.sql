-- Applied to development project organotiko, ID ikoqtvcobkmwshowgetc on 2026-11-15.
-- Requires organotiko_read_foundation; NEVER run on ORGANOSI/Portal.
-- Source-reconstruction of remote migration: schema logic aligned to verified remote state.
create table if not exists organotiko_private.write_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true
);
alter table organotiko_private.write_access enable row level security;
revoke all on organotiko_private.write_access from public, anon, authenticated;
create or replace function public.organotiko_can_write() returns boolean
language sql stable security definer set search_path=''
as $$ select (select public.organotiko_can_read()) and
 exists(select 1 from organotiko_private.write_access a where a.user_id=(select auth.uid()) and a.enabled) $$;
revoke all on function public.organotiko_can_write() from public, anon;
grant execute on function public.organotiko_can_write() to authenticated;

alter table public.organotiko_people add column if not exists version bigint not null default 0;
alter table public.organotiko_students add column if not exists version bigint not null default 0;
alter table public.organotiko_students add column if not exists university text not null default '';
alter table public.organotiko_students add column if not exists phone_cy text not null default '';
alter table public.organotiko_students add column if not exists phone_gr text not null default '';
alter table public.organotiko_students add column if not exists entry_year text not null default '';
alter table public.organotiko_students add column if not exists unique_number text not null default '';
alter table public.organotiko_students add column if not exists adt text not null default '';
alter table public.organotiko_students add column if not exists member boolean not null default false;
alter table public.organotiko_students add column if not exists bluepass boolean not null default false;
alter table public.organotiko_students add column if not exists cadre boolean not null default false;
alter table public.organotiko_students add column if not exists nucleus2 text not null default '';
alter table public.organotiko_students add column if not exists extra_values jsonb not null default '{}'::jsonb;
alter table public.organotiko_students add column if not exists data_origin text not null default 'real' check(data_origin in('real','synthetic','import_review'));
create index if not exists organotiko_students_origin_idx on public.organotiko_students(data_origin);

create or replace function public.organotiko_bump_version() returns trigger language plpgsql
set search_path='' as $$ begin new.version:=old.version+1; return new; end $$;
drop trigger if exists organotiko_people_version on public.organotiko_people;
create trigger organotiko_people_version before update on public.organotiko_people for each row execute function public.organotiko_bump_version();
drop trigger if exists organotiko_students_version on public.organotiko_students;
create trigger organotiko_students_version before update on public.organotiko_students for each row execute function public.organotiko_bump_version();

create table if not exists public.organotiko_academic_years (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^20[0-9]{2}-[0-9]{2}$'),
 status text not null default 'draft' check(status in('draft','current','closed')),
 started_on date, ended_on date,
 check(started_on is null or ended_on is null or started_on <= ended_on)
);
create unique index if not exists organotiko_one_current_year on public.organotiko_academic_years ((1)) where status='current';
create table if not exists public.organotiko_registration_periods (
 id uuid primary key default gen_random_uuid(), year_id uuid not null references public.organotiko_academic_years(id),
 title text not null, kind text not null check(kind in('REG','ΑΓΣ','ΒΓΣ','ΕΚΛ','OTHER')),
 active_days date[] not null default array[]::date[], sort_order integer not null default 0,
 unique(year_id,title)
);
create table if not exists public.organotiko_yearly_records (
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.organotiko_students(id),
 year_id uuid not null references public.organotiko_academic_years(id),
 year_code_at_start text, intent_code text not null default '' check(intent_code in('','1','2','3')),
 registration_source text check(registration_source in('+','ψ2','ψ3','ψ4','ψ5','Μ')),
 registered_on date,
 check((registration_source is null and registered_on is null) or (registration_source is not null and registered_on is not null)),
 unique(student_id,year_id)
);
create table if not exists public.organotiko_registration_events (
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.organotiko_students(id),
 year_id uuid not null references public.organotiko_academic_years(id),period_id uuid references public.organotiko_registration_periods(id),
 source text not null check(source in('+','ψ2','ψ3','ψ4','ψ5','Μ')),
 registered_on date not null, year_code_at_event text not null,
 recorded_by uuid references auth.users(id), recorded_at timestamptz not null default now(),
 kind text not null default 'registered' check(kind in('registered','re_registered'))
);
create index if not exists organotiko_registration_events_period_idx on public.organotiko_registration_events(year_id,registered_on);
create table if not exists public.organotiko_event_catalog (
 id uuid primary key default gen_random_uuid(),year_id uuid not null references public.organotiko_academic_years(id),
 kind text not null check(kind in('ΑΓΣ','ΒΓΣ','ΕΚΛ')), title text not null, event_on date,
 unique(year_id,title)
);
create table if not exists public.organotiko_event_records (
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.organotiko_students(id),
 event_id uuid not null references public.organotiko_event_catalog(id),
 intent text, actual text, attended boolean, year_code_at_event text,
 unique(student_id,event_id)
);
create table if not exists public.organotiko_student_notes_history (
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.organotiko_students(id),
 old_notes text not null,new_notes text not null,actor_id uuid references auth.users(id),changed_at timestamptz not null default now()
);
create table if not exists public.organotiko_field_definitions (
 id uuid primary key default gen_random_uuid(),field_key text not null unique,field_label text not null,
 field_type text not null check(field_type in('text','number','date','boolean','dropdown')),
 options jsonb not null default '[]'::jsonb,show_in_form boolean not null default true,active boolean not null default true,
 position integer not null default 0
);
create table if not exists public.organotiko_saved_views (
 id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id),
 shared boolean not null default false,name text not null,configuration jsonb not null,
 created_at timestamptz not null default now(),unique(owner_id,name)
);
create table if not exists public.organotiko_analytics_widgets (
 id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id),
 category text not null check(category in('Οργανωτικό','ΕΦΕΚΘ','Μέλη','Bluepass')),
 title text not null, shared boolean not null default false, configuration jsonb not null,
 position integer not null default 0
);
create table if not exists public.organotiko_report_templates (
 id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id),
 title text not null, shared boolean not null default false,configuration jsonb not null
);
create table if not exists public.organotiko_sessions (
 id uuid primary key default gen_random_uuid(),title text not null,
 status text not null default 'draft' check(status in('draft','active','paused','completed','cancelled')),
 filter_definition jsonb not null, table_configuration jsonb not null default '{}'::jsonb,
 operator_id uuid references auth.users(id),created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz
);
create unique index if not exists organotiko_single_active_session on public.organotiko_sessions ((1)) where status in('active','paused');
create table if not exists public.organotiko_session_people (
 session_id uuid not null references public.organotiko_sessions(id) on delete cascade,
 student_id uuid not null references public.organotiko_students(id),
 sort_position integer not null, reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
 initial_snapshot jsonb not null default '{}'::jsonb,
 primary key(session_id,student_id),unique(session_id,sort_position)
);
create table if not exists public.organotiko_annual_upgrade_runs (
 id uuid primary key default gen_random_uuid(),from_year_id uuid not null references public.organotiko_academic_years(id),
 to_year_id uuid not null unique references public.organotiko_academic_years(id),
 status text not null default 'preview' check(status in('preview','approved','completed','failed')),
 approved_by uuid references auth.users(id),created_at timestamptz not null default now(),finished_at timestamptz,
 summary jsonb not null default '{}'::jsonb
);
create table if not exists public.organotiko_audit_log (
 id bigserial primary key,table_name text not null,record_id uuid,action text not null,
 actor_id uuid references auth.users(id),changed_at timestamptz not null default now(),
 payload jsonb not null default '{}'::jsonb
);

-- The only normal write entrypoints into EF registration/confirmed membership are audited, explicit RPCs.
-- The ordinary student table does not grant UPDATE on ef_registered/member/bluepass.
create or replace function public.organotiko_register_efekth(p_student_id uuid,p_school_year text,p_source text,p_registered_on date)
returns uuid language plpgsql security definer set search_path='' as $$
declare y uuid; st public.organotiko_students%rowtype; ev uuid;
begin
 if not (select public.organotiko_can_write()) then raise exception 'Insufficient rights or MFA' using errcode='42501';end if;
 if p_source is null or p_source not in('+','ψ2','ψ3','ψ4','ψ5','Μ') then raise exception 'Required EF registration source';end if;
 if p_registered_on is null then raise exception 'Required EF registration date';end if;
 select id into y from public.organotiko_academic_years where code=p_school_year and status in('current','closed');
 if y is null then raise exception 'Unknown or inactive academic year';end if;
 if exists(select 1 from public.organotiko_academic_years where id=y and ((started_on is not null and p_registered_on<started_on) or (ended_on is not null and p_registered_on>ended_on))) then raise exception 'Registration date does not belong to academic year';end if;
 select * into st from public.organotiko_students where id=p_student_id for update;
 if not found then raise exception 'Student not found';end if;
 if st.ef_registered then raise exception 'Already registered; an explicitly approved removal is necessary before re-registration';end if;
 insert into public.organotiko_registration_events(student_id,year_id,source,registered_on,year_code_at_event,recorded_by)
 values(p_student_id,y,p_source,p_registered_on,coalesce(st.year_code,''),(select auth.uid())) returning id into ev;
 insert into public.organotiko_yearly_records(student_id,year_id,year_code_at_start,intent_code,registration_source,registered_on)
 values(p_student_id,y,st.year_code,'',p_source,p_registered_on)
 on conflict(student_id,year_id) do update set registration_source=excluded.registration_source,registered_on=excluded.registered_on; -- preserve historical intent
 update public.organotiko_students set ef_registered=true where id=p_student_id;
 insert into public.organotiko_audit_log(table_name,record_id,action,actor_id,payload)
 values('organotiko_students',p_student_id,'ef_register',(select auth.uid()),jsonb_build_object('event_id',ev,'source',p_source,'date',p_registered_on,'year',p_school_year));
 return ev;
end $$;
revoke all on function public.organotiko_register_efekth(uuid,text,text,date) from public,anon;
grant execute on function public.organotiko_register_efekth(uuid,text,text,date) to authenticated;

create or replace function public.organotiko_create_student(p_name text,p_surname text,p_department text,p_year_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if not (select public.organotiko_can_write()) then raise exception 'Insufficient rights or MFA' using errcode='42501';end if;
 if nullif(btrim(p_name),'') is null or nullif(btrim(p_surname),'') is null then raise exception 'Name and surname required';end if;
 insert into public.organotiko_people(name,surname) values(upper(btrim(p_name)),upper(btrim(p_surname))) returning id into pid;
 insert into public.organotiko_students(person_id,department,year_code) values(pid,coalesce(p_department,''),coalesce(p_year_code,'1'));
 insert into public.organotiko_audit_log(table_name,record_id,action,actor_id) values('organotiko_people',pid,'create',(select auth.uid()));
 return pid;
end $$;
revoke all on function public.organotiko_create_student(text,text,text,text) from public,anon;
grant execute on function public.organotiko_create_student(text,text,text,text) to authenticated;

-- Ordinary edits: whitelist columns only. The version column is trigger-managed.
revoke all on public.organotiko_people,public.organotiko_students from anon,authenticated;
grant select on public.organotiko_people,public.organotiko_students to authenticated;
grant update (name,surname) on public.organotiko_people to authenticated;
grant update (department,year_code,notes,university,phone_cy,phone_gr,entry_year,nucleus2,unique_number,adt,cadre,extra_values) on public.organotiko_students to authenticated;

create policy organotiko_write_people on public.organotiko_people for update to authenticated
 using ((select public.organotiko_can_write())) with check ((select public.organotiko_can_write()));
create policy organotiko_write_students on public.organotiko_students for update to authenticated
 using ((select public.organotiko_can_write())) with check ((select public.organotiko_can_write()));

-- Additional new tables are visible only to MFA-verified enrolled admins, and are read-only
-- until specific safe APIs for each module have been implemented.
do $$ declare t text;begin
 for t in select unnest(array['organotiko_academic_years','organotiko_registration_periods','organotiko_yearly_records','organotiko_registration_events','organotiko_event_catalog','organotiko_event_records','organotiko_student_notes_history','organotiko_field_definitions','organotiko_saved_views','organotiko_analytics_widgets','organotiko_report_templates','organotiko_sessions','organotiko_session_people','organotiko_annual_upgrade_runs','organotiko_audit_log']) loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('create policy organotiko_read on public.%I for select to authenticated using ((select public.organotiko_can_read()))',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
