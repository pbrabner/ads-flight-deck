begin;
insert into auth.users (id) values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');
insert into public.clients(id,name,slug) values
 ('20000000-0000-4000-8000-000000000001','Cliente A','test-a'),
 ('20000000-0000-4000-8000-000000000002','Cliente B','test-b');
insert into public.profiles(user_id,role,client_id,email) values
 ('10000000-0000-4000-8000-000000000001','client','20000000-0000-4000-8000-000000000001','a@test.local'),
 ('10000000-0000-4000-8000-000000000002','client','20000000-0000-4000-8000-000000000002','b@test.local'),
 ('10000000-0000-4000-8000-000000000003','admin',null,'admin@test.local');
insert into public.connections(id,platform,label,access_token) values ('30000000-0000-4000-8000-000000000001','meta','Agência','test-secret');
insert into public.ad_accounts(id,client_id,connection_id,platform,external_id) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','meta','111'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','meta','222');
insert into public.entities(id,ad_account_id,platform,level,external_id,name) values
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','meta','campaign','repeated','Campanha A'),
 ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','meta','campaign','repeated','Campanha B');
insert into public.metrics_daily(entity_id,date,spend,impressions,clicks,leads) values
 ('50000000-0000-4000-8000-000000000001','2026-10-20',100,1000,10,2),
 ('50000000-0000-4000-8000-000000000002','2026-10-20',900,10000,100,20);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.clients) <> 1 then raise exception 'clients isolation'; end if;
 if (select count(*) from public.profiles) <> 1 then raise exception 'profiles isolation'; end if;
 if (select count(*) from public.entities) <> 1 then raise exception 'entities isolation'; end if;
 if (select count(*) from public.metrics_daily) <> 1 then raise exception 'metrics isolation'; end if;
 if (select count(*) from public.connections_public) <> 0 then raise exception 'connections isolation'; end if;
 if (select count(*) from public.sync_runs) <> 0 then raise exception 'sync isolation'; end if;
 if (select count(*) from public.metrics_by_period('20000000-0000-4000-8000-000000000002','2026-10-01','2026-10-31','campaign',null)) <> 0 then raise exception 'RPC isolation'; end if;
 begin
   perform access_token from public.connections;
   raise exception 'secret exposed';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.profiles set role='admin' where user_id=auth.uid();
   raise exception 'role editable';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (select count(*) from public.clients) <> 2 then raise exception 'admin clients'; end if;
 if (select count(*) from public.connections_public) <> 1 then raise exception 'admin connection metadata'; end if;
 begin
   perform access_token from public.connections;
   raise exception 'admin secret exposed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
insert into public.entities(id,ad_account_id,platform,level,external_id,parent_id,name) values
 ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','meta','adset','set','50000000-0000-4000-8000-000000000001','Conjunto A'),
 ('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','meta','ad','ad','50000000-0000-4000-8000-000000000003','Anúncio A');
insert into public.metrics_daily(entity_id,date,spend,impressions,clicks,leads) values
 ('50000000-0000-4000-8000-000000000003','2026-10-20',100,1000,10,2),
 ('50000000-0000-4000-8000-000000000004','2026-10-20',100,1000,10,2);
do $$ begin
 if (select sum(spend) from public.metrics_timeseries('20000000-0000-4000-8000-000000000001','2026-10-20','2026-10-20')) <> 100 then raise exception 'totals counted child levels'; end if;
end $$;
select 'RLS OK' as result;
rollback;
