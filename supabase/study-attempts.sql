-- One user's submitted study records, private to that authenticated user.
-- Run once in Supabase SQL Editor before enabling the website environment variables.

create table if not exists public.study_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  kind text not null,
  started_at timestamptz,
  finished_at timestamptz not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  score numeric,
  total integer check (total is null or total >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists study_attempts_user_finished_idx
  on public.study_attempts (user_id, finished_at desc);

alter table public.study_attempts enable row level security;
revoke all on table public.study_attempts from anon, authenticated;
grant select, insert on table public.study_attempts to authenticated;

drop policy if exists "Users read their own study attempts" on public.study_attempts;
create policy "Users read their own study attempts"
  on public.study_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users add their own study attempts" on public.study_attempts;
create policy "Users add their own study attempts"
  on public.study_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No UPDATE or DELETE grant/policy: submitted records remain append-only.
