-- Per-recording vocal range + key estimate (free recordings + profile aggregate).
-- Run in the Supabase SQL Editor.

alter table public.recordings
  add column if not exists vocal_range jsonb;

comment on column public.recordings.vocal_range is
  'Measured/estimated range: lowest/highest notes, song_key, user_key, key_shift_semitones.';
