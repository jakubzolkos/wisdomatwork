-- Stored files now open in the in-app viewer (/files/<kind>/<id>)
-- instead of redirecting straight to an expiring storage URL. The
-- viewer embeds /api/files/<kind>/<id>, which still does the access
-- check and signing. Rows written by 059 pointed at /api/files.

update public.labs
set url = substring(url from 5)
where url like '/api/files/%';

update public.community_resources
set url = substring(url from 5)
where url like '/api/files/%';
