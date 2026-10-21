begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001');
insert into public.clients(id,name,slug) values ('20000000-0000-4000-8000-000000000001','Reports A','reports-a'),('20000000-0000-4000-8000-000000000002','Reports B','reports-b');
insert into public.profiles(user_id,role,client_id,email) values ('10000000-0000-4000-8000-000000000001','client','20000000-0000-4000-8000-000000000001','reports@example.test');
insert into public.connections(id,platform,label) values ('30000000-0000-4000-8000-000000000001','meta','Reports');
insert into public.ad_accounts(id,client_id,connection_id,platform,external_id) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','meta','1'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','meta','2');
insert into public.entities(id,ad_account_id,platform,level,external_id,name,status,objective) values
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','meta','campaign','1','Active','ACTIVE','OUTCOME_LEADS'),
 ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','meta','campaign','2','Paused','PAUSED','OUTCOME_ENGAGEMENT'),
 ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002','meta','campaign','3','Other tenant','ACTIVE','OUTCOME_LEADS');
insert into public.metrics_daily(entity_id,date,spend,results) values
 ('50000000-0000-4000-8000-000000000001','2026-10-20',20,'[{"type":"actions:lead","value":2}]'),
 ('50000000-0000-4000-8000-000000000001','2026-10-19',30,'[{"type":"actions:lead","value":3}]'),
 ('50000000-0000-4000-8000-000000000002','2026-10-20',15,'[{"type":"actions:link_click","value":5}]'),
 ('50000000-0000-4000-8000-000000000003','2026-10-20',900,'[{"type":"actions:lead","value":90}]');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare r record; begin
 select * into r from public.report_entities('20000000-0000-4000-8000-000000000001','2026-10-19','2026-10-20','campaign',null,'active');
 if r.spend<>50 or r.results<>'[{"type":"actions:lead","value":5}]'::jsonb or not r.result_complete or r.objective<>'OUTCOME_LEADS' then raise exception 'Active aggregation incorrect'; end if;
 if (select count(*) from public.report_entities('20000000-0000-4000-8000-000000000001','2026-10-19','2026-10-20'))<>2 then raise exception 'All status lost rows'; end if;
 if (select sum(spend) from public.report_series('20000000-0000-4000-8000-000000000001','2026-10-19','2026-10-20','active'))<>50 then raise exception 'Chart does not match status'; end if;
 if (select sum(spend) from public.report_series('20000000-0000-4000-8000-000000000001','2026-10-19','2026-10-20','paused'))<>15 then raise exception 'Paused filter wrong'; end if;
 if (select jsonb_array_length(results) from public.report_series('20000000-0000-4000-8000-000000000001','2026-10-20','2026-10-20'))<>2 then raise exception 'Mixed results collapsed'; end if;
 if exists(select 1 from public.report_entities('20000000-0000-4000-8000-000000000002','2026-10-19','2026-10-20')) or exists(select 1 from public.report_series('20000000-0000-4000-8000-000000000002','2026-10-19','2026-10-20')) then raise exception 'Cross tenant reports exposed'; end if;
 if has_function_privilege('anon','public.report_entities(uuid,date,date,text,uuid,text,text)','execute') or has_function_privilege('anon','public.report_series(uuid,date,date,text,text)','execute') then raise exception 'Anonymous reports exposed'; end if;
end $$;
reset role;
insert into public.metrics_daily(entity_id,date,spend) values ('50000000-0000-4000-8000-000000000001','2026-10-18',7);
do $$ begin
 if (select result_complete from public.report_entities('20000000-0000-4000-8000-000000000001','2026-10-18','2026-10-20','campaign',null,'active')) then raise exception 'Missing result hidden'; end if;
 if (select result_complete from public.report_series('20000000-0000-4000-8000-000000000001','2026-10-18','2026-10-18','active')) then raise exception 'Missing daily result hidden'; end if;
 if (select results from public.report_entities('20000000-0000-4000-8000-000000000001','2020-01-01','2020-01-02','campaign',null,'active')) is not null then raise exception 'Missing history became zero'; end if;
end $$;
insert into public.connections(id,platform,label) values ('30000000-0000-4000-8000-000000000002','google','Google Reports');
insert into public.ad_accounts(id,client_id,connection_id,platform,external_id) values
 ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','google','3');
insert into public.entities(id,ad_account_id,platform,level,external_id,name,status,objective) values
 ('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000003','google','campaign','4','Google active','ENABLED','SEARCH'),
 ('50000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000003','google','campaign','5','Google paused','PAUSED','SEARCH');
insert into public.metrics_daily(entity_id,date,spend,results) values
 ('50000000-0000-4000-8000-000000000004','2026-10-20',100,'[{"type":"google:conversions","value":8}]'),
 ('50000000-0000-4000-8000-000000000004','2026-10-19',80,'[{"type":"google:conversions","value":4}]'),
 ('50000000-0000-4000-8000-000000000005','2026-10-20',10,'[{"type":"google:conversions","value":1}]');
set local role authenticated;
do $$ declare r record; begin
 select * into r from public.report_entities('20000000-0000-4000-8000-000000000001','2026-10-19','2026-10-20','campaign',null,'active','google');
 if r.platform<>'google' or r.spend<>180 or r.results<>'[{"type":"google:conversions","value":12}]'::jsonb then raise exception 'Google entity filter incorrect'; end if;
 if (select sum(spend) from public.report_series('20000000-0000-4000-8000-000000000001','2026-10-19','2026-10-20','all','meta'))<>65 then raise exception 'Meta series mixed with Google'; end if;
 if (select sum(spend) from public.report_series('20000000-0000-4000-8000-000000000001','2026-10-19','2026-10-20','paused','google'))<>10 then raise exception 'Platform and status mismatch'; end if;
 if (select sum(spend) from public.report_series('20000000-0000-4000-8000-000000000001','2026-10-19','2026-10-20'))<>255 then raise exception 'Combined total incorrect'; end if;
 if exists(select 1 from public.report_series('20000000-0000-4000-8000-000000000002','2026-10-19','2026-10-20','all','meta')) or exists(select 1 from public.report_entities('20000000-0000-4000-8000-000000000002','2026-10-19','2026-10-20','campaign',null,'all','meta')) then raise exception 'Platform filter bypasses tenant isolation'; end if;
 if exists(select 1 from public.report_series('20000000-0000-4000-8000-000000000001','2020-01-01','2020-01-02','all','google')) then raise exception 'Empty window has data'; end if;
end $$;
select 'REPORTING OK' as result;
rollback;
