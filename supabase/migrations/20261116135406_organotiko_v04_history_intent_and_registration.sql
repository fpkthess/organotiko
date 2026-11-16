-- Applied to development project organotiko on 2026-11-16.
-- Synthetic test data only. Historical event/year mapping provisional.
-- Development-only foundation for the v0.4 historical table UI.
-- No existing real records are imported or altered. Legacy event -> year mapping
-- is provisional and requires confirmation before production import.
insert into public.organotiko_academic_years(code,status,started_on,ended_on)
values ('2022-23','closed','2022-09-01','2023-08-31'),('2023-24','closed','2023-09-01','2024-08-31'),('2024-25','closed','2024-09-01','2025-08-31'),('2025-26','closed','2025-09-01','2026-08-31')
on conflict(code) do nothing;

insert into public.organotiko_event_catalog(year_id,kind,title,event_on)
select y.id,v.kind,v.title,null::date from (values
 ('2025-26','ΕΚΛ','ΕΚΛ26'),('2025-26','ΒΓΣ','ΒΓΣ26'),
 ('2024-25','ΑΓΣ','ΑΓΣ25'),('2024-25','ΕΚΛ','ΕΚΛ25'),('2024-25','ΒΓΣ','ΒΓΣ25'),
 ('2023-24','ΑΓΣ','ΑΓΣ24'),('2023-24','ΕΚΛ','ΕΚΛ24-2'),('2023-24','ΕΚΛ','ΕΚΛ24-1'),('2023-24','ΒΓΣ','ΒΓΣ24'),
 ('2022-23','ΑΓΣ','ΑΓΣ23')
) as v(code,kind,title)
join public.organotiko_academic_years y on y.code=v.code
on conflict(year_id,title) do nothing;

-- The original seed used preliminary 1/2/3 statuses. Registered individuals
-- cannot simultaneously retain a current-year intent.
update public.organotiko_yearly_records r set intent_code=''
from public.organotiko_students s
where r.student_id=s.id and s.data_origin='synthetic' and s.ef_registered
  and r.intent_code<>'' and r.registration_source is not null;

create or replace function public.organotiko_set_annual_intent(
 p_student_id uuid,p_school_year text,p_intent text
) returns void language plpgsql security definer set search_path='' as $fn$
declare sid uuid; yid uuid; registered boolean; existing_source text;
begin
 if not public.organotiko_can_write() then raise exception 'No authorization or MFA' using errcode='42501';end if;
 if p_intent is null or p_intent not in ('','1','2','3') then raise exception 'Invalid intent';end if;
 select id,ef_registered into sid,registered from public.organotiko_students where id=p_student_id for update;
 if sid is null then raise exception 'Student does not exist';end if;
 select id into yid from public.organotiko_academic_years where code=p_school_year;
 if yid is null then raise exception 'Unknown year';end if;
 if registered and p_intent<>'' then raise exception 'Registered students cannot have 1/2/3 intent';end if;
 select registration_source into existing_source from public.organotiko_yearly_records where student_id=sid and year_id=yid;
 if existing_source is not null and p_intent<>'' then raise exception 'Actual registration source cannot be overridden by intent';end if;
 insert into public.organotiko_yearly_records(student_id,year_id,year_code_at_start,intent_code)
 select s.id,yid,s.year_code,p_intent from public.organotiko_students s where s.id=sid
 on conflict(student_id,year_id) do update set intent_code=excluded.intent_code;
 insert into public.organotiko_audit_log(table_name,record_id,action,actor_id,payload)
 values('organotiko_yearly_records',sid,'intent_update',auth.uid(),jsonb_build_object('school_year',p_school_year,'has_intent',p_intent<>''));
end $fn$;
revoke all on function public.organotiko_set_annual_intent(uuid,text,text) from public,anon;
grant execute on function public.organotiko_set_annual_intent(uuid,text,text) to authenticated;

