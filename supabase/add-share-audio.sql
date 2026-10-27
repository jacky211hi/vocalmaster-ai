-- Opt-in: share recording audio on global leaderboard / public result views
alter table public.recordings
  add column if not exists share_audio boolean not null default false;

comment on column public.recordings.share_audio is
  'When true, other authenticated users may play this recording audio on result/leaderboard.';

-- Allow authenticated users to read storage objects that are marked shared
drop policy if exists "Authenticated can read shared audio" on storage.objects;
create policy "Authenticated can read shared audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1
      from public.recordings r
      where r.storage_path = name
        and r.share_audio = true
    )
  );
