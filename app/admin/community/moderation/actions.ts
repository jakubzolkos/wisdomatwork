'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertAdminArea } from '@/lib/admin-access-server'

/**
 * Set (or clear) the "Member of the Week" feature.
 *
 * To clear: pass `{ profileId: null, until: null }`. The action then
 * clears `featured_member_*` on whichever profile currently holds
 * the slot.
 *
 * To set: pass a profileId and a YYYY-MM-DD `until` date. We set
 * `featured_member_from = now()` and `featured_member_until` to the
 * end of that day so the schedule lasts the full final day.
 *
 * We don't enforce "only one MoW at a time" with a DB constraint -
 * instead this action clears any other profile's window when a new
 * one is set, to keep the UI simple and the data consistent.
 */
export async function setMemberOfWeek(input: {
  profileId: string | null
  /** YYYY-MM-DD; ignored when profileId is null. */
  until: string | null
}): Promise<{ ok: boolean; message?: string }> {
  await assertAdminArea('comms')
  const supabase = await createClient()

  // Always clear any existing schedule first so we don't leave a
  // second profile hanging in the active window.
  const { error: clearErr } = await supabase
    .from('profiles')
    .update({
      featured_member_from: null,
      featured_member_until: null,
    })
    .not('featured_member_until', 'is', null)
  if (clearErr) return { ok: false, message: clearErr.message }

  if (!input.profileId) {
    revalidatePath('/community')
    revalidatePath('/community/dashboard')
    revalidatePath('/community/bios')
    revalidatePath('/admin/community/moderation')
    return { ok: true }
  }

  if (!input.until || !/^\d{4}-\d{2}-\d{2}$/.test(input.until)) {
    return { ok: false, message: 'Pick an end date (YYYY-MM-DD).' }
  }

  // End-of-day so the feature lasts the whole final day.
  const untilDate = new Date(`${input.until}T23:59:59.999Z`)
  if (Number.isNaN(untilDate.getTime())) {
    return { ok: false, message: 'Invalid end date.' }
  }
  if (untilDate.getTime() <= Date.now()) {
    return {
      ok: false,
      message: 'End date must be in the future.',
    }
  }

  const { error: setErr } = await supabase
    .from('profiles')
    .update({
      featured_member_from: new Date().toISOString(),
      featured_member_until: untilDate.toISOString(),
    })
    .eq('id', input.profileId)
  if (setErr) return { ok: false, message: setErr.message }

  revalidatePath('/community')
  revalidatePath('/community/dashboard')
  revalidatePath('/community/bios')
  revalidatePath('/admin/community/moderation')
  return { ok: true }
}
