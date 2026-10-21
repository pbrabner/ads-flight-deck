alter table public.ad_accounts add column login_customer_id text check(login_customer_id is null or (platform='google' and login_customer_id ~ '^[0-9]{1,40}$'));

create table public.campaign_changes (
 id uuid primary key default gen_random_uuid(),
 entity_id uuid not null references public.entities(id),
 actor_id uuid not null references auth.users(id),
 target jsonb not null check(jsonb_typeof(target)='object'),
 before_state jsonb not null check(jsonb_typeof(before_state)='object'),
 change jsonb not null check(jsonb_typeof(change)='object'),
 status text not null default 'draft' check(status in ('draft','executing','succeeded','failed','unknown','verified','cancelled')),
 error text,
 after_state jsonb,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 started_at timestamptz,
 finished_at timestamptz,
 verified_by uuid references auth.users(id),
 check(expires_at>created_at - interval '1 day')
);
create index campaign_changes_entity_created on public.campaign_changes(entity_id,created_at desc);
create index campaign_changes_actor on public.campaign_changes(actor_id);
create index campaign_changes_verifier on public.campaign_changes(verified_by);
-- Ambiguous writes keep the lock until a read confirms the desired state.
create unique index campaign_changes_one_execution on public.campaign_changes(entity_id) where status in ('executing','unknown');
alter table public.campaign_changes enable row level security;
revoke all on public.campaign_changes from public,anon,authenticated;
grant select on public.campaign_changes to authenticated;
grant all on public.campaign_changes to service_role;
create policy campaign_changes_admin_read on public.campaign_changes for select to authenticated using ((select private.is_admin()));

create function private.immutable_campaign_proposal() returns trigger language plpgsql set search_path='' as $$
begin
 if new.entity_id<>old.entity_id or new.actor_id<>old.actor_id or new.target<>old.target or new.before_state<>old.before_state
  or new.change<>old.change or new.created_at<>old.created_at or new.expires_at<>old.expires_at then
  raise check_violation using message='Campaign proposal is immutable';
 end if;
 return new;
end $$;
revoke all on function private.immutable_campaign_proposal() from public,anon,authenticated;
create trigger immutable_campaign_proposal before update on public.campaign_changes for each row execute function private.immutable_campaign_proposal();

create function public.claim_campaign_change(p_id uuid,p_actor uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare campaign uuid; changed integer;
begin
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin') then return false; end if;
 select entity_id into campaign from public.campaign_changes where id=p_id and actor_id=p_actor and status='draft' and expires_at>now();
 if campaign is null then return false; end if;
 -- Serializes claims for different proposals of the same campaign.
 perform 1 from public.entities where id=campaign for update;
 if exists(select 1 from public.campaign_changes where entity_id=campaign and status in ('executing','unknown')) then return false; end if;
 update public.campaign_changes set status='executing',started_at=now()
 where id=p_id and actor_id=p_actor and status='draft' and expires_at>now();
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.claim_campaign_change(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_campaign_change(uuid,uuid) to service_role;
