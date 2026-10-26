-- Optional: store object path so we can delete audio when pruning top-10
alter table public.recordings
  add column if not exists storage_path text;
