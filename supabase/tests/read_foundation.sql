-- Disposable PostgreSQL test ONLY; fixtures are rolled back.
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into organotiko_private.read_access values ('00000000-0000-0000-0000-000000000001',true);
insert into public.organotiko_people(id,surname,name) values ('10000000-0000-0000-0000-000000000001','SYNTHETIC','TEST');
insert into public.organotiko_students(id,person_id,department,year_code,ef_registered,status) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','TEST','01',true,'archived');
insert into public.organotiko_person_membership_links values ('10000000-0000-0000-0000-000000000001',false,true,'test','test-1',now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","aal":"aal1"}',true);
do $$begin
 if public.organotiko_can_read() or exists(select 1 from public.organotiko_student_read_model) then raise exception 'AAL1 leaked data'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","aal":"aal2"}',true);
do $$begin
 if public.organotiko_can_read() or exists(select 1 from public.organotiko_student_read_model) then raise exception 'Portal-only user leaked data'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","aal":"aal2"}',true);
do $$begin
 if not public.organotiko_can_read() or (select count(*) from public.organotiko_student_read_model)<>1 then raise exception 'Authorized read failed'; end if;
 if not exists(select 1 from public.organotiko_student_read_model where status='archived' and ef_registered and not protoporia and bluepass) then raise exception 'Read mapping failed'; end if;
 begin
  update public.organotiko_students set notes='forbidden';
  raise exception 'Write unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into organotiko_private.read_access values ('00000000-0000-0000-0000-000000000002',true);
  raise exception 'Self-grant unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$begin
 begin
  perform * from public.organotiko_student_read_model;
  raise exception 'Anonymous read unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
