-- =========================================================
-- Bollettapp — Script SQL per Supabase (SQL Editor)
-- Crea tabelle, indici, trigger, RLS e policy.
-- Eseguire per intero in un progetto Supabase vuoto.
-- =========================================================

-- Estensione per generare UUID
create extension if not exists "pgcrypto";

-- =========================================================
-- 1. TABELLE
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '🏷️',
  color text not null default '#3b82f6',
  consumption_unit text not null default 'none'
    check (consumption_unit in ('kWh','m3','Smc','L','EUR','ore','pezzi','none')),
  include_in_charts boolean not null default true,
  supplier_name text,
  contract_code text,
  contract_expiry date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  billing_start date not null,
  billing_end date not null,
  consumption_value numeric,
  consumption_unit text
    check (consumption_unit in ('kWh','m3','Smc','L','EUR','ore','pezzi','none')),
  amount numeric not null check (amount >= 0),
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_period_valid check (billing_end >= billing_start)
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  theme text not null default 'auto' check (theme in ('light','dark','auto')),
  layout_mode text not null default 'auto' check (layout_mode in ('auto','desktop','mobile')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  last_sync timestamptz,
  sync_status text not null default 'offline' check (sync_status in ('synced','syncing','error','offline')),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 2. INDICI
-- =========================================================

create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_categories_created_at on public.categories(created_at);
create index if not exists idx_categories_updated_at on public.categories(updated_at);

create index if not exists idx_bills_user_id on public.bills(user_id);
create index if not exists idx_bills_category_id on public.bills(category_id);
create index if not exists idx_bills_billing_start on public.bills(billing_start);
create index if not exists idx_bills_billing_end on public.bills(billing_end);
create index if not exists idx_bills_created_at on public.bills(created_at);
create index if not exists idx_bills_updated_at on public.bills(updated_at);

create index if not exists idx_settings_user_id on public.settings(user_id);
create index if not exists idx_sync_metadata_user_id on public.sync_metadata(user_id);

-- =========================================================
-- 3. TRIGGER updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_bills_updated_at on public.bills;
create trigger trg_bills_updated_at before update on public.bills
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_sync_metadata_updated_at on public.sync_metadata;
create trigger trg_sync_metadata_updated_at before update on public.sync_metadata
  for each row execute function public.set_updated_at();

-- =========================================================
-- 4. TRIGGER: crea automaticamente profilo + impostazioni
--    dopo la registrazione di un nuovo utente
-- =========================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, '')
  )
  on conflict (user_id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.sync_metadata (user_id, sync_status)
  values (new.id, 'offline')
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 5. ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.bills enable row level security;
alter table public.settings enable row level security;
alter table public.sync_metadata enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- ---------- categories ----------
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ---------- bills ----------
drop policy if exists "bills_select_own" on public.bills;
create policy "bills_select_own" on public.bills
  for select using (auth.uid() = user_id);

drop policy if exists "bills_insert_own" on public.bills;
create policy "bills_insert_own" on public.bills
  for insert with check (auth.uid() = user_id);

drop policy if exists "bills_update_own" on public.bills;
create policy "bills_update_own" on public.bills
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bills_delete_own" on public.bills;
create policy "bills_delete_own" on public.bills
  for delete using (auth.uid() = user_id);

-- ---------- settings ----------
drop policy if exists "settings_select_own" on public.settings;
create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);

drop policy if exists "settings_insert_own" on public.settings;
create policy "settings_insert_own" on public.settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "settings_update_own" on public.settings;
create policy "settings_update_own" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "settings_delete_own" on public.settings;
create policy "settings_delete_own" on public.settings
  for delete using (auth.uid() = user_id);

-- ---------- sync_metadata ----------
drop policy if exists "sync_metadata_select_own" on public.sync_metadata;
create policy "sync_metadata_select_own" on public.sync_metadata
  for select using (auth.uid() = user_id);

drop policy if exists "sync_metadata_insert_own" on public.sync_metadata;
create policy "sync_metadata_insert_own" on public.sync_metadata
  for insert with check (auth.uid() = user_id);

