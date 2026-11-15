-- Applied after development core to mark every NEW student created during tests as synthetic.
-- Critical: reverse the default and RPC behaviour ONLY during the reviewed production cutover.
alter table public.organotiko_students alter column data_origin set default 'synthetic';
create or replace function public.organotiko_create_student(p_name text,p_surname text,p_department text,p_year_code text)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare pid uuid;
begin
 if not (select public.organotiko_can_write()) then raise exception 'Insufficient rights or MFA' using errcode='42501';end if;
 if nullif(btrim(p_name),'') is null or nullif(btrim(p_surname),'') is null then raise exception 'Name and surname required';end if;
 insert into public.organotiko_people(name,surname)
 values(upper(btrim(p_name)),upper(btrim(p_surname))) returning id into pid;
 insert into public.organotiko_students(person_id,department,year_code,ef_registered,status,data_origin)
 values(pid,coalesce(p_department,''),coalesce(nullif(p_year_code,''),'1'),false,'active','synthetic');
 insert into public.organotiko_audit_log(table_name,record_id,action,actor_id)
 values('organotiko_people',pid,'create',(select auth.uid()));
 return pid;
end $fn$;
revoke all on function public.organotiko_create_student(text,text,text,text) from public,anon;
grant execute on function public.organotiko_create_student(text,text,text,text) to authenticated;
