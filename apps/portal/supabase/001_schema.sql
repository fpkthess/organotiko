-- PROTOPORIA ORGANIZER v1.0 — run ONCE in a fresh Supabase project SQL Editor.
-- All mutation privileges are constrained with PostgreSQL Row Level Security.
-- Do NOT run this against the SMS Dashboard database.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'member' check (role in ('admin','coordinator','member')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role, active);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '',
  color text not null default '#55c6eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access text not null default 'member' check (access in ('member','coordinator')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_by_user_idx on public.team_members (user_id, team_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  description text not null default '' check (char_length(description) <= 5000),
  status text not null default 'todo' check (status in ('todo','in_progress','in_review','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  review_required boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index tasks_by_team_idx on public.tasks (team_id, status, due_at);
create index tasks_by_due_idx on public.tasks (due_at) where status <> 'done';

create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_by_user_idx on public.task_assignees (user_id, task_id);

create table public.task_checklist (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 250),
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index checklist_by_task_idx on public.task_checklist (task_id, sort_order);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index comments_by_task_idx on public.task_comments (task_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  kind text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_by_user_idx on public.notifications (user_id, read_at, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  entity_type text not null,
  entity_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_at_idx on public.audit_log (created_at desc);

-- Trigger on Auth user creation: all invited users start as MEMBER, never admin.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,email,full_name,role,active)
  values (new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),100),'member',true)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- These helpers are SECURITY DEFINER to avoid nested RLS recursion.
create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active=true);
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true);
$$;
create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_active() and exists(select 1 from public.team_members where team_id=p_team and user_id=auth.uid());
$$;
create or replace function public.can_manage_team(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_admin() or (
   public.is_active() and
   exists(select 1 from public.profiles where id=auth.uid() and role='coordinator') and
   exists(select 1 from public.team_members where team_id=p_team and user_id=auth.uid() and access='coordinator')
 );
$$;
create or replace function public.can_view_task(p_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_admin() or exists (
   select 1 from public.tasks t where t.id=p_task and (
     public.can_manage_team(t.team_id) or (
       public.is_team_member(t.team_id) and exists(select 1 from public.task_assignees a where a.task_id=t.id and a.user_id=auth.uid())
     )
   )
 );
$$;
create or replace function public.is_task_assignee(p_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select public.is_active() and exists (select 1 from public.task_assignees a join public.tasks t on t.id=a.task_id where a.task_id=p_task and a.user_id=auth.uid() and public.is_team_member(t.team_id));
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_checklist enable row level security;
alter table public.task_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (public.is_active() and (active or public.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy teams_read on public.teams for select to authenticated
using (public.is_admin() or public.is_team_member(id));
create policy teams_admin_insert on public.teams for insert to authenticated
with check (public.is_admin() and created_by=auth.uid());
create policy teams_admin_update on public.teams for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy team_members_read on public.team_members for select to authenticated
using (public.is_admin() or public.is_team_member(team_id));
create policy team_members_admin_insert on public.team_members for insert to authenticated
with check (public.is_admin());
create policy team_members_admin_update on public.team_members for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy team_members_admin_delete on public.team_members for delete to authenticated
using (public.is_admin());

create policy tasks_read on public.tasks for select to authenticated
using (public.can_view_task(id));
-- Creation is only through create_task() atomic RPC; direct inserts disallowed.
create policy tasks_manage_update on public.tasks for update to authenticated
using (public.can_manage_team(team_id)) with check (public.can_manage_team(team_id));
-- Do not allow task deletion in v1: completed work and audit must remain intact.

create policy assignees_read on public.task_assignees for select to authenticated
using (public.can_view_task(task_id));
-- Changes to assignees are restricted to managers of the same task/team.
create policy assignees_insert on public.task_assignees for insert to authenticated
with check (
 public.can_manage_team((select team_id from public.tasks where id=task_id)) and
 exists(select 1 from public.team_members m join public.profiles p on p.id=m.user_id
   where m.team_id=(select team_id from public.tasks where id=task_id) and m.user_id=task_assignees.user_id and p.active)
);
create policy assignees_delete on public.task_assignees for delete to authenticated
using (public.can_manage_team((select team_id from public.tasks where id=task_id)));

create policy checklist_read on public.task_checklist for select to authenticated
using (public.can_view_task(task_id));
create policy checklist_manage_insert on public.task_checklist for insert to authenticated
with check (public.can_manage_team((select team_id from public.tasks where id=task_id)));
create policy checklist_manage_update on public.task_checklist for update to authenticated
using (public.can_manage_team((select team_id from public.tasks where id=task_id)))
with check (public.can_manage_team((select team_id from public.tasks where id=task_id)));
create policy checklist_manage_delete on public.task_checklist for delete to authenticated
using (public.can_manage_team((select team_id from public.tasks where id=task_id)));

create policy comments_read on public.task_comments for select to authenticated
using (public.can_view_task(task_id));
create policy comments_insert on public.task_comments for insert to authenticated
with check (user_id=auth.uid() and public.can_view_task(task_id));

create policy notifications_read on public.notifications for select to authenticated
using (user_id=auth.uid() and public.is_active() and (task_id is null or public.can_view_task(task_id)));
create policy audit_admin_read on public.audit_log for select to authenticated
using (public.is_admin());

-- Hardening: no direct mutation of status, role, or audit records from the browser.
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert, delete on public.tasks from authenticated;
revoke insert, update, delete on public.notifications from authenticated;

create or replace function public.create_task(
  p_team_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_due_at timestamptz,
  p_review_required boolean,
  p_assignees uuid[]
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_count integer;
begin
  if not public.can_manage_team(p_team_id) then raise exception 'Δεν έχεις δικαίωμα δημιουργίας σε αυτή την ομάδα.'; end if;
  if char_length(btrim(coalesce(p_title,''))) not between 3 and 180 then raise exception 'Ο τίτλος πρέπει να έχει 3–180 χαρακτήρες.'; end if;
  if char_length(coalesce(p_description,'')) > 5000 then raise exception 'Η περιγραφή είναι πολύ μεγάλη.'; end if;
  if p_priority not in ('low','normal','high','urgent') then raise exception 'Μη έγκυρη προτεραιότητα.'; end if;
  select count(distinct a) into v_count from unnest(coalesce(p_assignees,array[]::uuid[])) a;
  if v_count < 1 or v_count > 30 then raise exception 'Επίλεξε 1–30 διαφορετικούς υπεύθυνους.'; end if;
  if (select count(*) from public.team_members m join public.profiles p on p.id=m.user_id
      where m.team_id=p_team_id and m.user_id=any(p_assignees) and p.active) <> v_count
  then raise exception 'Όλοι οι υπεύθυνοι πρέπει να είναι ενεργά μέλη της ομάδας.'; end if;
  insert into public.tasks (team_id,title,description,priority,due_at,review_required,created_by)
  values (p_team_id,btrim(p_title),coalesce(p_description,''),p_priority,p_due_at,coalesce(p_review_required,true),auth.uid()) returning id into v_id;
  insert into public.task_assignees (task_id,user_id)
  select v_id, a from (select distinct unnest(p_assignees) as a) x;
  return v_id;
end;
$$;
revoke all on function public.create_task(uuid,text,text,text,timestamptz,boolean,uuid[]) from public;
grant execute on function public.create_task(uuid,text,text,text,timestamptz,boolean,uuid[]) to authenticated;

create or replace function public.set_task_status(p_task_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype; v_manager boolean;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Η εργασία δεν βρέθηκε.'; end if;
  v_manager := public.can_manage_team(v_task.team_id);
  if not (v_manager or public.is_task_assignee(p_task_id)) then raise exception 'Δεν έχεις πρόσβαση.'; end if;
  if p_status not in ('todo','in_progress','in_review','done') then raise exception 'Μη έγκυρη κατάσταση.'; end if;
  if p_status='done' and v_task.review_required and not v_manager then
    raise exception 'Η ολοκλήρωση απαιτεί έγκριση Coordinator ή Admin.';
  end if;
  update public.tasks set status=p_status,
    completed_at=case when p_status='done' then now() else null end,
    updated_at=now() where id=p_task_id;
end;
$$;
revoke all on function public.set_task_status(uuid,text) from public;
grant execute on function public.set_task_status(uuid,text) to authenticated;

create or replace function public.toggle_checklist(p_item_id uuid,p_done boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task uuid; v_team uuid;
begin
  select c.task_id,t.team_id into v_task,v_team from public.task_checklist c
  join public.tasks t on t.id=c.task_id where c.id=p_item_id for update of c;
  if not found or not (public.can_manage_team(v_team) or public.is_task_assignee(v_task)) then
    raise exception 'Δεν έχεις δικαίωμα επεξεργασίας.';
  end if;
  update public.task_checklist set is_done=p_done where id=p_item_id;
end;
$$;
revoke all on function public.toggle_checklist(uuid,boolean) from public;
grant execute on function public.toggle_checklist(uuid,boolean) to authenticated;

create or replace function public.mark_notification_read(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() then raise exception 'No access'; end if;
  update public.notifications set read_at=coalesce(read_at,now())
  where id=p_id and user_id=auth.uid();
end;
$$;
revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.update_my_name(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active() or char_length(btrim(coalesce(p_name,''))) not between 2 and 100 then
    raise exception 'Μη έγκυρο όνομα.';
  end if;
  update public.profiles set full_name=btrim(p_name) where id=auth.uid();
end;
$$;
revoke all on function public.update_my_name(text) from public;
grant execute on function public.update_my_name(text) to authenticated;

-- Audit & notifications are written by trusted triggers, not directly by users.
create or replace function public.audit_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id text; v_payload jsonb;
begin
  if TG_TABLE_NAME='tasks' then
    v_id := (case when TG_OP='DELETE' then old.id else new.id end)::text;
    v_payload := case when TG_OP='INSERT' then jsonb_build_object('title',new.title,'team_id',new.team_id)
      else jsonb_build_object('old_status',old.status,'new_status',new.status,'title',new.title) end;
    if TG_OP='UPDATE' and old.status=new.status and old.title=new.title and old.due_at is not distinct from new.due_at and old.priority=new.priority then return new; end if;
  elsif TG_TABLE_NAME='team_members' then
    v_id := (case when TG_OP='DELETE' then old.team_id else new.team_id end)::text;
    v_payload := case when TG_OP='DELETE' then jsonb_build_object('user_id',old.user_id,'access',old.access)
      else jsonb_build_object('user_id',new.user_id,'access',new.access) end;
  elsif TG_TABLE_NAME='profiles' then
    v_id := (case when TG_OP='DELETE' then old.id else new.id end)::text;
    v_payload := jsonb_build_object('role',new.role,'active',new.active);
    if TG_OP='UPDATE' and old.role=new.role and old.active=new.active then return new; end if;
  elsif TG_TABLE_NAME='teams' then
    v_id := (case when TG_OP='DELETE' then old.id else new.id end)::text;
    v_payload := jsonb_build_object('name',new.name);
  elsif TG_TABLE_NAME='task_assignees' then
    v_id := (case when TG_OP='DELETE' then old.task_id else new.task_id end)::text;
    v_payload := case when TG_OP='DELETE' then jsonb_build_object('user_id',old.user_id)
      else jsonb_build_object('user_id',new.user_id) end;
  elsif TG_TABLE_NAME='task_checklist' then
    v_id := (case when TG_OP='DELETE' then old.task_id else new.task_id end)::text;
    v_payload := case when TG_OP='DELETE' then jsonb_build_object('item_id',old.id,'title',old.title)
      else jsonb_build_object('item_id',new.id,'title',new.title,'is_done',new.is_done) end;
  elsif TG_TABLE_NAME='task_comments' then
    v_id := new.task_id::text;
    v_payload := jsonb_build_object('comment_id',new.id);
  else
    return coalesce(new,old);
  end if;
  insert into public.audit_log (actor_id,entity_type,entity_id,action,details)
  values (auth.uid(),TG_TABLE_NAME,v_id,lower(TG_OP),v_payload);
  return coalesce(new,old);
end;
$$;
create trigger audit_tasks after insert or update on public.tasks for each row execute function public.audit_changes();
create trigger audit_teams after insert or update on public.teams for each row execute function public.audit_changes();
create trigger audit_team_members after insert or update or delete on public.team_members for each row execute function public.audit_changes();
create trigger audit_profiles after update on public.profiles for each row execute function public.audit_changes();
create trigger audit_assignees after insert or delete on public.task_assignees for each row execute function public.audit_changes();
create trigger audit_comments after insert on public.task_comments for each row execute function public.audit_changes();
create trigger audit_checklist after insert or update or delete on public.task_checklist for each row execute function public.audit_changes();

create or replace function public.notify_on_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_title text;
begin
  select title into v_title from public.tasks where id=new.task_id;
  insert into public.notifications (user_id,task_id,kind,message)
  values (new.user_id,new.task_id,'assignment','Σου ανατέθηκε: '||left(coalesce(v_title,''),140));
  return new;
end;
$$;
create trigger notify_assignment after insert on public.task_assignees
for each row execute function public.notify_on_assignment();

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id,task_id,kind,message)
  select a.user_id,new.task_id,'comment','Νέο σχόλιο σε εργασία που σου έχει ανατεθεί'
  from public.task_assignees a where a.task_id=new.task_id and a.user_id<>new.user_id;
  return new;
end;
$$;
create trigger notify_comment after insert on public.task_comments
for each row execute function public.notify_on_comment();

create or replace function public.touch_task_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end;
$$;
create trigger touch_tasks before update on public.tasks for each row execute function public.touch_task_updated_at();

-- Keep arbitrary client code from abusing SECURITY DEFINER helper functions.
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.audit_changes() from public;
revoke all on function public.notify_on_assignment() from public;
revoke all on function public.notify_on_comment() from public;
revoke all on function public.touch_task_updated_at() from public;

-- Avoid anonymous access even when Supabase default grants are broader.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Restrict mutable columns: coordinators cannot forge creators, status or completion.
revoke update on public.tasks from authenticated;
grant update (title,description,priority,due_at,review_required) on public.tasks to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name,role,active) on public.profiles to authenticated;
revoke update on public.teams from authenticated;
grant update (name,description,color) on public.teams to authenticated;
revoke update on public.team_members from authenticated;
grant update (access) on public.team_members to authenticated;
revoke update on public.task_checklist from authenticated;
grant update (title,sort_order) on public.task_checklist to authenticated;

-- Prevent losing the last administrator, even via an accidental admin edit.
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if old.role='admin' and old.active and (new.role <> 'admin' or not new.active) and
    (select count(*) from public.profiles where role='admin' and active)=1 then
   raise exception 'Δεν μπορείς να απενεργοποιήσεις τον τελευταίο Admin.';
 end if;
 return new;
end;
$$;
create trigger protect_last_admin before update on public.profiles
for each row execute function public.protect_last_admin();
revoke all on function public.protect_last_admin() from public;

-- Explicit grants (RLS policies still decide which rows are visible/mutable).
grant usage on schema public to authenticated;
grant select on public.profiles,public.teams,public.team_members,public.tasks,
 public.task_assignees,public.task_checklist,public.task_comments,public.notifications,public.audit_log to authenticated;
grant insert on public.teams,public.team_members,public.task_assignees,public.task_checklist,public.task_comments to authenticated;
grant delete on public.team_members,public.task_assignees,public.task_checklist to authenticated;

-- Prevent removing the very last assignee (including concurrent changes).
create or replace function public.prevent_last_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.tasks where id=old.task_id for update;
 if (select count(*) from public.task_assignees where task_id=old.task_id) <= 1 then
  raise exception 'Δεν μπορείς να αφαιρέσεις τον τελευταίο υπεύθυνο εργασίας.';
 end if;
 return old;
end;
$$;
create trigger prevent_last_assignee before delete on public.task_assignees
for each row execute function public.prevent_last_assignee();
revoke all on function public.prevent_last_assignee() from public;
