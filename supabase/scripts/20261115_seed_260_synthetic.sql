-- This seed was run ONCE on 2026-11-15 on the temporary-development organotiko project.
-- DANGER: do not rerun when live real data exists; seed is guarded to require empty students.
insert into public.organotiko_academic_years (code,status,started_on,ended_on)
values ('2026-27','current','2026-09-01','2027-08-31') on conflict (code) do nothing;
do $seed$
declare i integer;p uuid;n integer;
begin
 select count(*) into n from public.organotiko_students;
 if n<>0 then raise exception 'Seed skipped: students already exist (% rows)',n; end if;
 for i in 1..260 loop
 insert into public.organotiko_people(name,surname) values('ΦΟΙΤΗΤΗΣ','ΔΟΚΙΜΗ-'||lpad(i::text,4,'0')) returning id into p;
 insert into public.organotiko_students(person_id,department,year_code,ef_registered,status,university,data_origin,notes)
 values(p,(array['ΤΜΗΜΑ ΔΟΚΙΜΗΣ Α','ΤΜΗΜΑ ΔΟΚΙΜΗΣ Β','ΤΜΗΜΑ ΔΟΚΙΜΗΣ Γ'])[1+((i-1)%3)],
 (array['1','2','3','4','Ν1','91'])[1+((i-1)%6)],false,'active','ΔΟΚΙΜΑΣΤΙΚΟ ΠΑΝΕΠΙΣΤΗΜΙΟ','synthetic','');
 end loop;
end $seed$;
insert into public.organotiko_yearly_records(student_id,year_id,year_code_at_start,intent_code)
select s.id,y.id,s.year_code,case ((row_number() over(order by s.id))::integer%4)
when 0 then '' when 1 then '1' when 2 then '2' else '3' end
from public.organotiko_students s cross join public.organotiko_academic_years y
where s.data_origin='synthetic' and y.code='2026-27'
on conflict (student_id,year_id) do nothing;
do $demo$
declare r record;y uuid;i integer:=0;source_code text;dt date;
begin
 select id into y from public.organotiko_academic_years where code='2026-27';
 if (select count(*) from public.organotiko_registration_events)<>0 then raise exception 'Event table not empty';end if;
 for r in select s.id,s.year_code from public.organotiko_students s where s.data_origin='synthetic' and not s.ef_registered order by s.id limit 28 loop
 i:=i+1; source_code:=(array['+','ψ2','ψ3','ψ4','ψ5','Μ'])[1+((i-1)%6)]; dt:=date '2026-10-01'+((i-1)%20);
 insert into public.organotiko_registration_events(student_id,year_id,source,registered_on,year_code_at_event)
 values(r.id,y,source_code,dt,r.year_code);
 update public.organotiko_yearly_records set registration_source=source_code,registered_on=dt where student_id=r.id and year_id=y;
 update public.organotiko_students set ef_registered=true where id=r.id;
 end loop;
end $demo$;
