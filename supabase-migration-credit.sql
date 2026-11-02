-- =========================================================
-- Bollettapp — Migrazione bollette a credito
-- Da eseguire nel SQL Editor di Supabase se il database è già stato creato.
-- (Nelle installazioni nuove è già incluso in supabase-schema.sql)
--
-- Una bolletta a credito (rimborso al cliente) si registra con importo NEGATIVO.
-- Questo script toglie il vincolo che ammetteva solo importi >= 0.
-- Non modifica nessun dato esistente. Può essere rieseguito senza problemi.
-- =========================================================

do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where contype = 'c'
      and conrelid = 'public.bills'::regclass
      and pg_get_constraintdef(oid) ilike '%amount%'
  loop
    execute format('alter table public.bills drop constraint %I', r.conname);
  end loop;
end $$;
