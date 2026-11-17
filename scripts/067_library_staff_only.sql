-- 067_library_staff_only.sql
-- Staff Library: library resources visible only to Admins and Facilitators
-- (e.g. the Liaisons' meeting decks and handouts), never to Fellows.
--
-- RUN THIS BEFORE DEPLOYING THE CODE THAT READS `staff_only`: the Library
-- page selects the column and will error if it does not exist yet.
--
-- Safe to re-run. Existing rows default to false, so nothing changes for
-- the Recommended and My Resources tabs.

alter table public.community_resources
  add column if not exists staff_only boolean not null default false;

comment on column public.community_resources.staff_only is
  'Staff Library: true = visible only to admins and facilitators. Hidden from fellows regardless of cohorts / is_universal.';

-- Rollback (only if needed):
--   alter table public.community_resources drop column staff_only;
