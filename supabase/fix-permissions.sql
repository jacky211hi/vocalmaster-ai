-- Fix: permission denied for table recordings
-- Run this once in Supabase SQL Editor

-- 1) Table privileges for authenticated users
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.recordings to authenticated;
grant select, insert, update, delete on table public.friends to authenticated;

-- Also allow anon read of nothing sensitive; service_role full access (Supabase default pattern)
grant all on table public.profiles to service_role;
grant all on table public.recordings to service_role;
grant all on table public.friends to service_role;

-- 2) Ensure your logged-in user has a profiles row
-- (needed because recordings.user_id references profiles.id)
insert into public.profiles (id, email, username)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;
