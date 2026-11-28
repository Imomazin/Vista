-- Tenant-scoped provider connections (R1+). Apply after foundation.sql, in a preview database first.
-- Each row holds one organisation's OAuth connection to one provider. `secret` is the refresh token
-- sealed with AES-256-GCM by the server (VISTA_TOKEN_ENCRYPTION_KEY, bound to organisation and
-- provider); browser roles can read the metadata but never the secret. Only the server, with the
-- service role, reads secrets to obtain short-lived access tokens.
begin;

create table public.vista_connections(
 organisation_id uuid not null references public.vista_organisations(id) on delete cascade,
 provider text not null check(provider in ('google','hubspot','meta','linkedin','microsoft','tiktok','shopify','wordpress','github','stripe')),
 account text check(length(account) <= 320),
 scopes text[] not null default '{}',
 secret text not null check(secret like 'v1.%' and length(secret) between 20 and 8000),
 property text check(length(property) <= 300),
 connected_by uuid not null references auth.users(id),
 connected_at timestamptz not null default now(),
 primary key(organisation_id, provider)
);
alter table public.vista_connections enable row level security;
revoke all on public.vista_connections from public, anon, authenticated;
grant select(organisation_id, provider, account, scopes, property, connected_by, connected_at) on public.vista_connections to authenticated;
create policy connections_read on public.vista_connections for select to authenticated using (exists(select 1 from public.vista_memberships m where m.organisation_id = vista_connections.organisation_id and m.user_id = (select auth.uid())));

-- Store a connection after the OAuth callback (server, service role). The user recorded when the flow
-- started must still be an owner or editor of the organisation.
create function public.vista_store_connection(org uuid, prov text, acct text, scope_list text[], sealed text, by_user uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.vista_memberships where organisation_id = org and user_id = by_user and role in ('owner','editor')) then raise exception 'Membership does not permit connecting providers' using errcode = '42501'; end if;
 insert into public.vista_connections(organisation_id, provider, account, scopes, secret, connected_by)
 values (org, prov, left(acct, 320), coalesce(scope_list, '{}'), sealed, by_user)
 on conflict (organisation_id, provider) do update set account = excluded.account, scopes = excluded.scopes, secret = excluded.secret, connected_by = excluded.connected_by, connected_at = now(), property = null;
end; $$;

-- Choose the Search Console or GA4 property (owners and editors, with their own session).
create function public.vista_select_property(org uuid, prov text, prop text) returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 if not exists(select 1 from public.vista_memberships where organisation_id = org and user_id = auth.uid() and role in ('owner','editor')) then raise exception 'Membership does not permit this change' using errcode = '42501'; end if;
 update public.vista_connections set property = left(prop, 300) where organisation_id = org and provider = prov;
 get diagnostics changed = row_count; return changed = 1;
end; $$;

-- Disconnect (after the server has revoked the token at the provider).
create function public.vista_delete_connection(org uuid, prov text) returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 if not exists(select 1 from public.vista_memberships where organisation_id = org and user_id = auth.uid() and role in ('owner','editor')) then raise exception 'Membership does not permit this change' using errcode = '42501'; end if;
 delete from public.vista_connections where organisation_id = org and provider = prov;
 get diagnostics changed = row_count; return changed = 1;
end; $$;

revoke all on function public.vista_store_connection(uuid, text, text, text[], text, uuid), public.vista_select_property(uuid, text, text), public.vista_delete_connection(uuid, text) from public, anon, authenticated;
grant execute on function public.vista_store_connection(uuid, text, text, text[], text, uuid) to service_role;
grant execute on function public.vista_select_property(uuid, text, text), public.vista_delete_connection(uuid, text) to authenticated;

commit;
