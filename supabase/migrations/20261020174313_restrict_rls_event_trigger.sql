-- Hosted Supabase may install this event trigger with default public EXECUTE.
-- Its owner still runs it on DDL; application roles do not need direct access.
-- Local Postgres environments may not include the hosted helper.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
