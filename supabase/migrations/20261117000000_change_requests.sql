-- Client change requests: each client gets a private portal link, describes a change to the chat
-- assistant, and we approve it in the dashboard before any work starts.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  business text not null check (char_length(business) between 1 and 120),
  email text check (email is null or char_length(email) between 3 and 200),
  site_url text check (site_url is null or (site_url ~ '^https?://[^\s]+$' and char_length(site_url) <= 200)),
  -- Private notes for whoever actions the work: repo, stack, hosting, brand rules. Goes into the generated prompt.
  context text check (context is null or char_length(context) <= 2000),
  -- The secret in the client's portal link. 64 hex characters from two random UUIDs.
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('text', 'image', 'new', 'fix', 'design', 'other')),
  page text check (page is null or char_length(page) <= 200),
  details text not null check (char_length(details) between 10 and 4000),
  urgency text not null default 'normal' check (urgency in ('urgent', 'normal', 'whenever')),
  transcript jsonb check (transcript is null or pg_column_size(transcript) <= 16384),
  status text not null default 'new' check (status in ('new', 'approved', 'in_progress', 'done', 'declined')),
  reply text check (reply is null or char_length(reply) <= 1000),   -- shown to the client in their portal
  notes text check (notes is null or char_length(notes) <= 5000),   -- private
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index change_requests_client_idx on public.change_requests (client_id, created_at desc);
create index change_requests_created_idx on public.change_requests (created_at desc);

create trigger change_requests_touch before update on public.change_requests
  for each row execute function public.touch_updated_at();

alter table public.clients enable row level security;
alter table public.change_requests enable row level security;

-- The public site never touches these tables directly: the portal goes through the client-portal
-- Edge Function, which checks the token and uses the service role.
revoke all on public.clients, public.change_requests from anon;
grant select, insert, update, delete on public.clients, public.change_requests to authenticated;
create policy clients_admin on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy change_requests_admin on public.change_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Retention: same job as before, plus finished change requests (see the privacy policy).
select cron.schedule('apex-retention', '15 3 * * *', $$
  delete from public.events where created_at < now() - interval '13 months';
  delete from public.visitors v
    where v.first_seen < now() - interval '13 months'
      and not exists (select 1 from public.leads l where l.visitor_id = v.id);
  delete from public.leads where updated_at < now() - interval '24 months';
  delete from public.change_requests where updated_at < now() - interval '24 months';
$$);
