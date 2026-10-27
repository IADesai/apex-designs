-- Apex Designs mini-CRM: schema, row level security, dashboard view.
create extension if not exists pgcrypto;

create table public.links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  label text not null check (char_length(label) between 1 and 120),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'instagram', 'facebook', 'email', 'print', 'other')),
  destination text not null default '/' check (destination ~ '^/[^\s]*$' and char_length(destination) <= 200),
  created_at timestamptz not null default now()
);

create table public.visitors (
  id uuid primary key,
  first_seen timestamptz not null default now(),
  first_ref text check (first_ref is null or first_ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  first_utm jsonb check (first_utm is null or pg_column_size(first_utm) <= 1024),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400)
);

create table public.events (
  id bigint generated always as identity primary key,
  visitor_id uuid,
  session_id uuid,
  type text not null check (type in ('page_view', 'ref_landing', 'cta_click', 'whatsapp_click', 'scroll_depth', 'form_start', 'form_submit')),
  path text not null check (char_length(path) between 1 and 300),
  ref text check (ref is null or ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  props jsonb check (props is null or pg_column_size(props) <= 2048),
  created_at timestamptz not null default now()
);
create index events_visitor_idx on public.events (visitor_id, created_at);
create index events_ref_idx on public.events (ref) where ref is not null;
create index events_created_idx on public.events (created_at);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (phone is null or char_length(phone) <= 30),
  business text check (business is null or char_length(business) <= 120),
  package text check (package is null or package in ('standard', 'premium', 'custom', 'unsure')),
  message text not null check (char_length(message) between 1 and 2000),
  ref text check (ref is null or ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  first_ref text check (first_ref is null or first_ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  status text not null default 'new' check (status in ('new', 'warm', 'quoted', 'won', 'lost')),
  notes text check (notes is null or char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_created_idx on public.leads (created_at desc);

create table public.admins (
  email text primary key check (email = lower(email))
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.links enable row level security;
alter table public.visitors enable row level security;
alter table public.events enable row level security;
alter table public.leads enable row level security;
alter table public.admins enable row level security;

-- Public site (anon): insert-only on events and visitors. Nothing else, ever.
revoke all on public.links, public.visitors, public.events, public.leads, public.admins from anon;
grant insert on public.events, public.visitors to anon;
create policy events_anon_insert on public.events for insert to anon with check (true);
create policy visitors_anon_insert on public.visitors for insert to anon with check (true);

-- Signed-in users: full access only if their email is in admins.
grant select, insert, update, delete on public.links, public.visitors, public.events, public.leads to authenticated;
grant select on public.admins to authenticated;
create policy links_admin on public.links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy visitors_admin on public.visitors for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy events_admin on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy leads_admin on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admins_admin_read on public.admins for select to authenticated using (public.is_admin());

-- Dashboard view; security_invoker makes the caller's RLS apply.
create view public.link_stats with (security_invoker = true) as
select
  l.id, l.slug, l.label, l.channel, l.destination, l.created_at,
  coalesce(e.landings, 0)::int as landings,
  coalesce(e.visitors, 0)::int as visitors,
  coalesce(ld.leads, 0)::int as leads
from public.links l
left join (
  select ref, count(*) as landings, count(distinct visitor_id) as visitors
  from public.events where type = 'ref_landing' group by ref
) e on e.ref = l.slug
left join (
  select coalesce(first_ref, ref) as r, count(*) as leads
  from public.leads group by 1
) ld on ld.r = l.slug;

revoke all on public.link_stats from anon;
grant select on public.link_stats to authenticated;
