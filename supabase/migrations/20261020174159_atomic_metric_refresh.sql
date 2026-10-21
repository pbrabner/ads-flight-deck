-- A successful complete report replaces its window, including rows now omitted by the platform.
-- An invalid row aborts the entire transaction, preserving the previous snapshot.
create function public.replace_account_metrics(p_account uuid,p_from date,p_to date,p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare written integer;
begin
 if p_account is null or p_from is null or p_to is null or p_to<p_from or p_to-p_from>30
   or p_rows is null or jsonb_typeof(p_rows)<>'array' then
   raise check_violation using message='Invalid metric window';
 end if;
 perform 1 from public.ad_accounts where id=p_account for update;
 if not found then raise check_violation using message='Unknown account'; end if;
 if exists (
   select 1 from jsonb_to_recordset(p_rows) as r(entity_id uuid,date date)
   left join public.entities e on e.id=r.entity_id
   where r.date is null or r.date<p_from or r.date>p_to or e.id is null or e.ad_account_id<>p_account
 ) then raise check_violation using message='Metric outside account or window'; end if;

 delete from public.metrics_daily m using public.entities e
 where m.entity_id=e.id and e.ad_account_id=p_account and m.date between p_from and p_to;
 insert into public.metrics_daily(entity_id,date,impressions,clicks,spend,reach,conversions,conversion_value,leads,raw)
 select entity_id,date,coalesce(impressions,0),coalesce(clicks,0),coalesce(spend,0),reach,
   coalesce(conversions,0),coalesce(conversion_value,0),coalesce(leads,0),coalesce(raw,'{}'::jsonb)
 from jsonb_to_recordset(p_rows) as r(entity_id uuid,date date,impressions bigint,clicks bigint,spend numeric,
   reach bigint,conversions numeric,conversion_value numeric,leads numeric,raw jsonb);
 get diagnostics written = row_count;
 return written;
end $$;
revoke all on function public.replace_account_metrics(uuid,date,date,jsonb) from public,anon,authenticated;
grant execute on function public.replace_account_metrics(uuid,date,date,jsonb) to service_role;
