begin;
insert into public.clients(id,name,slug) values ('20000000-0000-4000-8000-000000000001','Removal','removal');
insert into public.connections(id,platform,label,access_token) values
 ('30000000-0000-4000-8000-000000000001','meta','Old','fixture'),
 ('30000000-0000-4000-8000-000000000002','meta','New','fixture');
insert into public.ad_accounts(id,client_id,connection_id,platform,external_id,active) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','meta','1',false);
insert into public.entities(id,ad_account_id,platform,level,external_id,name) values
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','meta','campaign','1','History');
insert into public.metrics_daily(entity_id,date,spend) values ('50000000-0000-4000-8000-000000000001','2026-10-20',12);
do $$ begin
 if has_table_privilege('authenticated','public.connections','delete') or has_table_privilege('anon','public.connections','delete') then
  raise exception 'browser role can delete connections';
 end if;
end $$;
set local role service_role;
do $$ begin
 begin
  delete from public.connections where id='30000000-0000-4000-8000-000000000001';
  raise exception 'linked connection deleted';
 exception when foreign_key_violation then null;
 end;
 if (select spend from public.metrics_daily where entity_id='50000000-0000-4000-8000-000000000001') <> 12 then raise exception 'history lost'; end if;
end $$;
update public.ad_accounts set connection_id='30000000-0000-4000-8000-000000000002' where id='40000000-0000-4000-8000-000000000001';
delete from public.connections where id='30000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.connections where id='30000000-0000-4000-8000-000000000001') then raise exception 'unused connection retained'; end if;
 if not exists(select 1 from public.connections where id='30000000-0000-4000-8000-000000000002') then raise exception 'other connection deleted'; end if;
 if (select spend from public.metrics_daily where entity_id='50000000-0000-4000-8000-000000000001') <> 12 then raise exception 'history lost after removal'; end if;
end $$;
select 'REMOVAL OK' as result;
rollback;
