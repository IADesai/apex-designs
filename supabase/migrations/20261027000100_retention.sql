-- Enforces the retention periods stated in the privacy policy. Runs daily at 03:15 UTC.
-- (Equivalent to enabling Cron under Dashboard → Integrations.)
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule('apex-retention', '15 3 * * *', $$
  delete from public.events where created_at < now() - interval '13 months';
  delete from public.visitors v
    where v.first_seen < now() - interval '13 months'
      and not exists (select 1 from public.leads l where l.visitor_id = v.id);
  delete from public.leads where updated_at < now() - interval '24 months';
$$);
