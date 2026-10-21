begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.clients(id,name,slug) values ('20000000-0000-4000-8000-000000000001','Edit A','edit-a');
insert into public.profiles(user_id,role,client_id,email) values
 ('10000000-0000-4000-8000-000000000001','admin',null,'admin@example.test'),
 ('10000000-0000-4000-8000-000000000002','client','20000000-0000-4000-8000-000000000001','client@example.test');
insert into public.connections(id,platform,label) values ('30000000-0000-4000-8000-000000000001','meta','Edit');
insert into public.ad_accounts(id,client_id,connection_id,platform,external_id) values ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','meta','1');
insert into public.entities(id,ad_account_id,platform,level,external_id,name) values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','meta','campaign','1','Edit campaign');
insert into public.campaign_changes(id,entity_id,actor_id,target,before_state,change,expires_at) values
 ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','{}','{"kind":"status","value":"PAUSED"}',now()+interval '10 minutes'),
 ('60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','{}','{"kind":"status","value":"PAUSED"}',now()+interval '10 minutes'),
 ('60000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{}','{}','{"kind":"status","value":"PAUSED"}',now()-interval '1 second');
do $$ begin
 if public.claim_campaign_change('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002') then raise exception 'Foreign actor claimed'; end if;
 if public.claim_campaign_change('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001') then raise exception 'Expired proposal claimed'; end if;
 if not public.claim_campaign_change('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001') then raise exception 'Valid claim failed'; end if;
 if public.claim_campaign_change('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001') then raise exception 'Replay accepted'; end if;
 if public.claim_campaign_change('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001') then raise exception 'Concurrent entity operation accepted'; end if;
 if has_function_privilege('authenticated','public.claim_campaign_change(uuid,uuid)','execute') or has_function_privilege('anon','public.claim_campaign_change(uuid,uuid)','execute') then raise exception 'Claim exposed'; end if;
 if has_table_privilege('authenticated','public.campaign_changes','UPDATE') then raise exception 'Client can mutate audit'; end if;
end $$;
update public.campaign_changes set status='unknown' where id='60000000-0000-4000-8000-000000000001';
do $$ begin
 if public.claim_campaign_change('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001') then raise exception 'Unknown outcome unlocked entity'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin if exists(select 1 from public.campaign_changes) then raise exception 'Client sees admin audit'; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin if (select count(*) from public.campaign_changes)<>3 then raise exception 'Admin audit missing'; end if; end $$;
reset role;
update public.campaign_changes set status='succeeded' where id='60000000-0000-4000-8000-000000000001';
do $$ begin
 if not public.claim_campaign_change('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001') then raise exception 'Completed operation not released'; end if;
end $$;
select 'MANAGEMENT OK' as result;
rollback;
