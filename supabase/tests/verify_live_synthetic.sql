-- Read-only diagnostics, safe to run while testing. Never publish personal records.
select
  (select count(*) from public.organotiko_students) as students,
  (select count(*) from public.organotiko_students where data_origin='synthetic') as synthetic_students,
  (select count(*) from public.organotiko_yearly_records) as yearly_records,
  (select count(*) from public.organotiko_registration_events) as registrations,
  (select count(*) from public.organotiko_students where ef_registered) as registered_students,
  (select coalesce(sum(registrations),0) from public.organotiko_efekth_daily_summary) as daily_sum,
  (select coalesce(sum(registrations),0) from public.organotiko_efekth_year_summary) as yearly_sum;
select count(*) as missing_ef_event from public.organotiko_students s
where s.ef_registered=true and not exists(select 1 from public.organotiko_registration_events e where e.student_id=s.id);
