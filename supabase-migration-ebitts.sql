-- =========================================================
-- Bollettapp — Migrazione Ebitts / Token Box
-- Da eseguire nel SQL Editor di Supabase SOLO se hai già creato
-- il database con la versione precedente dello script.
-- (Nelle installazioni nuove è già incluso in supabase-schema.sql)
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
