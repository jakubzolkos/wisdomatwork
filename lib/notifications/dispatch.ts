import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email/send'
import { isEmailConfigured, type EmailAttachment } from '@/lib/email/client'
import { buildSessionIcs } from '@/lib/email/ics'
import { siteUrl } from '@/lib/site'
import { describeAudience, resolveRecipients } from './audience'
import type {
  NotificationKind,
  NotificationRow,
  NotificationStatus,
} from './types'

interface RecipientUpsertRow {
  notification_id: string
  profile_id: string
  email: string | null
  email_status: 'pending' | 'skipped'
}

interface RecipientToSend {
  recipient_row_id: string
  profile_id: string
  email: string
  full_name: string | null
}

/**
 * For a session reminder (the notification points at a scheduled live
 * session), build the calendar invite to attach so a Fellow can add the
 * session, with its Zoom link, to their calendar. Null for anything else,
 * and on any lookup problem: the email still goes out without it.
 */
async function sessionInviteFor(
  supabase: SupabaseClient,
  contentId: string | null,
): Promise<EmailAttachment | null> {
  if (!contentId) return null
  try {
    const { data: item } = await supabase
      .from('labs')
      .select('id, module_id, url, resource_type, scheduled_at, duration_minutes')
      .eq('id', contentId)
      .maybeSingle<{
        id: string
        module_id: string | null
        url: string | null
        resource_type: string | null
        scheduled_at: string | null
        duration_minutes: number | null
      }>()
    if (!item || item.resource_type !== 'live_session' || !item.scheduled_at) return null
    const start = new Date(item.scheduled_at)
    if (Number.isNaN(start.getTime())) return null

    let moduleTitle = 'Wisdom at Work session'
    if (item.module_id) {
      const { data: module } = await supabase
        .from('modules')
        .select('title')
        .eq('id', item.module_id)
        .maybeSingle<{ title: string }>()
      if (module?.title) moduleTitle = module.title.split(': ')[0]
    }

    const content = buildSessionIcs({
      uid: item.id,
      title: `${moduleTitle} (Wisdom at Work)`,
      start,
      minutes: item.duration_minutes ?? 60,
      url: item.url && /^https?:\/\//.test(item.url) ? item.url : null,
    })
    return { filename: 'session.ics', content, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }
  } catch {
    return null
  }
}

export interface DispatchResult {
  ok: boolean
  notificationId: string
  recipientsResolved: number
  emailsSent: number
  emailsFailed: number
  emailsSkipped: number
  status: NotificationStatus
  error?: string
}

/**
 * Atomically transition a notification's status. Returns true if the
 * row was actually updated (i.e. nobody else has it). Used to claim
 * a row before doing dispatch work so the cron and a manual click
 * cannot race.
 */
async function claimStatus(
  supabase: SupabaseClient,
  notificationId: string,
  fromStatuses: NotificationStatus[],
  toStatus: NotificationStatus,
): Promise<NotificationRow | null> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ status: toStatus, updated_at: new Date().toISOString() })
    .eq('id', notificationId)
    .in('status', fromStatuses)
    .select('*')
    .maybeSingle<NotificationRow>()
  if (error) throw error
  return data ?? null
}

/**
 * Sets the final status on a notification and persists sent_at if it
 * is being marked sent for the first time.
 */
async function finalizeStatus(
  supabase: SupabaseClient,
  notificationId: string,
  status: NotificationStatus,
  hadFailures: boolean,
) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (status === 'sent') {
    patch.status = hadFailures ? 'sent' : 'sent'
    patch.sent_at = new Date().toISOString()
  } else {
    patch.status = status
  }
  await supabase.from('notifications').update(patch).eq('id', notificationId)
}

/**
 * Dispatch a notification: resolve its audience, persist
 * notification_recipients rows, and (if email_enabled) send a per-user
 * email through Resend, recording the provider id / error inline.
 *
 * Idempotent: safe to call again on the same notification. Existing
 * recipient rows are upserted on (notification_id, profile_id), and
 * we only send mail to recipients whose email_status is still
 * 'pending'.
 *
 * The caller is responsible for choosing which states are claimable.
 * - "Send now" path: pass allowedFromStatuses = ['draft', 'sending']
 * - Cron path: pass allowedFromStatuses = ['scheduled']
 */
