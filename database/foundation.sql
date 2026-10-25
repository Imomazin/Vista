-- Supabase Postgres foundation. Apply to a dedicated preview database first.
-- Each organisation is an isolation boundary, not a cosmetic client selector.
begin;
create table public.vista_organisations(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 160));
create table public.vista_memberships(organisation_id uuid not null references public.vista_organisations(id),user_id uuid not null references auth.users(id),role text not null check(role in ('owner','editor','viewer')),primary key(organisation_id,user_id));
create table public.vista_workspaces(organisation_id uuid primary key references public.vista_organisations(id),revision bigint not null default 1 check(revision>0),payload jsonb not null check(octet_length(payload::text)<=3000000),updated_at timestamptz not null default now(),updated_by uuid not null references auth.users(id));
create table public.vista_history(organisation_id uuid not null references public.vista_organisations(id),revision bigint not null,payload jsonb not null,recorded_at timestamptz not null default now(),actor uuid not null references auth.users(id),primary key(organisation_id,revision));
alter table public.vista_organisations enable row level security;
alter table public.vista_memberships enable row level security;
alter table public.vista_workspaces enable row level security;
alter table public.vista_history enable row level security;
revoke all on public.vista_organisations,public.vista_memberships,public.vista_workspaces,public.vista_history from anon,authenticated;
grant select on public.vista_organisations,public.vista_memberships,public.vista_workspaces,public.vista_history to authenticated;
grant insert,update on public.vista_workspaces to authenticated;
create policy membership_read on public.vista_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy organisation_read on public.vista_organisations for select to authenticated using(exists(select 1 from public.vista_memberships m where m.organisation_id=id and m.user_id=(select auth.uid())));
create policy workspace_read on public.vista_workspaces for select to authenticated using(exists(select 1 from public.vista_memberships m where m.organisation_id=vista_workspaces.organisation_id and m.user_id=(select auth.uid())));
create policy workspace_insert on public.vista_workspaces for insert to authenticated with check(updated_by=(select auth.uid()) and exists(select 1 from public.vista_memberships m where m.organisation_id=vista_workspaces.organisation_id and m.user_id=(select auth.uid()) and m.role in ('owner','editor')));
create policy workspace_update on public.vista_workspaces for update to authenticated using(exists(select 1 from public.vista_memberships m where m.organisation_id=vista_workspaces.organisation_id and m.user_id=(select auth.uid()) and m.role in ('owner','editor'))) with check(updated_by=(select auth.uid()) and exists(select 1 from public.vista_memberships m where m.organisation_id=vista_workspaces.organisation_id and m.user_id=(select auth.uid()) and m.role in ('owner','editor')));
create policy history_read on public.vista_history for select to authenticated using(exists(select 1 from public.vista_memberships m where m.organisation_id=vista_history.organisation_id and m.user_id=(select auth.uid())));
-- Append-only revisions cannot be supplied or edited by clients.
create function public.vista_capture_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if NEW.organisation_id<>OLD.organisation_id or NEW.revision<>OLD.revision+1 then raise exception 'Invalid revision'; end if;
 else
  if NEW.revision<>1 then raise exception 'Initial revision must be one'; end if;
 end if;
 NEW.updated_by:=auth.uid(); NEW.updated_at:=now();
 insert into public.vista_history(organisation_id,revision,payload,actor) values(NEW.organisation_id,NEW.revision,NEW.payload,NEW.updated_by);
 return NEW;
end; $$;
revoke all on function public.vista_capture_revision() from public;
create trigger vista_revision before insert or update on public.vista_workspaces for each row execute function public.vista_capture_revision();
commit;
