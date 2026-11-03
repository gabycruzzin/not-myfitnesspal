-- Adds the optional energy range from goal setup. Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- (supabase/schema.sql already includes this, so new projects don't need it.)
alter table public.profiles add column if not exists energy_range text check (energy_range in ('lower', 'middle', 'higher'));
