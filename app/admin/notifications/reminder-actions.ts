'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchCurriculumRows } from '@/lib/curriculum-tree'
import { planProgramReminders, type PlannedReminder } from '@/lib/notifications/program-reminders'
import { getSiteOrigin } from '@/lib/site'

/**
 * Program reminders not created yet. A reminder that exists in any
 * state counts as made, so one staff cancelled is never recreated.
 */
export async function pendingProgramReminders(): Promise<PlannedReminder[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const [rows, { data: existing, error }] = await Promise.all([
    fetchCurriculumRows(admin),
    admin.from('notifications').select('content_id, module_id').eq('kind', 'reminder'),
  ])
  if (error) throw new Error(error.message)
  const made = new Set(
    (existing ?? []).flatMap((n) => [n.content_id && `c:${n.content_id}`, n.module_id && `m:${n.module_id}`]),
  )
  return planProgramReminders(rows).filter(
    (r) => !made.has(r.key.content_id ? `c:${r.key.content_id}` : `m:${r.key.module_id}`),
  )
}

export type ScheduleRemindersResult = { ok: true; created: number } | { ok: false; message: string }

/**
 * Saves the pending reminders as scheduled notifications (email on).
 * The notifications cron sends each at its time; until then staff can
 * edit or cancel it in Admin -> Notifications.
 */
export async function scheduleProgramReminders(): Promise<ScheduleRemindersResult> {
  try {
    const me = await requireAdmin()
    const pending = await pendingProgramReminders()
    if (pending.length === 0) return { ok: true, created: 0 }

    // Emails need full links.
    const origin = await getSiteOrigin()
    if (!origin) return { ok: false, message: 'The site address (NEXT_PUBLIC_SITE_URL) is not set.' }

    const { error } = await createAdminClient()
      .from('notifications')
      .insert(
        pending.map((r) => ({
          author_id: me.id,
          kind: 'reminder',
          status: 'scheduled',
          title: r.title,
          body: r.body,
          pinned: false,
          cta_label: r.ctaLabel,
          cta_url: `${origin}${r.ctaPath}`,
          email_enabled: true,
          email_subject: null,
          scheduled_for: r.sendAt,
          content_id: r.key.content_id,
          module_id: r.key.module_id,
          audience_scope: 'cohort',
          cohort_codes: r.cohorts,
          school_team_ids: null,
          user_ids: null,
          year_id: null,
          cohort_id: null,
        })),
      )
    if (error) return { ok: false, message: error.message }

    revalidatePath('/admin/notifications')
    return { ok: true, created: pending.length }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not schedule reminders' }
  }
}
