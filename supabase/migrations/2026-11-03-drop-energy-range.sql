-- Removes the energy range question's column, which goal setup no longer uses.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run. Safe to run even if the column was never added.
alter table public.profiles drop column if exists energy_range;
