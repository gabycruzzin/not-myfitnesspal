-- Adds the profiles table used by goal setup. Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- (supabase/schema.sql already includes this, so new projects don't need it.)

-- Setup answers and preferences, one row per user. No body measurements are stored.
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  setup_choice text check (setup_choice in ('log', 'goals')),  -- null until the welcome screen is answered
  reasons text[] not null default '{}',                         -- what brings them here, e.g. 'energy', 'strength'
  activity text check (activity in ('low', 'moderate', 'high')),
  targets_on boolean not null default false,                    -- false = just track, no goal bars
  goals_offer_dismissed boolean not null default false,         -- the one-time "want help setting goals?" offer
  typical_day jsonb,                                            -- foods they listed as a normal day, kept apart from the diary
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
