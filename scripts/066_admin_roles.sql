-- Admin roles from the WaW Call for Proposals: Tech (full access),
-- Research, Operations, Communications, each seeing only what their
-- work requires (lib/admin-access.ts).
--
--   tech      everything, including maintenance and assigning admin roles
--   ops       onboarding (users, schools, teams) and content; views progress
--   research  progress, responses and data exports; views content
--   comms     messages, reminders and scheduling
--
-- Only meaningful when role = 'admin'. Every current admin becomes
-- 'tech' (today's access), so nothing changes until roles are assigned.
--
-- The 063 trigger is extended: only a tech admin can change anyone's
-- role or admin_role.
--
-- Additive and idempotent.

alter table public.profiles
  add column if not exists admin_role text
  check (admin_role in ('tech', 'ops', 'research', 'comms'));

comment on column public.profiles.admin_role is
  'Admin console permissions when role = admin (lib/admin-access.ts). Null on an admin means tech.';

update public.profiles set admin_role = 'tech' where role = 'admin' and admin_role is null;

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_admin_role text;
begin
  -- Service role and SQL editor: no end user behind the request.
  if auth.uid() is null then
    return new;
  end if;

  select p.role, coalesce(p.admin_role, 'tech')
    into caller_role, caller_admin_role
    from public.profiles p
   where p.id = auth.uid();

  -- Admins manage profiles (cohort, team, deactivation...), but only a
  -- tech admin hands out roles.
  if caller_role = 'admin' then
    if (new.role is distinct from old.role or new.admin_role is distinct from old.admin_role)
       and caller_admin_role <> 'tech' then
      raise exception 'Only a Tech admin can change roles'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.admin_role is distinct from old.admin_role
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
