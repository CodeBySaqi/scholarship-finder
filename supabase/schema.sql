-- Scholarship Finder — Supabase schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- The app keeps its document in one row. Supabase gives you Postgres, backups,
-- the table editor and the SQL editor on top of it; the API reaches it through
-- PostgREST with the service-role key, which stays on the server and never
-- reaches the browser.

create table if not exists public.app_state (
  key        text primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_state is
  'Application document for Scholarship Finder. One row, key = main.';

-- Row Level Security: on, and NO policy for anon/authenticated.
-- Only the service-role key (server side) can read or write. This is what stops
-- anyone with your project URL from reading or rewriting the data through the
-- public REST endpoint.
alter table public.app_state enable row level security;

revoke all on table public.app_state from anon, authenticated;

-- Keep updated_at honest even if a request forgets it.
create or replace function public.touch_app_state()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_app_state on public.app_state;
create trigger trg_touch_app_state
  before insert or update on public.app_state
  for each row execute function public.touch_app_state();

-- Handy after the first deploy: confirm the row and its size.
-- select key, updated_at, pg_size_pretty(pg_column_size(data)::bigint) as size from public.app_state;


-- =====================================================================
-- Optional next step: real tables instead of one document.
-- The document store is correct for one app instance and this data size.
-- When you outgrow it (several instances writing at once, reporting queries,
-- per-row permissions), move to these tables and swap server/lib/store.js.
-- =====================================================================
--
-- create table public.universities (
--   id text primary key, name text not null, city text, state text,
--   type text, is_public boolean default true, website_url text,
--   uni_assist_member boolean default false, notes text
-- );
--
-- create table public.listings (
--   id            text primary key,
--   kind          text not null check (kind in ('scholarship','program')),
--   status        text not null default 'draft' check (status in ('draft','verified','archived')),
--   title         text not null,
--   provider      text,
--   host_country  text,
--   university_id text references public.universities(id),
--   degree_levels text[] default '{}',
--   funding_type  text,
--   deadline      date,
--   opens_date    date,
--   is_annual     boolean default true,
--   min_cgpa      numeric(3,2),
--   min_ielts     numeric(2,1),
--   max_age       int,
--   tuition_per_semester int default 0,
--   source_url    text not null,
--   official_url  text,
--   apply_url     text,
--   last_verified date not null default current_date,
--   created_by    text not null,
--   verified_by   text,
--   drafted_by_ai boolean default false,
--   source_snapshot text,
--   evidence      jsonb default '{}'::jsonb,
--   open_error_reports int default 0,
--   updated_at    timestamptz not null default now()
-- );
-- create index on public.listings (kind, status, deadline);
-- create index on public.listings (last_verified);
--
-- create table public.profiles (
--   user_id uuid primary key references auth.users(id) on delete cascade,
--   data jsonb not null default '{}'::jsonb,   -- the wizard payload
--   completeness_pct int default 0,
--   updated_at timestamptz not null default now()
-- );
--
-- create table public.saved_items (
--   id text primary key,
--   user_id uuid not null references auth.users(id) on delete cascade,
--   listing_id text not null references public.listings(id) on delete cascade,
--   note text default '',
--   created_at timestamptz not null default now(),
--   unique (user_id, listing_id)
-- );
--
-- create table public.error_reports (
--   id text primary key,
--   listing_id text not null references public.listings(id) on delete cascade,
--   reason text not null, note text, user_id uuid references auth.users(id) on delete set null,
--   status text not null default 'open', created_at timestamptz not null default now()
-- );
--
-- create table public.audit_log (
--   id text primary key,
--   actor text not null, action text not null,
--   entity_type text, entity_id text, detail jsonb default '{}'::jsonb,
--   created_at timestamptz not null default now()
-- );
-- revoke update, delete on public.audit_log from anon, authenticated;  -- append-only
