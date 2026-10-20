-- =========================================================
-- Bollettapp — Migrazione unità "Smc" per il gas
-- Da eseguire nel SQL Editor di Supabase se il database è già stato creato.
-- (Nelle installazioni nuove è già incluso in supabase-schema.sql)
--
-- Fa due cose:
--  1) permette il valore 'Smc' (standard metri cubi) come unità di consumo
--  2) converte da 'm3' a 'Smc' le categorie "Gas" e le relative bollette già inserite
-- Può essere rieseguito senza problemi.
-- =========================================================

-- 1) Vincoli sull'unità: li elimino qualunque sia il nome e li ricreo includendo 'Smc'
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.categories'::regclass, 'public.bills'::regclass)
      and pg_get_constraintdef(oid) ilike '%consumption_unit%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.categories add constraint categories_consumption_unit_check
  check (consumption_unit in ('kWh','m3','Smc','L','EUR','ore','pezzi','none'));

alter table public.bills add constraint bills_consumption_unit_check
  check (consumption_unit in ('kWh','m3','Smc','L','EUR','ore','pezzi','none'));

-- 2) Il gas in bolletta si legge in Smc: converto le categorie "Gas" e le loro bollette
update public.categories
   set consumption_unit = 'Smc'
 where lower(name) = 'gas' and consumption_unit = 'm3';

update public.bills
   set consumption_unit = 'Smc'
 where consumption_unit = 'm3'
   and category_id in (select id from public.categories where lower(name) = 'gas');
