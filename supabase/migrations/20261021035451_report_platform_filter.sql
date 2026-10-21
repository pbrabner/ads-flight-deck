-- Replace signatures to avoid ambiguous RPC overloads; omitted platform keeps combined reports.
drop function public.report_entities(uuid,date,date,text,uuid,text);
drop function public.report_series(uuid,date,date,text);

-- Separate CTEs for totals and results prevent spend multiplication by result types.
-- Status is CURRENT metadata, not the status an entity had on a historical date.
create function public.report_entities(p_client uuid,p_from date,p_to date,p_level text default 'campaign',p_parent uuid default null,p_status text default 'all',p_platform text default 'all')
returns table(id uuid,name text,platform text,status text,level text,parent_id uuid,objective text,
 spend numeric,impressions numeric,clicks numeric,leads numeric,ctr numeric,cpc numeric,cpl numeric,results jsonb,result_complete boolean)
language sql stable security invoker set search_path='' as $$
 with selected as (
  select e.*,coalesce(e.objective,parent.objective,grand.objective) as campaign_objective
  from public.entities e join public.ad_accounts a on a.id=e.ad_account_id
  left join public.entities parent on parent.id=e.parent_id
  left join public.entities grand on grand.id=parent.parent_id
  where a.client_id=p_client and e.level=p_level and (p_parent is null or e.parent_id=p_parent)
   and (p_platform='all' or e.platform=p_platform)
   and (p_level<>'campaign' or p_status='all' or (p_status='active' and e.status in ('ACTIVE','ENABLED')) or (p_status='paused' and e.status='PAUSED'))
 ), base as (
  select m.* from public.metrics_daily m join selected e on e.id=m.entity_id where m.date between p_from and p_to
 ), amounts as (
  select entity_id,sum(spend) as spend,sum(impressions)::numeric as impressions,sum(clicks)::numeric as clicks,sum(leads) as leads,
   bool_and(coalesce(jsonb_array_length(results)>0,false)) as complete from base group by entity_id
 ), result_values as (
  select entity_id,r->>'type' as type,sum((r->>'value')::numeric) as value
  from base cross join lateral jsonb_array_elements(results) r group by entity_id,r->>'type'
 ), result_groups as (
  select entity_id,jsonb_agg(jsonb_build_object('type',type,'value',value) order by type) as results from result_values group by entity_id
 )
 select e.id,e.name,e.platform,e.status,e.level,e.parent_id,e.campaign_objective,
 coalesce(m.spend,0),coalesce(m.impressions,0),coalesce(m.clicks,0),coalesce(m.leads,0),
 m.clicks/nullif(m.impressions,0)*100,m.spend/nullif(m.clicks,0),m.spend/nullif(m.leads,0),r.results,coalesce(m.complete,false)
 from selected e left join amounts m on m.entity_id=e.id left join result_groups r on r.entity_id=e.id
 order by coalesce(m.spend,0) desc,e.name;
$$;

create function public.report_series(p_client uuid,p_from date,p_to date,p_status text default 'all',p_platform text default 'all')
returns table(date date,spend numeric,impressions numeric,clicks numeric,leads numeric,results jsonb,result_complete boolean)
language sql stable security invoker set search_path='' as $$
 with base as (
  select m.* from public.metrics_daily m join public.entities e on e.id=m.entity_id join public.ad_accounts a on a.id=e.ad_account_id
  where a.client_id=p_client and e.level='campaign' and m.date between p_from and p_to
   and (p_platform='all' or e.platform=p_platform)
   and (p_status='all' or (p_status='active' and e.status in ('ACTIVE','ENABLED')) or (p_status='paused' and e.status='PAUSED'))
 ), amounts as (
  select date,sum(spend) as spend,sum(impressions)::numeric as impressions,sum(clicks)::numeric as clicks,sum(leads) as leads,
   bool_and(coalesce(jsonb_array_length(results)>0,false)) as complete from base group by date
 ), result_values as (
  select date,r->>'type' as type,sum((r->>'value')::numeric) as value
  from base cross join lateral jsonb_array_elements(results) r group by date,r->>'type'
 ), result_groups as (
  select date,jsonb_agg(jsonb_build_object('type',type,'value',value) order by type) as results from result_values group by date
 )
 select m.date,m.spend,m.impressions,m.clicks,m.leads,r.results,m.complete
 from amounts m left join result_groups r on r.date=m.date order by m.date;
$$;
revoke all on function public.report_entities(uuid,date,date,text,uuid,text,text),public.report_series(uuid,date,date,text,text) from public,anon;
grant execute on function public.report_entities(uuid,date,date,text,uuid,text,text),public.report_series(uuid,date,date,text,text) to authenticated,service_role;

notify pgrst, 'reload schema';
