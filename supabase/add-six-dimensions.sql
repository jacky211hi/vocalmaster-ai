-- Six vocal dimensions: rename mechanism → phonation; add rhythm + dynamics

-- 1) Rename mechanism_score → phonation_score (keep existing scores)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recordings'
      and column_name = 'mechanism_score'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recordings'
      and column_name = 'phonation_score'
  ) then
    alter table public.recordings rename column mechanism_score to phonation_score;
  end if;
end $$;

-- 2) Ensure phonation_score exists (fresh DBs / edge cases)
alter table public.recordings
  add column if not exists phonation_score integer not null default 0
    check (phonation_score between 0 and 100);

-- 3) New dimensions
alter table public.recordings
  add column if not exists rhythm_score integer not null default 0
    check (rhythm_score between 0 and 100);

alter table public.recordings
  add column if not exists dynamics_score integer not null default 0
    check (dynamics_score between 0 and 100);

-- 4) Drop legacy column if both somehow exist
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recordings'
      and column_name = 'mechanism_score'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recordings'
      and column_name = 'phonation_score'
  ) then
    update public.recordings
    set phonation_score = mechanism_score
    where phonation_score = 0 and mechanism_score > 0;
    alter table public.recordings drop column mechanism_score;
  end if;
end $$;
