create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.clients (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 120),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 created_at timestamptz not null default now()
);
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','client')),
 client_id uuid references public.clients(id),
 email text not null,
 check ((role='client' and client_id is not null) or (role='admin' and client_id is null))
);
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (select 1 from public.profiles where user_id=auth.uid() and role='admin');
$$;
create function private.client_id() returns uuid language sql stable security definer set search_path = '' as $$
 select client_id from public.profiles where user_id=auth.uid() and auth.uid() is not null;
$$;
revoke all on function private.is_admin(), private.client_id() from public;
grant execute on function private.is_admin(), private.client_id() to authenticated, service_role;

create table public.connections (
 id uuid primary key default gen_random_uuid(),
 platform text not null check (platform in ('meta','google')),
 label text not null check (length(label) between 1 and 120),
 access_token text,
 refresh_token text,
 expires_at timestamptz,
 owner_client_id uuid references public.clients(id),
 created_at timestamptz not null default now(),
 unique(id,platform)
);
-- Tokens remain server-only. Column grants below prevent even logged-in admins from selecting secrets.
create table public.ad_accounts (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id),
 connection_id uuid not null,
 platform text not null,
 external_id text not null check (external_id ~ '^[0-9]+$'),
 currency text not null default 'BRL' check (currency='BRL'),
 timezone text not null default 'America/Sao_Paulo' check (timezone='America/Sao_Paulo'),
 active boolean not null default true,
 lead_actions text[] not null default '{}',
 created_at timestamptz not null default now(),
 unique(platform,external_id),
 unique(id,platform),
 foreign key(connection_id,platform) references public.connections(id,platform)
);
create function private.check_connection_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.connections where id=new.connection_id and owner_client_id is not null and owner_client_id<>new.client_id) then
   raise exception 'Connection belongs to another client';
 end if;
 return new;
end $$;
create trigger account_connection_owner before insert or update on public.ad_accounts for each row execute function private.check_connection_owner();
create table public.entities (
 id uuid primary key default gen_random_uuid(),
 ad_account_id uuid not null,
 platform text not null,
 level text not null check (level in ('campaign','adset','ad')),
 external_id text not null,
 parent_id uuid,
 name text not null,
 status text not null default 'UNKNOWN',
 objective text,
 raw jsonb not null default '{}',
 unique(ad_account_id,level,external_id),
 unique(id,ad_account_id),
 foreign key(ad_account_id,platform) references public.ad_accounts(id,platform) on delete cascade,
 foreign key(parent_id,ad_account_id) references public.entities(id,ad_account_id)
);
create table public.metrics_daily (
 entity_id uuid not null references public.entities(id) on delete cascade,
 date date not null,
 impressions bigint not null default 0 check (impressions>=0),
 clicks bigint not null default 0 check (clicks>=0),
 spend numeric(18,6) not null default 0,
 reach bigint,
 conversions numeric not null default 0,
 conversion_value numeric not null default 0,
 leads numeric not null default 0,
 raw jsonb not null default '{}',
 primary key(entity_id,date)
);
create table public.sync_runs (
 id uuid primary key default gen_random_uuid(),
 ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 from_date date not null,
 to_date date not null check(to_date>=from_date),
 status text not null default 'running' check(status in ('running','ok','error')),
 rows integer not null default 0,
 error text
);
create index entities_account_level on public.entities(ad_account_id,level);
create index entities_parent on public.entities(parent_id);
create index metrics_date on public.metrics_daily(date);
create index accounts_client on public.ad_accounts(client_id);
create index sync_account_started on public.sync_runs(ad_account_id,started_at desc);
create unique index sync_one_running_per_account on public.sync_runs(ad_account_id) where status='running';

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.entities enable row level security;
alter table public.metrics_daily enable row level security;
alter table public.sync_runs enable row level security;

create policy clients_read on public.clients for select to authenticated using ((select private.is_admin()) or id=(select private.client_id()));
create policy profiles_read on public.profiles for select to authenticated using ((select private.is_admin()) or user_id=(select auth.uid()));
create policy connections_metadata on public.connections for select to authenticated using ((select private.is_admin()));
create policy accounts_read on public.ad_accounts for select to authenticated using ((select private.is_admin()) or client_id=(select private.client_id()));
create policy entities_read on public.entities for select to authenticated using (exists(select 1 from public.ad_accounts a where a.id=ad_account_id));
create policy metrics_read on public.metrics_daily for select to authenticated using (exists(select 1 from public.entities e where e.id=entity_id));
create policy sync_read on public.sync_runs for select to authenticated using ((select private.is_admin()));

revoke all on public.clients,public.profiles,public.connections,public.ad_accounts,public.entities,public.metrics_daily,public.sync_runs from anon,authenticated;
grant select on public.clients,public.profiles,public.ad_accounts,public.entities,public.metrics_daily,public.sync_runs to authenticated;
grant select(id,platform,label,expires_at,owner_client_id,created_at) on public.connections to authenticated;
grant all on public.clients,public.profiles,public.connections,public.ad_accounts,public.entities,public.metrics_daily,public.sync_runs to service_role;
create view public.connections_public with (security_invoker=true) as
 select id,platform,label,expires_at,owner_client_id,created_at from public.connections;
grant select on public.connections_public to authenticated,service_role;

create function public.metrics_by_period(p_client uuid,p_from date,p_to date,p_level text default 'campaign',p_parent uuid default null)
returns table(id uuid,name text,platform text,status text,level text,parent_id uuid,spend numeric,impressions numeric,clicks numeric,leads numeric,ctr numeric,cpc numeric,cpl numeric)
language sql stable security invoker set search_path='' as $$
 select e.id,e.name,e.platform,e.status,e.level,e.parent_id,
 coalesce(sum(m.spend),0),coalesce(sum(m.impressions),0),coalesce(sum(m.clicks),0),coalesce(sum(m.leads),0),
 sum(m.clicks)::numeric/nullif(sum(m.impressions),0)*100,
 sum(m.spend)/nullif(sum(m.clicks),0),sum(m.spend)/nullif(sum(m.leads),0)
 from public.entities e join public.ad_accounts a on a.id=e.ad_account_id
 left join public.metrics_daily m on m.entity_id=e.id and m.date between p_from and p_to
 where a.client_id=p_client and e.level=p_level and (p_parent is null or e.parent_id=p_parent)
 group by e.id order by coalesce(sum(m.spend),0) desc,e.name;
$$;
create function public.metrics_timeseries(p_client uuid,p_from date,p_to date)
returns table(date date,spend numeric,impressions numeric,clicks numeric,leads numeric)
language sql stable security invoker set search_path='' as $$
 select m.date,sum(m.spend),sum(m.impressions)::numeric,sum(m.clicks)::numeric,sum(m.leads)
 from public.metrics_daily m join public.entities e on e.id=m.entity_id join public.ad_accounts a on a.id=e.ad_account_id
 where a.client_id=p_client and e.level='campaign' and m.date between p_from and p_to
 group by m.date order by m.date;
$$;
revoke all on function public.metrics_by_period(uuid,date,date,text,uuid),public.metrics_timeseries(uuid,date,date) from public,anon;
grant execute on function public.metrics_by_period(uuid,date,date,text,uuid),public.metrics_timeseries(uuid,date,date) to authenticated,service_role;
