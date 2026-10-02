-- Private bucket for course files (lab readings, field guides) that
-- used to live on Google Drive.
--
-- Fellows get NO storage policy on this bucket: they cannot list,
-- read or sign objects themselves. Every download goes through
-- app/api/files/[kind]/[id]/route.ts, which runs the same access
-- check as the page the file belongs to (lib/content-access.ts) and
-- then redirects to a 60-second signed URL minted with the service
-- role. Any future gate (release dates, sequential unlock) therefore
-- only needs to be added in lib/content-access.ts.
--
-- Additive and idempotent: safe to run more than once.

insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do update set public = false;

-- Storage key of the file inside the bucket. When set, the row's
-- `url` holds the in-app link /api/files/<kind>/<id>.
alter table public.labs
  add column if not exists file_path text;
alter table public.community_resources
  add column if not exists file_path text;

comment on column public.labs.file_path is
  'Object key in the private course-files bucket. Served through /api/files/labs/<id>; null for external links.';
comment on column public.community_resources.file_path is
  'Object key in the private course-files bucket. Served through /api/files/library/<id>; null for external links.';

-- Staff can manage objects (future admin upload UI). Deliberately no
-- policy for fellows or anon.
drop policy if exists "Staff manage course files"
  on storage.objects;
create policy "Staff manage course files"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'course-files'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'facilitator')
    )
  )
  with check (
    bucket_id = 'course-files'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'facilitator')
    )
  );

-- Verify: run after the migration. Every row should be scoped to a
-- single bucket_id. A select policy without a bucket_id condition
-- (e.g. one added by hand in the dashboard) would expose this bucket.
-- select policyname, cmd, roles, qual
-- from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
-- order by policyname;
