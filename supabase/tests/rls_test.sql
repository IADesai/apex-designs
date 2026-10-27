-- Run in the Supabase SQL editor (as postgres). Everything is rolled back.
-- Success: the final notice "RLS OK" and no FAIL exception.
begin;

insert into public.leads (name, email, message) values ('Test Lead', 'lead@example.com', 'Hello there, testing');
insert into public.admins (email) values ('admin@example.com');

-- 1. anon: cannot read anything; can insert valid events only.
set local role anon;
do $$
begin
  begin perform * from public.leads; raise exception 'FAIL: anon can read leads'; exception when insufficient_privilege then null; end;
  begin perform * from public.events; raise exception 'FAIL: anon can read events'; exception when insufficient_privilege then null; end;
  begin perform * from public.visitors; raise exception 'FAIL: anon can read visitors'; exception when insufficient_privilege then null; end;
  begin perform * from public.links; raise exception 'FAIL: anon can read links'; exception when insufficient_privilege then null; end;
  begin perform * from public.admins; raise exception 'FAIL: anon can read admins'; exception when insufficient_privilege then null; end;
  begin perform * from public.link_stats; raise exception 'FAIL: anon can read link_stats'; exception when insufficient_privilege then null; end;
  begin
    insert into public.leads (name, email, message) values ('x', 'x@x.com', 'xxxxxxxxxxxx');
    raise exception 'FAIL: anon can insert leads';
  exception when insufficient_privilege then null; end;
  insert into public.events (type, path, ref) values ('ref_landing', '/', 'romford-traders');
  begin insert into public.events (type, path) values ('evil', '/'); raise exception 'FAIL: bad event type accepted'; exception when check_violation then null; end;
  begin insert into public.events (type, path, ref) values ('ref_landing', '/', '<script>'); raise exception 'FAIL: bad ref accepted'; exception when check_violation then null; end;
end $$;
reset role;

-- 2. signed-in non-admin sees nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"stranger@example.com","role":"authenticated"}', true);
do $$
begin
  if public.is_admin() then raise exception 'FAIL: stranger is admin'; end if;
  if (select count(*) from public.leads) <> 0 then raise exception 'FAIL: non-admin can read leads'; end if;
  if (select count(*) from public.events) <> 0 then raise exception 'FAIL: non-admin can read events'; end if;
end $$;
reset role;

-- 3. admin can read and update.
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"Admin@Example.com","role":"authenticated"}', true);
do $$
begin
  if not public.is_admin() then raise exception 'FAIL: admin not recognised (email case)'; end if;
  if (select count(*) from public.leads where email = 'lead@example.com') <> 1 then raise exception 'FAIL: admin cannot read leads'; end if;
  if (select count(*) from public.events where ref = 'romford-traders') < 1 then raise exception 'FAIL: admin cannot read events'; end if;
  update public.leads set status = 'warm' where email = 'lead@example.com';
  if (select status from public.leads where email = 'lead@example.com') <> 'warm' then raise exception 'FAIL: admin cannot update leads'; end if;
end $$;
reset role;

do $$ begin raise notice 'RLS OK'; end $$;
rollback;
