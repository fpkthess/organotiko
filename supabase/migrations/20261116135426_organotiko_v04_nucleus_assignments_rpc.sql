-- Applied to development project organotiko on 2026-11-16.
-- Synthetic test data only. Historical event/year mapping provisional.
insert into public.organotiko_nucleus_categories(name) values('ΓΕΝΙΚΑ') on conflict(name) do nothing;
insert into public.organotiko_nuclei(name,category_id)
select v.name,c.id from (values ('ΠΥΡΗΝΑΣ Α'),('ΠΥΡΗΝΑΣ Β'),('ΠΥΡΗΝΑΣ Γ')) as v(name)
cross join public.organotiko_nucleus_categories c where c.name='ΓΕΝΙΚΑ'
on conflict(name) do nothing;

create or replace function public.organotiko_set_primary_nucleus(
 p_student_id uuid,p_nucleus_name text
) returns void language plpgsql security definer set search_path='' as $fn$
declare sid uuid; target_nucleus uuid; category uuid; old_nucleus uuid;
begin
 if not public.organotiko_can_write() then raise exception 'No authorization or MFA' using errcode='42501';end if;
 if length(coalesce(p_nucleus_name,''))>120 then raise exception 'Nucleus name too long';end if;
 select id into sid from public.organotiko_students where id=p_student_id for update;
 if sid is null then raise exception 'Student not found';end if;
 if nullif(btrim(p_nucleus_name),'') is not null and upper(btrim(p_nucleus_name))<>'ΑΠΥΡΗΝΩΤΟΙ' then
  select id into category from public.organotiko_nucleus_categories where name='ΓΕΝΙΚΑ';
  insert into public.organotiko_nuclei(name,category_id) values(upper(btrim(p_nucleus_name)),category)
  on conflict(name) do nothing;
  select id into target_nucleus from public.organotiko_nuclei where name=upper(btrim(p_nucleus_name));
 end if;
 select nucleus_id into old_nucleus from public.organotiko_student_assignments
 where student_id=sid and kind='primary' and ended_at is null order by started_at desc limit 1;
 if old_nucleus is not distinct from target_nucleus then return;end if;
 update public.organotiko_student_assignments set ended_at=now()
 where student_id=sid and kind='primary' and ended_at is null;
 if target_nucleus is not null then
  insert into public.organotiko_student_assignments(student_id,nucleus_id,kind,started_at)
  values(sid,target_nucleus,'primary',now());
 end if;
 insert into public.organotiko_audit_log(table_name,record_id,action,actor_id,payload)
 values('organotiko_student_assignments',sid,'nucleus_change',auth.uid(),jsonb_build_object('assigned',target_nucleus is not null));
end $fn$;
revoke all on function public.organotiko_set_primary_nucleus(uuid,text) from public,anon;
grant execute on function public.organotiko_set_primary_nucleus(uuid,text) to authenticated;

