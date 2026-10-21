begin;
insert into public.clients(id,name,slug) values ('20000000-0000-4000-8000-000000000001','Sync A','sync-a'),('20000000-0000-4000-8000-000000000002','Sync B','sync-b');
insert into public.connections(id,platform,label) values ('30000000-0000-4000-8000-000000000001','meta','Sync');
insert into public.ad_accounts(id,client_id,connection_id,platform,external_id) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','meta','1'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','meta','2');
insert into public.entities(id,ad_account_id,platform,level,external_id,name) values
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','meta','campaign','1','A'),
 ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','meta','campaign','2','B');
insert into public.metrics_daily(entity_id,date,leads) values
 ('50000000-0000-4000-8000-000000000001','2026-10-20',1),
 ('50000000-0000-4000-8000-000000000001','2026-10-19',3),
 ('50000000-0000-4000-8000-000000000002','2026-10-20',2);
select public.replace_account_metrics('40000000-0000-4000-8000-000000000001','2026-10-20','2026-10-20','[]'::jsonb);
do $$ begin
 if exists(select 1 from public.metrics_daily where entity_id='50000000-0000-4000-8000-000000000001' and date='2026-10-20') then raise exception 'stale metric retained'; end if;
 if (select count(*) from public.metrics_daily) <> 2 then raise exception 'replacement escaped scope'; end if;
 begin
  perform public.replace_account_metrics('40000000-0000-4000-8000-000000000001','2026-10-19','2026-10-19',
    '[{"entity_id":"50000000-0000-4000-8000-000000000002","date":"2026-10-19","leads":9}]');
  raise exception 'cross account metric accepted';
 exception when check_violation then null;
 end;
 if (select leads from public.metrics_daily where entity_id='50000000-0000-4000-8000-000000000001' and date='2026-10-19') <> 3 then raise exception 'failed write lost data'; end if;
 if has_function_privilege('authenticated','public.replace_account_metrics(uuid,date,date,jsonb)','execute') then raise exception 'client can replace metrics'; end if;
 if has_function_privilege('anon','public.replace_account_metrics(uuid,date,date,jsonb)','execute') then raise exception 'anonymous can replace metrics'; end if;
end $$;
select public.replace_account_metrics('40000000-0000-4000-8000-000000000001','2026-10-20','2026-10-20',
 '[{"entity_id":"50000000-0000-4000-8000-000000000001","date":"2026-10-20","spend":2.5,"impressions":20,"clicks":4,"leads":3}]');
do $$ begin
 if (select leads from public.metrics_daily where entity_id='50000000-0000-4000-8000-000000000001' and date='2026-10-20') <> 3 then raise exception 'replacement not persisted'; end if;
end $$;
select 'SYNC OK' as result;
rollback;
