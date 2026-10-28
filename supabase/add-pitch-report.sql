-- Measured pitch/rhythm for follow-along exercises.
-- Run in the Supabase SQL Editor.

alter table public.recordings
  add column if not exists pitch_report jsonb;
