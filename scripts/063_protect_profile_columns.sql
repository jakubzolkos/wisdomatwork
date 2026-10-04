-- Stop users from changing access-controlling columns on their own
-- profile.
--
-- The profiles update policy lets a user update their own row (so the
-- profile editor can save name / title / bio / links / avatar). It has
-- no column restriction, so with their own session and the public anon
-- key a fellow could PATCH their row through PostgREST and:
--   - make themselves an admin   ({role: 'admin', cohort: null})
--   - switch cohort              (see the other cohort's curriculum)
--   - clear their own deactivation, team, school or email
-- (Verified against production on 2026-10-03 with a temporary account.)
--
-- This trigger rejects changes to those columns unless the caller is an
-- admin or has no end-user JWT (service role / SQL editor), which is
-- how every admin action and script writes them. Everything the
-- profile editor saves is untouched.
--
-- Additive and idempotent.

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role and SQL editor: no end user behind the request.
  if auth.uid() is null then
    return new;
  end if;

  -- Admins manage every profile (role, cohort, team, deactivation...).
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.cohort is distinct from old.cohort
     or new.school_id is distinct from old.school_id
     or new.school_team_id is distinct from old.school_team_id
     or new.deactivated_at is distinct from old.deactivated_at
     or new.email is distinct from old.email
     or new.featured_member_from is distinct from old.featured_member_from
     or new.featured_member_until is distinct from old.featured_member_until
  then
    raise exception 'Only an admin can change role, cohort, team, school, email, featuring or deactivation on a profile'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