create or replace function public.organotiko_set_event_value(
 p_student_id uuid,p_event_code text,p_which text,p_value text
) returns void language plpgsql security definer set search_path='' as $fn$
declare sid uuid; eid uuid;
begin
 if not public.organotiko_can_write() then raise exception 'No authorization or MFA' using errcode='42501';end if;
 if p_which not in ('intent','actual') or length(coalesce(p_value,''))>120 then raise exception 'Invalid event entry';end if;
 select id into sid from public.organotiko_students where id=p_student_id for update;
 if sid is null then raise exception 'Student not found';end if;
 select id into eid from public.organotiko_event_catalog where title=p_event_code order by event_on nulls last limit 1;
 if eid is null then raise exception 'Event not configured';end if;
 if p_which='intent' then
  insert into public.organotiko_event_records(student_id,event_id,intent,actual)
  values(sid,eid,coalesce(p_value,''),'')
  on conflict(student_id,event_id) do update set intent=excluded.intent;
 else
  insert into public.organotiko_event_records(student_id,event_id,intent,actual)
  values(sid,eid,'',coalesce(p_value,''))
  on conflict(student_id,event_id) do update set actual=excluded.actual;
 end if;
 insert into public.organotiko_audit_log(table_name,record_id,action,actor_id,payload)
 values('organotiko_event_records',sid,'event_cell_update',auth.uid(),jsonb_build_object('event',p_event_code,'field',p_which));
end $fn$;
revoke all on function public.organotiko_set_event_value(uuid,text,text,text) from public,anon;
grant execute on function public.organotiko_set_event_value(uuid,text,text,text) to authenticated;

create or replace function public.organotiko_register_efekth(
 p_student_id uuid,p_school_year text,p_source text,p_registered_on date
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare y public.organotiko_academic_years%rowtype;st public.organotiko_students%rowtype;ev uuid;
begin
 if not public.organotiko_can_write() then raise exception 'Insufficient rights or MFA' using errcode='42501';end if;
 if p_source is null or p_source not in ('+','ψ2','ψ3','ψ4','ψ5','Μ') then raise exception 'Required EF registration source';end if;
 if p_registered_on is null then raise exception 'Required EF registration date';end if;
 select * into y from public.organotiko_academic_years where code=p_school_year;
 if not found or y.status not in ('current','closed') then raise exception 'Unknown academic year';end if;
 if (y.started_on is not null and p_registered_on<y.started_on) or (y.ended_on is not null and p_registered_on>y.ended_on) then raise exception 'Date outside academic year';end if;
 select * into st from public.organotiko_students where id=p_student_id for update;
 if not found then raise exception 'Student not found';end if;
 if st.ef_registered then raise exception 'Already registered: approval needed for new registration';end if;
 insert into public.organotiko_registration_events(student_id,year_id,source,registered_on,year_code_at_event,recorded_by)
 values(p_student_id,y.id,p_source,p_registered_on,coalesce(st.year_code,''),auth.uid()) returning id into ev;
 insert into public.organotiko_yearly_records(student_id,year_id,year_code_at_start,intent_code,registration_source,registered_on)
 values(p_student_id,y.id,st.year_code,'',p_source,p_registered_on)
 on conflict(student_id,year_id) do update set registration_source=excluded.registration_source,registered_on=excluded.registered_on,intent_code='';
 update public.organotiko_students set ef_registered=true where id=p_student_id;
 insert into public.organotiko_audit_log(table_name,record_id,action,actor_id,payload)
 values('organotiko_students',p_student_id,'ef_register',auth.uid(),jsonb_build_object('event_id',ev,'source',p_source,'date',p_registered_on,'year',p_school_year));
 return ev;
end $fn$;
revoke all on function public.organotiko_register_efekth(uuid,text,text,date) from public,anon;
grant execute on function public.organotiko_register_efekth(uuid,text,text,date) to authenticated;
