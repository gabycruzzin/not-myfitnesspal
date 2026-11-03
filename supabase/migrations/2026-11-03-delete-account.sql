-- Lets a signed-in user permanently delete their own account (Apple requires this in-app).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- (supabase/schema.sql already includes this, so new projects don't need it.)
-- Deleting the auth user also deletes their diary entries, goals, custom servings and profile,
-- because every table references auth.users with "on delete cascade".
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
