-- Opt-in: share recording audio with accepted friends only
alter table public.recordings
  add column if not exists share_audio_friends boolean not null default false;

comment on column public.recordings.share_audio is
  'When true, any authenticated user may play this recording (global leaderboard / public result).';

comment on column public.recordings.share_audio_friends is
  'When true, accepted friends may play this recording (friends leaderboard / friend result).';

-- Replace storage read policy: global share OR friends-only share
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
