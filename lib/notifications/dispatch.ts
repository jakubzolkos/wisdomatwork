import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email/send'
import { isEmailConfigured, type EmailAttachment } from '@/lib/email/client'
import { buildSessionIcs } from '@/lib/email/ics'
import { siteUrl } from '@/lib/site'
import { describeAudience, resolveRecipients } from './audience'
import { renderMerge, safeCtaUrl, writesOwnGreeting } from './merge-fields'
import { loadSessionInfo, recipientMergeData, sessionMergeData, type SessionInfo } from './session-info'
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
 * The calendar invite to attach to a session reminder, so a Fellow can add
 * the session, with its Zoom link, to their calendar.
 */
function inviteFromSession(session: SessionInfo): EmailAttachment {
  const content = buildSessionIcs({
    uid: session.id,
    title: `${session.name} (Wisdom at Work)`,
    start: session.start,
    minutes: session.minutes,
    url: session.url,
  })
  return { filename: 'session.ics', content, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }
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
      const cohortByProfile = new Map(
        recipients.map((r) => [r.id, r.cohort] as const),
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
      // The pinned session, if any, is the same for every recipient, so
      // load it once: it feeds the session merge fields and the invite.
      const session = await loadSessionInfo(supabase, notification.content_id)
      const sessionInvite =
        notification.kind === 'reminder' && session ? inviteFromSession(session) : null
      const sessionFields = sessionMergeData(session)
      const ownGreeting = writesOwnGreeting(notification.body)

      // Strictly serial: keeps us comfortably inside Resend's free
      // rate limit (2 req/s) and lets us record per-row results
      // without burning the whole batch on one transient failure.
      for (const target of toSend) {
        // Fill this recipient's merge fields ({{first_name}}, {{zoom_link}}, ...).
        // The saved notification keeps the {{...}} text; only what is sent changes.
        const data = {
          ...recipientMergeData(
            { full_name: target.full_name, cohort: cohortByProfile.get(target.profile_id) ?? null },
            portalUrl,
          ),
          ...sessionFields,
        }
        const fill = (s: string | null) => (s ? renderMerge(s, data) : s)
        // The button link must still be a real web address or site path
        // after filling; otherwise drop the whole button.
        const ctaUrl = notification.cta_url ? safeCtaUrl(renderMerge(notification.cta_url, data)) : null
        const result = await sendNotificationEmail(target.email, {
          recipientName: target.full_name,
          kind: notification.kind as NotificationKind,
          title: renderMerge(notification.title, data),
          body: renderMerge(notification.body, data),
          ctaLabel: ctaUrl ? fill(notification.cta_label) : null,
          ctaUrl,
          portalUrl,
          subjectOverride: fill(notification.email_subject),
          footerNote: `Audience: ${audienceLabel}`,
          attachments: sessionInvite ? [sessionInvite] : undefined,
          autoGreeting: !ownGreeting,
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
