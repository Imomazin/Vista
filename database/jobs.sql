-- Apply after foundation.sql. This queue executes bounded single-page audits.
-- A scheduled trigger is deliberately not activated by the migration.
begin;
create table public.vista_jobs(
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.vista_organisations(id),
 created_by uuid not null references auth.users(id),project_id text not null check(length(project_id) between 1 and 80),
 url text not null check(length(url)<=2048),idempotency_key uuid not null,
 status text not null default 'queued' check(status in ('queued','running','succeeded','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 3),run_after timestamptz not null default now(),
 lease_until timestamptz,lease_token uuid,result jsonb,error text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organisation_id,idempotency_key),check(result is null or octet_length(result::text)<=1000000)
);
create index vista_jobs_ready on public.vista_jobs(run_after) where status in ('queued','running');
create index vista_jobs_org on public.vista_jobs(organisation_id,created_at desc);
alter table public.vista_jobs enable row level security;
revoke all on public.vista_jobs from public,anon,authenticated;
grant select(id,organisation_id,created_by,project_id,url,idempotency_key,status,attempts,run_after,lease_until,result,error,created_at,updated_at) on public.vista_jobs to authenticated;
create policy jobs_read on public.vista_jobs for select to authenticated using(exists(select 1 from public.vista_memberships m where m.organisation_id=vista_jobs.organisation_id and m.user_id=(select auth.uid())));
create function public.vista_enqueue_audit(org uuid,project text,target text,dedupe uuid,scheduled_at timestamptz default now()) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid; result_id uuid;
begin
 if not exists(select 1 from public.vista_memberships where organisation_id=org and user_id=auth.uid() and role in ('owner','editor')) then raise exception 'Membership does not permit scheduling' using errcode='42501'; end if;
 -- Serialize tenant quotas, including concurrent enqueue requests.
 perform 1 from public.vista_organisations where id=org for update;
 select id into existing from public.vista_jobs where organisation_id=org and idempotency_key=dedupe;
 if existing is not null then return existing; end if;
 if project is null or length(project) not between 1 and 80 or target is null or length(target)>2048 or target !~ '^https://[^/@:?#]+\.[^/@:?#]+' or dedupe is null then raise exception 'Invalid audit request'; end if;
 if scheduled_at is null or scheduled_at<now()-interval '1 minute' or scheduled_at>now()+interval '30 days' then raise exception 'Schedule must be within thirty days'; end if;
 if not exists(select 1 from public.vista_workspaces w, jsonb_array_elements(w.payload->'workspace'->'projects') p where w.organisation_id=org and p->>'id'=project) then raise exception 'Project must exist in the cloud checkpoint'; end if;
 if (select count(*) from public.vista_jobs where organisation_id=org and created_at>now()-interval '1 day')>=100 then raise exception 'Daily job quota reached'; end if;
 if (select count(*) from public.vista_jobs where organisation_id=org and status in ('queued','running'))>=20 then raise exception 'Pending job quota reached'; end if;
 insert into public.vista_jobs(organisation_id,created_by,project_id,url,idempotency_key,run_after) values(org,auth.uid(),project,target,dedupe,greatest(now(),scheduled_at)) returning id into result_id;
 return result_id;
end; $$;
create function public.vista_cancel_audit(job uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 update public.vista_jobs j set status='cancelled',lease_token=null,lease_until=null,updated_at=now() where j.id=job and j.status in ('queued','running') and exists(select 1 from public.vista_memberships m where m.organisation_id=j.organisation_id and m.user_id=auth.uid() and m.role in ('owner','editor'));
 get diagnostics changed=row_count;return changed=1;
end; $$;
-- Worker RPCs require the server-only service role; browser users cannot claim or finish jobs.
create function public.vista_claim_audit() returns setof public.vista_jobs language plpgsql security definer set search_path='' as $$
declare picked uuid;
begin
 update public.vista_jobs set status='failed',error='Worker lease expired after final attempt',lease_token=null,lease_until=null,updated_at=now() where status='running' and lease_until<now() and attempts>=3;
 select j.id into picked from public.vista_jobs j where ((j.status='queued' and j.run_after<=now()) or (j.status='running' and j.lease_until<now())) and j.attempts<3 order by j.run_after,j.created_at for update skip locked limit 1;
 if picked is null then return; end if;
 return query update public.vista_jobs set status='running',attempts=attempts+1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),updated_at=now() where id=picked returning *;
end; $$;
create function public.vista_finish_audit(job uuid,fence uuid,output jsonb,failure text) returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if output is not null and octet_length(output::text)>1000000 then raise exception 'Result too large'; end if;
 if (output is null)=(failure is null) then raise exception 'Provide either a result or a failure'; end if;
 update public.vista_jobs set status=case when failure is null then 'succeeded' when attempts>=3 then 'failed' else 'queued' end,result=output,error=left(failure,300),run_after=case when failure is not null then now()+make_interval(secs=>attempts*60) else run_after end,lease_until=null,lease_token=null,updated_at=now() where id=job and status='running' and lease_token=fence and lease_until>now();
 get diagnostics changed=row_count;return changed=1;
end; $$;
revoke all on function public.vista_enqueue_audit(uuid,text,text,uuid,timestamptz),public.vista_cancel_audit(uuid),public.vista_claim_audit(),public.vista_finish_audit(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.vista_enqueue_audit(uuid,text,text,uuid,timestamptz),public.vista_cancel_audit(uuid) to authenticated;
grant execute on function public.vista_claim_audit(),public.vista_finish_audit(uuid,uuid,jsonb,text) to service_role;
commit;
