-- Optional administratively approved active city list for daily, quota-conscious sync.
-- Do not run in production without owner approval.
begin;
create table if not exists public.diyanet_sync_targets (
 city_id integer primary key references public.diyanet_cities(id) on delete cascade,
 enabled boolean not null default true,
 last_sync_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists diyanet_sync_targets_due_idx on
 public.diyanet_sync_targets(enabled,last_sync_at);
alter table public.diyanet_sync_targets enable row level security;
revoke all on public.diyanet_sync_targets from public,anon,authenticated;
grant select,insert,update,delete on public.diyanet_sync_targets to service_role;
commit;
