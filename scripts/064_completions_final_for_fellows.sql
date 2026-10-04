-- Completion is final for fellows.
--
-- The app no longer offers "mark incomplete" to fellows, and the
-- completion action refuses it (lib/completion-gates.ts
-- canUnmarkComplete). This closes the API path too: 025 let every user
-- delete their own completion rows through PostgREST. Now only staff
-- (admin / facilitator) can delete their own rows, e.g. to clear test
-- ticks. Service-role code is unaffected (it bypasses RLS).
--
-- Additive and idempotent.

drop policy if exists "Users delete own completions" on public.user_content_completions;
drop policy if exists "Staff delete own completions" on public.user_content_completions;

create policy "Staff delete own completions"
  on public.user_content_completions for delete
  using (profile_id = auth.uid() and public.is_staff());