drop policy if exists "sync_metadata_update_own" on public.sync_metadata;
create policy "sync_metadata_update_own" on public.sync_metadata
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sync_metadata_delete_own" on public.sync_metadata;
create policy "sync_metadata_delete_own" on public.sync_metadata
  for delete using (auth.uid() = user_id);

-- =========================================================
-- 6. REALTIME (facoltativo ma consigliato per il multi-dispositivo)
-- =========================================================
alter publication supabase_realtime add table public.bills;
alter publication supabase_realtime add table public.categories;

-- =========================================================
-- 6b. EBITTS / TOKEN BOX
-- =========================================================

-- ---------------------------------------------------------
-- Ebitts / Token Box
-- ---------------------------------------------------------

create table if not exists public.token_boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Token Box',
  quantity integer not null default 1 check (quantity >= 1),
  total_cost numeric not null check (total_cost >= 0),
  start_date date not null,
  duration_years integer not null check (duration_years in (10, 15, 20)),
  prior_earnings numeric not null default 0 check (prior_earnings >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ebitts_earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  amount numeric not null,
  kwh numeric,
  description text,
  source text not null default 'manual' check (source in ('ai', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ebitts_period_valid check (period_end >= period_start)
);

create index if not exists idx_token_boxes_user_id on public.token_boxes(user_id);
create index if not exists idx_token_boxes_start_date on public.token_boxes(start_date);
create index if not exists idx_ebitts_earnings_user_id on public.ebitts_earnings(user_id);
create index if not exists idx_ebitts_earnings_period_end on public.ebitts_earnings(period_end);

-- trigger updated_at (la funzione set_updated_at esiste già nello schema principale)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_token_boxes_updated_at on public.token_boxes;
create trigger trg_token_boxes_updated_at before update on public.token_boxes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ebitts_earnings_updated_at on public.ebitts_earnings;
create trigger trg_ebitts_earnings_updated_at before update on public.ebitts_earnings
  for each row execute function public.set_updated_at();

-- RLS
alter table public.token_boxes enable row level security;
alter table public.ebitts_earnings enable row level security;

drop policy if exists "token_boxes_select_own" on public.token_boxes;
create policy "token_boxes_select_own" on public.token_boxes
  for select using (auth.uid() = user_id);

drop policy if exists "token_boxes_insert_own" on public.token_boxes;
create policy "token_boxes_insert_own" on public.token_boxes
  for insert with check (auth.uid() = user_id);

drop policy if exists "token_boxes_update_own" on public.token_boxes;
create policy "token_boxes_update_own" on public.token_boxes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "token_boxes_delete_own" on public.token_boxes;
create policy "token_boxes_delete_own" on public.token_boxes
  for delete using (auth.uid() = user_id);

drop policy if exists "ebitts_earnings_select_own" on public.ebitts_earnings;
create policy "ebitts_earnings_select_own" on public.ebitts_earnings
  for select using (auth.uid() = user_id);

drop policy if exists "ebitts_earnings_insert_own" on public.ebitts_earnings;
create policy "ebitts_earnings_insert_own" on public.ebitts_earnings
  for insert with check (auth.uid() = user_id);

drop policy if exists "ebitts_earnings_update_own" on public.ebitts_earnings;
create policy "ebitts_earnings_update_own" on public.ebitts_earnings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ebitts_earnings_delete_own" on public.ebitts_earnings;
create policy "ebitts_earnings_delete_own" on public.ebitts_earnings
  for delete using (auth.uid() = user_id);

-- =========================================================
-- 7. MIGRAZIONE (solo se il progetto Supabase era già stato
--    creato con una versione precedente dello script, senza
--    le colonne fornitore/contratto)
-- =========================================================
alter table public.categories add column if not exists supplier_name text;
alter table public.categories add column if not exists contract_code text;
alter table public.categories add column if not exists contract_expiry date;

-- =========================================================
-- FINE SCRIPT
-- =========================================================
