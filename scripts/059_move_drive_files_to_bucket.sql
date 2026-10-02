-- Point lab readings and field guides at the copies in the private
-- course-files bucket instead of Google Drive. Requires 058.
--
-- The files were uploaded with the service role; each row gets the
-- storage key in `file_path` and the gatekeeper route in `url`
-- (see lib/stored-files.ts). Runs in one transaction.
--
-- Left on Google:
--   - Lab Two "Reflection on Practice" is a Google Form, not a file.
--   - "Reflective Listening Protocol" until the correct file is
--     available (its Drive link opens "PWF in Summary" instead).

begin;

update public.labs set
  file_path = 'labs/wisdom-lab-one/bohlin-pwf-journal-of-education.pdf',
  url = '/api/files/labs/4e79be69-c1a7-462c-8774-0e737414561c'
where id = '4e79be69-c1a7-462c-8774-0e737414561c';

update public.labs set
  file_path = 'labs/wisdom-lab-two/tigner-cardinal-virtues.pdf',
  url = '/api/files/labs/0c7188d6-84fd-43a3-b195-9d42b2e3b7be'
where id = '0c7188d6-84fd-43a3-b195-9d42b2e3b7be';

-- Lab Three linked a Drive folder of four readings (and the URL was
-- broken: folder link + file link run together). One item per
-- reading, titled after the reading since the title is the button
-- label. The existing item keeps its id, so progress is preserved.
update public.labs set
  title = 'Wisdom Lab Prep: An Argument Worth Rehearsing',
  file_path = 'labs/wisdom-lab-three/an-argument-worth-rehearsing.pdf',
  url = '/api/files/labs/7f7ba7b0-1ebd-4bac-8ed9-c8395d2202f2'
where id = '7f7ba7b0-1ebd-4bac-8ed9-c8395d2202f2';

insert into public.labs
  (id, year_id, module_id, category, resource_type, title, url, file_path, order_index, reflection_enabled)
values
  ('2bf01a35-8906-4cf0-807a-2f846570c5bf', '0ad17b17-2497-4e20-8b75-bfd03a30ec7a', 'ec33ed34-a488-42ac-88ef-15712f2da5d8',
   'before_lab', 'reading', 'Wisdom Lab Prep: Building Character',
   '/api/files/labs/2bf01a35-8906-4cf0-807a-2f846570c5bf',
   'labs/wisdom-lab-three/ryan-bohlin-building-character.pdf', 3, false),
  ('31a6ada7-bbbf-40a2-a97e-296d267f21e2', '0ad17b17-2497-4e20-8b75-bfd03a30ec7a', 'ec33ed34-a488-42ac-88ef-15712f2da5d8',
   'before_lab', 'reading', 'Wisdom Lab Prep: How to Help Students Be the Best Version of Themselves',
   '/api/files/labs/31a6ada7-bbbf-40a2-a97e-296d267f21e2',
   'labs/wisdom-lab-three/how-to-help-students-be-the-best-version-of-themselves.pdf', 4, false),
  ('625be091-af93-4458-a9db-1b40f8faebdd', '0ad17b17-2497-4e20-8b75-bfd03a30ec7a', 'ec33ed34-a488-42ac-88ef-15712f2da5d8',
   'before_lab', 'reading', 'Wisdom Lab Prep: Stress Tests',
   '/api/files/labs/625be091-af93-4458-a9db-1b40f8faebdd',
   'labs/wisdom-lab-three/stress-tests.pdf', 5, false)
on conflict (id) do nothing;

update public.labs set
  file_path = 'labs/wisdom-lab-four/palmer-the-student-from-hell.pdf',
  url = '/api/files/labs/10405c09-f8f0-407c-bf8c-f72e73343ca2'
where id = '10405c09-f8f0-407c-bf8c-f72e73343ca2';

update public.labs set
  file_path = 'labs/wisdom-lab-five/courageous-dialogue-toolkit-2021.pdf',
  url = '/api/files/labs/063f9bba-e04d-481e-9c4a-885b08ed0d0a'
where id = '063f9bba-e04d-481e-9c4a-885b08ed0d0a';

update public.community_resources set
  file_path = 'library/waw-lab-one-toolkit-2025-2026.pdf',
  url = '/api/files/library/78f769f4-b50e-45a2-95f5-6edaf7ffe0d0'
where id = '78f769f4-b50e-45a2-95f5-6edaf7ffe0d0';

-- Also fixes the broken URL (Drive link + placeholder URL run together).
update public.community_resources set
  file_path = 'library/waw-lab-two-toolkit-2025-2026.pdf',
  url = '/api/files/library/3a24264a-429d-44b0-b16e-f3c28ab74496'
where id = '3a24264a-429d-44b0-b16e-f3c28ab74496';

-- Its Drive file was trashed and no community post references it.
delete from public.community_resources
where id = 'a93eb33c-21ec-4a9d-822a-55a9ccd6066f';

commit;

-- Check: only the Google Form and the Reflective Listening Protocol
-- should still point at Google.
-- select 'labs' as t, id, title, url from public.labs
--   where url ~ '(drive|docs)\.google\.com'
-- union all
-- select 'library', id::text, title, url from public.community_resources
--   where url ~ '(drive|docs)\.google\.com';
