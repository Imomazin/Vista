begin;
create table public.vista_google_reports (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.vista_organisations(id),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 report jsonb not null check(jsonb_typeof(report)='object' and octet_length(report::text)<=230000 and report->>'source' in ('Google Search Console API','GA4 Analytics Data API'))
);
create index vista_google_reports_org_created on public.vista_google_reports(organisation_id,created_at desc);
create index vista_google_reports_creator on public.vista_google_reports(created_by);
alter table public.vista_google_reports enable row level security;
revoke all on public.vista_google_reports from public,anon,authenticated;
grant select,insert,delete on public.vista_google_reports to authenticated;
create policy google_reports_read on public.vista_google_reports for select to authenticated using(exists(select 1 from public.vista_memberships m where m.organisation_id=vista_google_reports.organisation_id and m.user_id=(select auth.uid())));
create policy google_reports_insert on public.vista_google_reports for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.vista_memberships m where m.organisation_id=vista_google_reports.organisation_id and m.user_id=(select auth.uid()) and m.role='owner'));
create policy google_reports_delete on public.vista_google_reports for delete to authenticated using(exists(select 1 from public.vista_memberships m where m.organisation_id=vista_google_reports.organisation_id and m.user_id=(select auth.uid()) and m.role='owner'));
commit;