export async function dispatchNotification(
  notificationId: string,
  options: {
    /** Statuses we're allowed to claim. Default: ['scheduled', 'draft', 'sending']. */
    allowedFromStatuses?: NotificationStatus[]
    /**
     * Allow turning email off entirely (e.g. test runs). Defaults to
     * the notification's own email_enabled flag.
     */
    forceSkipEmail?: boolean
  } = {},
): Promise<DispatchResult> {
  const supabase = createAdminClient()
  const allowed = options.allowedFromStatuses ?? [
    'scheduled',
    'draft',
    'sending',
  ]

  // Claim the row.
  const notification = await claimStatus(
    supabase,
    notificationId,
    allowed,
    'sending',
  )
  if (!notification) {
    return {
      ok: false,
      notificationId,
      recipientsResolved: 0,
      emailsSent: 0,
      emailsFailed: 0,
      emailsSkipped: 0,
      status: 'sending',
      error:
        'Notification could not be claimed for dispatch (already sent, cancelled, or in flight).',
    }
  }

  try {
    const recipients = await resolveRecipients(supabase, notification)

    // Persist (or upsert) recipient rows. We use upsert so calling
    // dispatch again does not duplicate. email_status defaults to
    // 'pending' for first-time inserts; existing rows are left alone.
    if (recipients.length > 0) {
      const upsertRows: RecipientUpsertRow[] = recipients.map((r) => ({
        notification_id: notification.id,
        profile_id: r.id,
        email: r.email,
        email_status:
          notification.email_enabled === true && r.email ? 'pending' : 'skipped',
      }))

      const { error: upsertErr } = await supabase
        .from('notification_recipients')
        .upsert(upsertRows, {
          onConflict: 'notification_id,profile_id',
          ignoreDuplicates: true,
        })
      if (upsertErr) throw upsertErr
    }

    let emailsSent = 0
    let emailsFailed = 0
    let emailsSkipped = 0

    const wantEmail =
      notification.email_enabled && !options.forceSkipEmail && isEmailConfigured()

    if (wantEmail && recipients.length > 0) {
      // Pull the recipient rows that still need a send. We only want
      // pending rows (skipped / sent / failed are left for retries).
      const { data: pendingRows, error: pendingErr } = await supabase
        .from('notification_recipients')
        .select('id, profile_id, email')
        .eq('notification_id', notification.id)
        .eq('email_status', 'pending')

      if (pendingErr) throw pendingErr

      // Build a lookup of profile -> name from the resolved set.
      const nameByProfile = new Map(
        recipients.map((r) => [r.id, r.full_name] as const),
      )

      const toSend: RecipientToSend[] = (pendingRows ?? [])
        .filter((row) => typeof row.email === 'string' && row.email.length > 0)
        .map((row) => ({
          recipient_row_id: row.id,
          profile_id: row.profile_id,
          email: row.email as string,
          full_name: nameByProfile.get(row.profile_id) ?? null,
        }))

      const portalUrl = await siteUrl('/notifications')
      const audienceLabel = describeAudience(notification)
      // Same invite for every recipient, so build it once.
      const sessionInvite =
        notification.kind === 'reminder' ? await sessionInviteFor(supabase, notification.content_id) : null

      // Strictly serial: keeps us comfortably inside Resend's free
      // rate limit (2 req/s) and lets us record per-row results
      // without burning the whole batch on one transient failure.
      for (const target of toSend) {
        const result = await sendNotificationEmail(target.email, {
          recipientName: target.full_name,
          kind: notification.kind as NotificationKind,
          title: notification.title,
          body: notification.body,
          ctaLabel: notification.cta_label,
          ctaUrl: notification.cta_url,
          portalUrl,
          subjectOverride: notification.email_subject,
          footerNote: `Audience: ${audienceLabel}`,
          attachments: sessionInvite ? [sessionInvite] : undefined,
        })

        if (result.ok) {
          emailsSent += 1
          await supabase
            .from('notification_recipients')
            .update({
              email_status: 'sent',
              email_provider_id: result.id,
              email_sent_at: new Date().toISOString(),
              email_error: null,
            })
            .eq('id', target.recipient_row_id)
        } else {
          emailsFailed += 1
          await supabase
            .from('notification_recipients')
            .update({
              email_status: 'failed',
              email_error: result.error,
            })
            .eq('id', target.recipient_row_id)
        }
      }

      // Anyone who was 'skipped' (no email on file or email disabled)
      // is counted as skipped for the summary.
      const { count: skippedCount } = await supabase
        .from('notification_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('notification_id', notification.id)
        .eq('email_status', 'skipped')
      emailsSkipped = skippedCount ?? 0
    }

    await finalizeStatus(supabase, notification.id, 'sent', emailsFailed > 0)

    return {
      ok: true,
      notificationId: notification.id,
      recipientsResolved: recipients.length,
      emailsSent,
      emailsFailed,
      emailsSkipped,
      status: 'sent',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown dispatch error'
    await finalizeStatus(supabase, notificationId, 'failed', true)
    return {
      ok: false,
      notificationId,
      recipientsResolved: 0,
      emailsSent: 0,
      emailsFailed: 0,
      emailsSkipped: 0,
      status: 'failed',
      error: message,
    }
  }
}

/**
 * Cron entry point: claims every scheduled notification whose
 * scheduled_for <= now() and dispatches each one. Returns an aggregate
 * summary so the cron route can log a single line.
 */
export async function dispatchDueNotifications(): Promise<{
  picked: number
  results: DispatchResult[]
}> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (error) throw error
  const ids = (data ?? []).map((r) => r.id as string)

  const results: DispatchResult[] = []
  for (const id of ids) {
    const r = await dispatchNotification(id, {
      allowedFromStatuses: ['scheduled'],
    })
    results.push(r)
  }
  return { picked: ids.length, results }
}
