-- Sequential module unlocking.
--
-- Within a phase, a module that is part of the sequence only opens for
-- a fellow once every earlier sequential module in that phase is
-- complete (all of its visible items done; a scheduled live session
-- counts once it has ended). Modules outside the sequence (surveys,
-- syllabus, one-off sessions) are always open and never block.
--
-- The rule itself lives in lib/module-locks.ts and is enforced by the
-- curriculum tree, the item page, the item actions and the
-- stored-file route. Admins and facilitators are never locked;
-- "Preview as fellow/cohort" is.
--
-- Additive and idempotent.

alter table public.modules
  add column if not exists is_sequential boolean not null default true;

comment on column public.modules.is_sequential is
  'Part of the phase''s unlock sequence. False = always open and never blocks later modules.';

-- Resource modules that sit between the labs/sessions: always open.
update public.modules set is_sequential = false
where id in (
  'b2e8be92-4984-426f-a12b-973d6f94229d', -- Pre-Program Survey
  '954c9a0a-355f-420c-9be4-046d77f14907', -- Listening Launch (was School Team Listening Session)
  '25dd43f1-68a8-4529-a739-5f72449d9748', -- Syllabus
  '44555aa9-149c-4150-aad2-48fb9c345e85', -- North Star School Team Discussion
  '57296daa-74fc-447f-932f-e0c91283cf03'  -- Wisdom Coaching: Pre-Program Survey
);
