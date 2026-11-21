-- Camideyiz Biz announcements v1. DO NOT apply to production before owner approval.
-- Service-role only; no anonymous read access to push tokens or announcement jobs.
begin;
create extension if not exists pgcrypto;

create table if not exists public.cb_push_devices (
  id uuid primary key,
  secret_hash text not null check(secret_hash ~ '^[0-9a-f]{64}$'),
  expo_token text not null unique check(length(expo_token) between 25 and 256),
  platform text not null check(platform in ('android','ios')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cb_push_devices_active_idx on public.cb_push_devices(enabled)
  where enabled=true;

create table if not exists public.cb_push_registration_limits (
  ip_hash text not null check(ip_hash ~ '^[0-9a-f]{64}$'),
  hour_bucket bigint not null,
  used integer not null default 0 check(used>=0),
  primary key(ip_hash,hour_bucket)
);

create table if not exists public.cb_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(title) between 3 and 80),
  body text not null check(length(body) between 3 and 280),
  scheduled_at timestamptz not null,
  status text not null default 'draft' check(
    status in ('draft','scheduled','dispatching','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  accepted_count integer not null default 0,
  failed_count integer not null default 0
);
create index if not exists cb_announcements_due_idx on public.cb_announcements(status,scheduled_at);

create table if not exists public.cb_announcement_deliveries (
  id bigserial primary key,
  announcement_id uuid not null references public.cb_announcements(id) on delete cascade,
  device_id uuid not null references public.cb_push_devices(id) on delete cascade,
  status text not null default 'queued' check(
    status in ('queued','sending','accepted','failed')),
  attempts integer not null default 0 check(attempts between 0 and 8),
  lease_until timestamptz,
  expo_ticket_id text,
  receipt_status text check(receipt_status in ('pending','ok','error','expired')),
  receipt_checked_at timestamptz,
  error_code text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(announcement_id,device_id)
);
create index if not exists cb_announcement_deliveries_queue_idx
  on public.cb_announcement_deliveries(status,lease_until,id);

alter table public.cb_push_devices enable row level security;
alter table public.cb_push_registration_limits enable row level security;
alter table public.cb_announcements enable row level security;
alter table public.cb_announcement_deliveries enable row level security;
revoke all on public.cb_push_devices,public.cb_push_registration_limits,
  public.cb_announcements,public.cb_announcement_deliveries
  from public,anon,authenticated;
grant select,insert,update,delete on public.cb_push_devices,public.cb_push_registration_limits,
  public.cb_announcements,public.cb_announcement_deliveries to service_role;
grant usage,select on sequence public.cb_announcement_deliveries_id_seq to service_role;

-- Limit registration attempts atomically per hashed Vercel source IP:
-- no raw IP is stored. Source IP must be taken from a trusted reverse proxy.
create or replace function public.cb_push_take_registration_slot(
  p_ip_hash text, p_max integer default 15
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_used integer;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' or p_max not between 1 and 100 then
    return false;
  end if;
  insert into public.cb_push_registration_limits(ip_hash,hour_bucket,used)
  values (p_ip_hash, floor(extract(epoch from now())/3600)::bigint,1)
  on conflict (ip_hash,hour_bucket) do update
    set used=public.cb_push_registration_limits.used+1
    where public.cb_push_registration_limits.used<p_max
  returning used into v_used;
  return v_used is not null;
end; $$;

-- Possession of an installation secret authorizes device opt-out and token
-- refresh. Unknown device IDs can be registered; existing IDs cannot be taken
-- over without the existing secret. No public SELECT returns push tokens.
create or replace function public.cb_push_set_subscription(
  p_id uuid,p_secret_hash text,p_expo_token text,p_platform text,p_enabled boolean
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare previous record;
begin
  if p_id is null or p_secret_hash !~ '^[0-9a-f]{64}$'
    or length(p_expo_token) not between 25 and 256
    or p_platform not in ('ios','android') or p_enabled is null then
    return false;
  end if;
  select id,secret_hash into previous from public.cb_push_devices
   where id=p_id for update;
  if found and previous.secret_hash<>p_secret_hash then return false; end if;
  if found then
    update public.cb_push_devices
      set expo_token=p_expo_token,platform=p_platform,
          enabled=p_enabled,updated_at=now() where id=p_id;
  else
    if not p_enabled then return true; end if;
    insert into public.cb_push_devices(id,secret_hash,expo_token,platform,enabled)
      values(p_id,p_secret_hash,p_expo_token,p_platform,true);
  end if;
  return true;
exception when unique_violation then
  return false;
end; $$;

-- Atomically materialize every due broadcast against the opt-in subscription
-- snapshot. Parallel cron processes cannot claim the same announcement.
create or replace function public.cb_push_materialize_due(
  p_limit integer default 2
) returns integer language plpgsql security definer set search_path = ''
as $$
declare a record; made integer:=0;
begin
  if p_limit not between 1 and 5 then return 0; end if;
  for a in
    select id from public.cb_announcements
     where status='scheduled' and scheduled_at<=now()
       and scheduled_at>now()-interval '24 hours'
     order by scheduled_at,id for update skip locked limit p_limit
  loop
    update public.cb_announcements
       set status='dispatching',updated_at=now() where id=a.id;
    insert into public.cb_announcement_deliveries(announcement_id,device_id)
      select a.id,id from public.cb_push_devices where enabled=true
      on conflict (announcement_id,device_id) do nothing;
    if not exists(select 1 from public.cb_announcement_deliveries
        where announcement_id=a.id) then
      update public.cb_announcements
        set status='completed',completed_at=now() where id=a.id;
    end if;
    made:=made+1;
  end loop;
  -- Do not send stale announcements if no cron was available for 24h.
  update public.cb_announcements set status='cancelled',updated_at=now()
   where status='scheduled' and scheduled_at<=now()-interval '24 hours';
  return made;
end; $$;

-- Durable, concurrent-safe claim. On server crash, the 5-minute lease permits
-- retries. At-least-once delivery possible when provider accepted but ack lost.
create or replace function public.cb_push_claim_deliveries(
  p_limit integer default 80
) returns table (
  delivery_id bigint,announcement_id uuid,title text,body text,expo_token text
) language plpgsql security definer set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 then return; end if;
  return query
  with picked as (
    select d.id from public.cb_announcement_deliveries d
      join public.cb_announcements a on a.id=d.announcement_id
      join public.cb_push_devices p on p.id=d.device_id
    where a.status='dispatching' and p.enabled=true and d.attempts<3
      and (d.status='queued' or
        (d.status='sending' and d.lease_until<now()))
    order by d.id for update of d skip locked limit p_limit
  ), claimed as (
    update public.cb_announcement_deliveries d
     set status='sending',attempts=d.attempts+1,
         lease_until=now()+interval '5 minutes'
      from picked where d.id=picked.id
      returning d.id,d.announcement_id,d.device_id
  )
  select c.id,a.id,a.title,a.body,p.expo_token
    from claimed c
    join public.cb_announcements a on a.id=c.announcement_id
    join public.cb_push_devices p on p.id=c.device_id;
end; $$;

-- Each call accepts only known pending claims. Unknown status or payload
-- cannot be used as an arbitrary UPDATE primitive.
create or replace function public.cb_push_finish_deliveries(
  p_results jsonb
) returns integer language plpgsql security definer set search_path = ''
as $$
declare elem jsonb; n integer:=0; accepted boolean; failed boolean; code text;
begin
  if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>100 then
    raise exception 'Invalid delivery batch';
  end if;
  for elem in select value from jsonb_array_elements(p_results) loop
    if not ((elem->>'id') ~ '^[1-9][0-9]{0,17}$') or
       (elem->>'status') not in ('accepted','retry','failed') then
      raise exception 'Invalid delivery result';
    end if;
    code:=left(coalesce(elem->>'error',''),80);
    update public.cb_announcement_deliveries
      set status=case when elem->>'status'='accepted' then 'accepted'
           when elem->>'status'='failed' or attempts>=3 then 'failed'
           else 'queued' end,
          expo_ticket_id=case when elem->>'status'='accepted'
            then nullif(left(coalesce(elem->>'ticket',''),150),'')
            else null end,
          error_code=nullif(code,''),
          lease_until=null,
          accepted_at=case when elem->>'status'='accepted' then now() else null end
      where id=(elem->>'id')::bigint and status='sending';
    n:=n+1;
    if code='DeviceNotRegistered' then
      update public.cb_push_devices set enabled=false,updated_at=now()
        where id in (select d.device_id from public.cb_announcement_deliveries d
          where d.id=(elem->>'id')::bigint);
    end if;
  end loop;
  -- An opt-out must prevent all unsent jobs, including jobs that were
  -- materialized before the user revoked consent.
  update public.cb_announcement_deliveries d
     set status='failed',lease_until=null,error_code='subscription_disabled'
    from public.cb_push_devices p
   where p.id=d.device_id and p.enabled=false
     and d.status in ('queued','sending');
  -- Give stale lease/attempt exhausted claims an explicit final state.
  update public.cb_announcement_deliveries set status='failed',lease_until=null,
    error_code='retry_exhausted'
    where status='sending' and attempts>=3 and lease_until<now();
  -- Completed means all attempts sent to push provider (or failed), NOT that
  -- a recipient has read or received the notification.
  update public.cb_announcements a
    set status='completed',completed_at=now(),updated_at=now(),
      accepted_count=(select count(*) from public.cb_announcement_deliveries d
        where d.announcement_id=a.id and d.status='accepted'),
      failed_count=(select count(*) from public.cb_announcement_deliveries d
        where d.announcement_id=a.id and d.status='failed')
    where a.status='dispatching' and not exists (
      select 1 from public.cb_announcement_deliveries d
      where d.announcement_id=a.id and d.status in ('queued','sending'));
  return n;
end; $$;

-- Provider receipts report downstream push-provider acceptance, not
-- whether a user saw or opened the announcement.
create or replace function public.cb_push_claim_receipts(p_limit integer default 80)
returns table(delivery_id bigint,ticket_id text)
language plpgsql security definer set search_path=''
as $
begin
  if p_limit not between 1 and 100 then return; end if;
  update public.cb_announcement_deliveries set receipt_status='expired'
   where status='accepted' and expo_ticket_id is not null
     and coalesce(receipt_status,'pending')='pending'
     and accepted_at<now()-interval '24 hours';
  return query
  with picked as (
    select d.id from public.cb_announcement_deliveries d
      where d.status='accepted' and d.expo_ticket_id is not null
        and coalesce(d.receipt_status,'pending')='pending'
        and d.accepted_at<now()-interval '15 minutes'
        and d.accepted_at>now()-interval '24 hours'
        and (d.receipt_checked_at is null
           or d.receipt_checked_at<now()-interval '10 minutes')
      order by d.accepted_at,d.id for update skip locked limit p_limit
  ), touched as (
    update public.cb_announcement_deliveries d set receipt_checked_at=now()
      from picked where d.id=picked.id
      returning d.id,d.expo_ticket_id
  )
  select t.id,t.expo_ticket_id from touched t;
end; $;

create or replace function public.cb_push_finish_receipts(p_results jsonb)
returns integer language plpgsql security definer set search_path=''
as $
declare elem jsonb; n integer:=0; code text;
begin
  if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>100
    then raise exception 'Invalid receipt batch'; end if;
  for elem in select value from jsonb_array_elements(p_results) loop
    if not ((elem->>'id') ~ '^[1-9][0-9]{0,17}
  public.cb_push_set_subscription(uuid,text,text,text,boolean),
  public.cb_push_materialize_due(integer),
  public.cb_push_claim_deliveries(integer),
  public.cb_push_finish_deliveries(jsonb),
  public.cb_push_claim_receipts(integer),
  public.cb_push_finish_receipts(jsonb) from public,anon,authenticated;
grant execute on function public.cb_push_take_registration_slot(text,integer),
  public.cb_push_set_subscription(uuid,text,text,text,boolean),
  public.cb_push_materialize_due(integer),
  public.cb_push_claim_deliveries(integer),
  public.cb_push_finish_deliveries(jsonb),
  public.cb_push_claim_receipts(integer),
  public.cb_push_finish_receipts(jsonb) to service_role;
commit;
) or
      (elem->>'status') not in ('ok','error','pending')
      then raise exception 'Invalid receipt result'; end if;
    code:=left(coalesce(elem->>'error',''),80);
    update public.cb_announcement_deliveries
      set receipt_status=elem->>'status',
        error_code=case when elem->>'status'='error'
          then nullif(code,'') else error_code end
      where id=(elem->>'id')::bigint and status='accepted';
    if code='DeviceNotRegistered' then
      update public.cb_push_devices set enabled=false,updated_at=now()
       where id in (select device_id from public.cb_announcement_deliveries
          where id=(elem->>'id')::bigint);
    end if;
    n:=n+1;
  end loop;
  return n;
end; $;

revoke execute on function public.cb_push_take_registration_slot(text,integer),
  public.cb_push_set_subscription(uuid,text,text,text,boolean),
  public.cb_push_materialize_due(integer),
  public.cb_push_claim_deliveries(integer),
  public.cb_push_finish_deliveries(jsonb) from public,anon,authenticated;
grant execute on function public.cb_push_take_registration_slot(text,integer),
  public.cb_push_set_subscription(uuid,text,text,text,boolean),
  public.cb_push_materialize_due(integer),
  public.cb_push_claim_deliveries(integer),
  public.cb_push_finish_deliveries(jsonb) to service_role;
commit;
