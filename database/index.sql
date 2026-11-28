-- VisTa Index (server). Apply after foundation.sql, in a preview database first, then production.
-- Shared public-web observations (derived only: no page copies, no response headers) and
-- organisation-scoped watches. Server routes write the shared index with the service role;
-- signed-in members read it; tenant-private data stays in organisation-scoped tables.
-- Retention: observations older than 13 months are removed unless an organisation watches the host.
begin;

create table public.vista_index_pages(
 key text primary key check(length(key) between 3 and 2048),           -- host + path + query, lower case, no www or trailing slash
 host text not null check(length(host) between 3 and 253),
 first_seen timestamptz not null default now(),
 last_seen timestamptz not null default now()
);
create index vista_index_pages_host on public.vista_index_pages(host);

create table public.vista_index_observations(
 id bigserial primary key,
 key text not null references public.vista_index_pages(key) on delete cascade,
 observed_at timestamptz not null,
 source text not null check(source in ('vista','common-crawl')),
 crawl text check(crawl is null or crawl ~ '^CC-MAIN-[0-9]{4}-[0-9]{2}$'),
 status integer, title text check(length(title)<=300), description text check(length(description)<=500),
 h1 text[], headings text[], words integer, text_hash text, signature integer[],
 internal_links integer, external_links integer, schema_types text[], canonical text, indexable boolean,
 links_out jsonb,                                                          -- observed outbound links for VisTa Graph (bounded)
 recorded_at timestamptz not null default now(),
 unique(key, observed_at, source),
 check(octet_length(coalesce(links_out::text,'')) <= 200000)
);
create index vista_index_observations_key on public.vista_index_observations(key, observed_at desc);

create table public.vista_index_watches(
 organisation_id uuid not null references public.vista_organisations(id) on delete cascade,
 host text not null check(length(host) between 3 and 253),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(organisation_id, host)
);

alter table public.vista_index_pages enable row level security;
alter table public.vista_index_observations enable row level security;
alter table public.vista_index_watches enable row level security;
revoke all on public.vista_index_pages, public.vista_index_observations, public.vista_index_watches from public, anon, authenticated;

-- Shared public-web index: readable by signed-in users, written only by the service role (which bypasses RLS).
grant select on public.vista_index_pages, public.vista_index_observations to authenticated;
create policy index_pages_read on public.vista_index_pages for select to authenticated using (true);
create policy index_observations_read on public.vista_index_observations for select to authenticated using (true);

-- Watches are organisation data: members read them, owners and editors manage them.
grant select, insert, delete on public.vista_index_watches to authenticated;
create policy index_watches_read on public.vista_index_watches for select to authenticated using (exists(select 1 from public.vista_memberships m where m.organisation_id = vista_index_watches.organisation_id and m.user_id = (select auth.uid())));
create policy index_watches_insert on public.vista_index_watches for insert to authenticated with check (created_by = (select auth.uid()) and exists(select 1 from public.vista_memberships m where m.organisation_id = vista_index_watches.organisation_id and m.user_id = (select auth.uid()) and m.role in ('owner','editor')));
create policy index_watches_delete on public.vista_index_watches for delete to authenticated using (exists(select 1 from public.vista_memberships m where m.organisation_id = vista_index_watches.organisation_id and m.user_id = (select auth.uid()) and m.role in ('owner','editor')));

-- Retention (run daily from the scheduled worker with the service role).
create function public.vista_index_retention() returns integer language sql security definer set search_path = '' as $$
 with gone as (
  delete from public.vista_index_observations o
  using public.vista_index_pages p
  where o.key = p.key and o.observed_at < now() - interval '13 months'
   and not exists(select 1 from public.vista_index_watches w where w.host = p.host)
  returning 1)
 select count(*)::integer from gone;
$$;
revoke all on function public.vista_index_retention() from public, anon, authenticated;

commit;
