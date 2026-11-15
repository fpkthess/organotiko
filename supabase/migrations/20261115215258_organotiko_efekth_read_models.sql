-- Applied in Supabase project organotiko on 2026-11-15. Preliminary summaries, NOT full ΝΟΥΜΕΡΑ.xlsx.
create or replace view public.organotiko_efekth_daily_summary with (security_invoker=true) as
select y.code as academic_year, e.registered_on as registration_date, e.source as source_code,
 e.year_code_at_event as student_year_at_registration, count(*)::integer as registrations
from public.organotiko_registration_events e join public.organotiko_academic_years y on y.id=e.year_id
group by y.code,e.registered_on,e.source,e.year_code_at_event;
revoke all on public.organotiko_efekth_daily_summary from public,anon,authenticated;
grant select on public.organotiko_efekth_daily_summary to authenticated;
create or replace view public.organotiko_efekth_year_summary with (security_invoker=true) as
select y.code as academic_year, e.source as source_code,
 e.year_code_at_event as student_year_at_registration, count(*)::integer as registrations
from public.organotiko_registration_events e join public.organotiko_academic_years y on y.id=e.year_id
group by y.code,e.source,e.year_code_at_event;
revoke all on public.organotiko_efekth_year_summary from public,anon,authenticated;
grant select on public.organotiko_efekth_year_summary to authenticated;
