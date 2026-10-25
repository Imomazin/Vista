-- VisTa AI answer sampling: source-grounded, organisation-scoped observations.
-- Apply in the authorised Supabase SQL editor before enabling scheduled jobs.
create table if not exists public.vista_ai_samples (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.vista_organisations(id) on delete cascade,
 provider text not null check (provider in ('openai')),
 model text not null,
 brand text not null,
 prompt text not null,
 response text not null,
 citations jsonb not null default '[]'::jsonb,
 mentioned boolean not null,
 observed_at timestamptz not null,
 created_at timestamptz not null default now(),
 constraint vista_ai_samples_brand_size check(length(brand) between 2 and 100),
 constraint vista_ai_samples_prompt_size check(length(prompt) between 12 and 900),
 constraint vista_ai_samples_response_size check(length(response) between 1 and 12000)
);
create index if not exists vista_ai_samples_org_recent on public.vista_ai_samples(organisation_id,observed_at desc);
alter table public.vista_ai_samples enable row level security;
drop policy if exists vista_ai_samples_read on public.vista_ai_samples;
create policy vista_ai_samples_read on public.vista_ai_samples for select to authenticated
 using (exists (select 1 from public.vista_memberships m where m.organisation_id=vista_ai_samples.organisation_id and m.user_id=(select auth.uid())));
-- Users cannot insert/update/delete automated sample records; cron worker uses server-held service role.
revoke insert,update,delete on public.vista_ai_samples from anon,authenticated;
grant select on public.vista_ai_samples to authenticated;
