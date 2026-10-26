-- Comments on recordings (run in Supabase SQL Editor)

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

alter table public.comments enable row level security;

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

-- Recording owners can also delete comments on their song
create policy "Owners can delete comments on own recordings"
  on public.comments for delete
  to authenticated
  using (
    exists (
      select 1 from public.recordings r
      where r.id = recording_id and r.user_id = auth.uid()
    )
  );
