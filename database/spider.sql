-- VisTa Spider: persistent crawl queue, scheduled recrawling and per-host politeness.
-- Apply after foundation.sql and index.sql, in a preview database first, then production.
-- Workers (the cron-invoked /api/spider/worker route, any number in parallel) claim jobs with
-- FOR UPDATE SKIP LOCKED, so no job is processed twice; leases expire and failed jobs retry with
-- back-off. Organisations schedule recrawls of their pages; results become observations in the
-- VisTa Index (index.sql). Claiming, finishing and scheduling require the server-only service role.
begin;

create table public.vista_spider_queue(
 id bigserial primary key,
 url text not null check(url ~ '^https?://[^/@:?#]+\.[^/@?#]+' and length(url) <= 2048),
 host text not null check(length(host) between 3 and 253),
 organisation_id uuid references public.vista_organisations(id) on delete cascade,
 priority integer not null default 50 check(priority between 0 and 100),
 render boolean not null default false,
 status text not null default 'queued' check(status in ('queued','running','done','failed')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 run_after timestamptz not null default now(),
 lease_until timestamptz, lease_token uuid, last_error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- A URL is pending at most once (deduplicated queue).
create unique index vista_spider_pending on public.vista_spider_queue(url) where status in ('queued','running');
create index vista_spider_ready on public.vista_spider_queue(priority desc, run_after) where status = 'queued';
create index vista_spider_org on public.vista_spider_queue(organisation_id, created_at desc);

create table public.vista_spider_hosts(
 host text primary key,
 last_fetch timestamptz,
 crawl_delay_seconds integer not null default 5 check(crawl_delay_seconds between 1 and 600)
);

create table public.vista_spider_schedules(
 organisation_id uuid not null references public.vista_organisations(id) on delete cascade,
 url text not null check(url ~ '^https?://[^/@:?#]+\.[^/@?#]+' and length(url) <= 2048),
 every interval not null default interval '7 days' check(every between interval '1 day' and interval '90 days'),
 priority integer not null default 60 check(priority between 0 and 100),
 render boolean not null default false,
 next_run_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(organisation_id, url)
);

alter table public.vista_spider_queue enable row level security;
alter table public.vista_spider_hosts enable row level security;
alter table public.vista_spider_schedules enable row level security;
revoke all on public.vista_spider_queue, public.vista_spider_hosts, public.vista_spider_schedules from public, anon, authenticated;
grant select(id, url, host, organisation_id, priority, render, status, attempts, run_after, last_error, created_at, updated_at) on public.vista_spider_queue to authenticated;
create policy spider_queue_read on public.vista_spider_queue for select to authenticated using (organisation_id is not null and exists(select 1 from public.vista_memberships m where m.organisation_id = vista_spider_queue.organisation_id and m.user_id = (select auth.uid())));
grant select, insert, update, delete on public.vista_spider_schedules to authenticated;
create policy spider_schedules_read on public.vista_spider_schedules for select to authenticated using (exists(select 1 from public.vista_memberships m where m.organisation_id = vista_spider_schedules.organisation_id and m.user_id = (select auth.uid())));
create policy spider_schedules_write on public.vista_spider_schedules for all to authenticated
 using (exists(select 1 from public.vista_memberships m where m.organisation_id = vista_spider_schedules.organisation_id and m.user_id = (select auth.uid()) and m.role in ('owner','editor')))
 with check (created_by = (select auth.uid()) and exists(select 1 from public.vista_memberships m where m.organisation_id = vista_spider_schedules.organisation_id and m.user_id = (select auth.uid()) and m.role in ('owner','editor')));

-- Enqueue due scheduled recrawls (deduplicated against pending jobs); returns how many were queued.
create function public.vista_spider_schedule() returns integer language plpgsql security definer set search_path = '' as $$
declare queued integer;
begin
 with due as (
  update public.vista_spider_schedules s set next_run_at = now() + s.every
  where s.next_run_at <= now()
  returning s.organisation_id, s.url, s.priority, s.render)
 insert into public.vista_spider_queue(url, host, organisation_id, priority, render)
 select d.url, lower(split_part(split_part(d.url, '://', 2), '/', 1)), d.organisation_id, d.priority, d.render from due d
 on conflict do nothing;
 get diagnostics queued = row_count;
 return queued;
end; $$;

-- Claim up to `batch` jobs: highest priority first, at most one per host, hosts respected by crawl delay.
create function public.vista_spider_claim(batch integer default 4) returns setof public.vista_spider_queue language plpgsql security definer set search_path = '' as $$
begin
 update public.vista_spider_queue set status = 'failed', last_error = 'Worker lease expired after the final attempt', lease_token = null, lease_until = null, updated_at = now()
  where status = 'running' and lease_until < now() and attempts >= 3;
 return query
 with picked as (
  select distinct on (q.host) q.id, q.host from public.vista_spider_queue q
  left join public.vista_spider_hosts h on h.host = q.host
  where ((q.status = 'queued' and q.run_after <= now()) or (q.status = 'running' and q.lease_until < now())) and q.attempts < 3
   and (h.last_fetch is null or h.last_fetch < now() - make_interval(secs => h.crawl_delay_seconds))
  order by q.host, q.priority desc, q.run_after
  for update of q skip locked),
 limited as (select p.id, p.host from picked p join public.vista_spider_queue q2 on q2.id = p.id order by q2.priority desc, q2.run_after limit greatest(1, least(batch, 10))),
 touched as (insert into public.vista_spider_hosts(host, last_fetch) select l.host, now() from limited l on conflict (host) do update set last_fetch = now() returning 1)
 update public.vista_spider_queue q set status = 'running', attempts = q.attempts + 1, lease_until = now() + interval '2 minutes', lease_token = gen_random_uuid(), updated_at = now()
 from limited l where q.id = l.id returning q.*;
end; $$;

-- Finish a claimed job; failures retry with back-off until the third attempt.
create function public.vista_spider_finish(job bigint, fence uuid, failure text) returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 update public.vista_spider_queue set
  status = case when failure is null then 'done' when attempts >= 3 then 'failed' else 'queued' end,
  last_error = left(failure, 300),
  run_after = case when failure is not null then now() + make_interval(secs => attempts * 300) else run_after end,
  lease_until = null, lease_token = null, updated_at = now()
 where id = job and status = 'running' and lease_token = fence and lease_until > now();
 get diagnostics changed = row_count;
 return changed = 1;
end; $$;

revoke all on function public.vista_spider_schedule(), public.vista_spider_claim(integer), public.vista_spider_finish(bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.vista_spider_schedule(), public.vista_spider_claim(integer), public.vista_spider_finish(bigint, uuid, text) to service_role;

commit;
