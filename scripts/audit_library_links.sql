-- audit_library_links.sql
-- READ-ONLY. Lists Library resources whose link is probably broken or not
-- what a Fellow expects, with the reason, so someone can fix or delete each
-- one in Admin -> Library. Changes nothing.
--
-- Run in the Supabase SQL editor. Needs 067_library_staff_only.sql applied
-- (it reads staff_only); remove that column from the select if not.

select
  r.id,
  r.title,
  r.resource_type,
  case
    when r.staff_only then 'Staff Library'
    when r.is_universal then 'Recommended'
    else 'My Resources (' || coalesce(array_to_string(r.cohorts, ','), 'no cohort') || ')'
  end as shown_in,
  r.url,
  case
    -- Demo rows from the original seed scripts (034, 036): fake links.
    when r.url ~* '^https?://(www\.)?example\.(com|org|net)' then 'Placeholder link (example.com), from the demo seed'
    when coalesce(btrim(r.url), '') in ('', 'pending') then 'No link'
    -- An in-app file link with no file behind it.
    when r.url ~ '^(/api)?/files/library/' and r.file_path is null then 'Points at a stored file, but none is attached'
    -- A file is attached but the link does not go through the portal.
    when r.file_path is not null and r.url !~ '^(/api)?/files/library/' then 'File attached, but the link does not open it'
    -- Slides rather than a protocol (Ashleigh: "takes you to a slide").
    when r.url ~* 'docs\.google\.com/presentation' then 'Google Slides link: opens a slide deck, not a document'
    -- Needs a Google sign-in / sharing setting that fellows may not have.
    when r.url ~* '(drive|docs)\.google\.com' then 'Google Drive/Docs link: check that Fellows can open it'
    when r.url !~* '^(https?://|/)' then 'Link does not start with http(s):// or /'
  end as problem,
  r.created_at
from public.community_resources r
where
  r.url ~* '^https?://(www\.)?example\.(com|org|net)'
  or coalesce(btrim(r.url), '') in ('', 'pending')
  or (r.url ~ '^(/api)?/files/library/' and r.file_path is null)
  or (r.file_path is not null and r.url !~ '^(/api)?/files/library/')
  or r.url ~* 'docs\.google\.com/presentation'
  or r.url ~* '(drive|docs)\.google\.com'
  or r.url !~* '^(https?://|/)'
order by problem, r.title;

-- Also check by hand: a link can look fine here and still be dead
-- (a deleted page, a private Drive file). Open each remaining one once.
