-- VocalMaster AI — Supabase schema
-- Run this in the Supabase SQL Editor

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text not null unique,
  avatar_url text default 'mic',
  coach_summary text,
  created_at timestamptz not null default now()
);

-- Recordings
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  song_name text not null,
  artist text not null default '',
  audio_url text not null default '',
  storage_path text,
  share_audio boolean not null default false,
  share_audio_friends boolean not null default false,
  total_score integer not null default 0 check (total_score between 0 and 100),
  timbre_score integer not null default 0 check (timbre_score between 0 and 100),
  phonation_score integer not null default 0 check (phonation_score between 0 and 100),
  pitch_score integer not null default 0 check (pitch_score between 0 and 100),
  breath_score integer not null default 0 check (breath_score between 0 and 100),
  rhythm_score integer not null default 0 check (rhythm_score between 0 and 100),
  dynamics_score integer not null default 0 check (dynamics_score between 0 and 100),
  ai_feedback_md text not null default '',
  actionable_advice text not null default '',
  coach_summary text,
  pitch_report jsonb,
  vocal_range jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recordings_user_id_idx on public.recordings (user_id);
create index if not exists recordings_total_score_idx on public.recordings (total_score desc);
create index if not exists recordings_created_at_idx on public.recordings (created_at desc);

-- Friends (for future friends leaderboard)
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists friends_user_id_idx on public.friends (user_id);
create index if not exists friends_friend_id_idx on public.friends (friend_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privileges (required when creating tables via SQL Editor)
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.recordings to authenticated;
grant select, insert, update, delete on table public.friends to authenticated;
grant all on table public.profiles to service_role;
grant all on table public.recordings to service_role;
grant all on table public.friends to service_role;

-- Comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists comments_recording_id_idx on public.comments (recording_id);
create index if not exists comments_created_at_idx on public.comments (created_at desc);

grant select, insert, delete on table public.comments to authenticated;
grant all on table public.comments to service_role;

-- RLS
alter table public.profiles enable row level security;
alter table public.recordings enable row level security;
alter table public.friends enable row level security;
alter table public.comments enable row level security;

-- Profiles policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Recordings policies (all authenticated can read — needed for global leaderboard)
create policy "Authenticated users can view recordings"
  on public.recordings for select
  to authenticated
  using (true);

create policy "Users can insert own recordings"
  on public.recordings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own recordings"
  on public.recordings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own recordings"
  on public.recordings for delete
  to authenticated
  using (auth.uid() = user_id);

-- Friends policies
create policy "Users can view own friendships"
  on public.friends for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can send friend requests"
  on public.friends for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update friendships they are part of"
  on public.friends for update
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can delete own friendships"
  on public.friends for delete
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Comments policies
create policy "Authenticated users can view comments"
  on public.comments for select
  to authenticated
  using (true);

create policy "Users can insert own comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Owners can delete comments on own recordings"
  on public.comments for delete
  to authenticated
  using (
    exists (
      select 1 from public.recordings r
      where r.id = recording_id and r.user_id = auth.uid()
    )
  );

-- Storage bucket for audio (run after creating bucket "recordings" in dashboard)
-- In Supabase Dashboard > Storage: create a private bucket named "recordings"

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "Users can upload own audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read own audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated can read shared audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1
      from public.recordings r
      where r.storage_path = name
        and (
          r.share_audio = true
          or (
            r.share_audio_friends = true
            and exists (
              select 1
              from public.friends f
              where f.status = 'accepted'
                and (
                  (f.user_id = auth.uid() and f.friend_id = r.user_id)
                  or (f.friend_id = auth.uid() and f.user_id = r.user_id)
                )
            )
          )
        )
    )
  );

create policy "Users can delete own audio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow signed URL reads for analysis pipeline (service role bypasses RLS;
-- for client playback use createSignedUrl)
