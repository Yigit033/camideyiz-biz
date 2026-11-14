-- Camideyiz Biz: private, server-only read-through cache for authorized Diyanet datasets.
-- Apply only to an approved Supabase project after review. No production migration performed.
begin;

create table if not exists public.diyanet_states (
  id integer primary key check(id > 0),
  country_id integer not null check(country_id > 0),
  code text,
  name text not null check(length(name) between 1 and 140),
  source_fetched_at timestamptz not null default now()
);
create table if not exists public.diyanet_cities (
  id integer primary key check(id > 0),
  state_id integer not null references public.diyanet_states(id) on delete restrict,
  code text,
  name text not null check(length(name) between 1 and 140),
  source_fetched_at timestamptz not null default now()
);
create index if not exists diyanet_cities_state_idx on public.diyanet_cities(state_id,name);
create table if not exists public.diyanet_prayer_days (
  city_id integer not null references public.diyanet_cities(id) on delete restrict,
  day date not null,
  timezone text not null default 'Europe/Istanbul' check(timezone='Europe/Istanbul'),
  times jsonb not null check(jsonb_typeof(times)='array' and jsonb_array_length(times)=6),
  hijri_date text,
  source text not null default 'diyanet-awqat-salah' check(source='diyanet-awqat-salah'),
  source_fetched_at timestamptz not null,
  primary key(city_id,day)
);
create index if not exists diyanet_prayer_days_date_idx on public.diyanet_prayer_days(day);

create table if not exists public.diyanet_sync_jobs (
  sync_key text primary key check(length(sync_key) between 3 and 80),
  lease_token uuid,
  lease_until timestamptz,
  last_completed_at timestamptz,
  last_attempt_at timestamptz,
  success_count integer not null default 0,
  failure_count integer not null default 0
);

-- The service role is the ONLY client authorized to query these tables.
alter table public.diyanet_states enable row level security;
alter table public.diyanet_cities enable row level security;
alter table public.diyanet_prayer_days enable row level security;
alter table public.diyanet_sync_jobs enable row level security;
revoke all on public.diyanet_states,public.diyanet_cities,public.diyanet_prayer_days,public.diyanet_sync_jobs
 from public,anon,authenticated;
grant select,insert,update,delete on
 public.diyanet_states,public.diyanet_cities,public.diyanet_prayer_days,public.diyanet_sync_jobs
 to service_role;

-- A leased, durable deduplication guard protects upstream API quotas in multiple API instances.
create or replace function public.claim_diyanet_sync(
 p_key text, p_minimum_minutes integer
) returns text language plpgsql security definer set search_path=public as $$
declare claimed uuid;
begin
 if p_key !~ '^(states|cities:[1-9][0-9]{0,7}|monthly:[1-9][0-9]{0,7}|weekly:[1-9][0-9]{0,7})$'
    or p_minimum_minutes not between 1 and 43200 then
   raise exception 'Invalid sync request';
 end if;
 insert into public.diyanet_sync_jobs(sync_key,lease_token,lease_until,last_attempt_at)
 values(p_key,gen_random_uuid(),now()+interval '3 minutes',now())
 on conflict(sync_key) do update
 set lease_token=excluded.lease_token,
     lease_until=excluded.lease_until,
     last_attempt_at=excluded.last_attempt_at
 where
   (diyanet_sync_jobs.lease_until is null or diyanet_sync_jobs.lease_until < now())
   and (diyanet_sync_jobs.last_completed_at is null or
        diyanet_sync_jobs.last_completed_at <
            now() - make_interval(mins=>p_minimum_minutes))
 returning lease_token into claimed;
 return claimed::text;
end;$$;

create or replace function public.finish_diyanet_sync(
 p_key text,p_lease text,p_success boolean
) returns boolean language plpgsql security definer set search_path=public as $$
declare did_update boolean;
begin
 update public.diyanet_sync_jobs set
    last_completed_at=case when p_success then now() else last_completed_at end,
    success_count=success_count+case when p_success then 1 else 0 end,
    failure_count=failure_count+case when p_success then 0 else 1 end,
    lease_until=case when p_success then null else now()+interval '30 minutes' end,
    lease_token=null
 where sync_key=p_key and lease_token::text=p_lease
 returning true into did_update;
 return coalesce(did_update,false);
end;$$;

revoke all on function public.claim_diyanet_sync(text,integer) from public,anon,authenticated;
revoke all on function public.finish_diyanet_sync(text,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_diyanet_sync(text,integer) to service_role;
grant execute on function public.finish_diyanet_sync(text,text,boolean) to service_role;
commit;
