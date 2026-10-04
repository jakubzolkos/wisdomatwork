-- Release modules by date instead of by completion.
--
-- The program runs on its live-session calendar, so a module now opens
-- for fellows at `opens_at` (typically right after the previous
-- session ends) rather than when they have completed everything
-- before it. Completion still drives progress and reminders; it no
-- longer blocks access, so missing one item can't stall a fellow.
--
-- `is_sequential` (061) stays as an opt-in per module but is switched
-- off everywhere and defaults to off.
--
-- Run before deploying the code that reads `opens_at`. The dates are
-- set by scripts/load-2026-27-cohorts.ts and editable per module in
-- Admin -> Curriculum. Additive and idempotent.

alter table public.modules
  add column if not exists opens_at timestamptz;

comment on column public.modules.opens_at is
  'When the module opens for fellows. NULL = open now. Staff always see it.';

alter table public.modules
  alter column is_sequential set default false;

update public.modules set is_sequential = false where is_sequential;
