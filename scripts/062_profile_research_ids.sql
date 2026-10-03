-- Research participant IDs (the "Unique ID" fellows paste into the
-- Google Form surveys).
--
-- Kept out of public.profiles on purpose: profiles are readable by
-- teammates, but these IDs exist to keep survey responses
-- confidential, so only the fellow and staff may read one.
-- Writes go through the service role (scripts/load-2026-27-cohorts.ts),
-- so there are no insert/update policies.
--
-- Additive and idempotent.

create table if not exists public.profile_research_ids (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  research_id text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.profile_research_ids enable row level security;

drop policy if exists "research_ids_select_own_or_staff" on public.profile_research_ids;
create policy "research_ids_select_own_or_staff"
  on public.profile_research_ids
  for select to authenticated
  using (profile_id = auth.uid() or public.is_staff());
