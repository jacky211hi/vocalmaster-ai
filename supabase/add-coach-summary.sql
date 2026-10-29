-- Rolling coach memory for personalized advice (AI-facing, not shown in UI)
alter table public.profiles
  add column if not exists coach_summary text;

alter table public.recordings
  add column if not exists coach_summary text;

comment on column public.profiles.coach_summary is
  'Rolling short coach memory for the next Gemini analysis. Not shown to users.';

comment on column public.recordings.coach_summary is
  'Coach memory snapshot written after this analysis (same text as profiles at that time).';
