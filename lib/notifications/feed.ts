import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasMergeFields, safeCtaUrl } from './merge-fields'
import { createViewerMerger } from './merge-for-viewer'
import type { NotificationFeedItem, NotificationRow } from './types'

interface RecipientRow {
  id: string
  notification_id: string
  read_at: string | null
  // `dismissed_at` is the per-user "clear from feed" timestamp added
  // in migration 048. It hides the notification from this user's
  // surfaces only - delivery state and other recipients are
  // untouched. Null means the notification is still in the feed.
  dismissed_at: string | null
}

/**
 * Returns the notifications the current user can see, in feed order
 * (pinned first, then most recent), with their personal read state
 * left-joined in. Falls back to `published_at` for legacy rows that
 * pre-date the unified `sent_at` column.
 *
 * RLS on `notifications` already enforces audience visibility, so we
 * just query through the user-scoped client.
 */
export async function getNotificationFeedForUser(
  userId: string,
  options: {
    limit?: number
    onlyUnread?: boolean
    /**
     * When true (the default) items the user has cleared from their
     * feed via `dismissNotification` are filtered out. Set to false
     * for admin-style views that need to show the full history
     * regardless of per-user dismissals.
     */
    excludeDismissed?: boolean
  } = {},
): Promise<NotificationFeedItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const excludeDismissed = options.excludeDismissed ?? true
  const supabase = await createClient()

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('status', 'sent')
    .order('pinned', { ascending: false })
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  const rows = (notifications ?? []) as NotificationRow[]
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  // Read + dismiss state lives in notification_recipients. Own RLS
  // allows the user to read their own rows directly.
  const { data: recipients } = await supabase
    .from('notification_recipients')
    .select('id, notification_id, read_at, dismissed_at')
    .eq('profile_id', userId)
    .in('notification_id', ids)

  const recipientByNotification = new Map<string, RecipientRow>()
  for (const r of (recipients ?? []) as RecipientRow[]) {
    recipientByNotification.set(r.notification_id, r)
  }

  const items: NotificationFeedItem[] = rows.map((row) => {
    const r = recipientByNotification.get(row.id)
    return {
      ...row,
      read_at: r?.read_at ?? null,
      recipient_id: r?.id ?? null,
      dismissed_at: r?.dismissed_at ?? null,
    }
  })

  let filtered = items
  if (excludeDismissed) filtered = filtered.filter((i) => !i.dismissed_at)
  if (options.onlyUnread) filtered = filtered.filter((i) => !i.read_at)

  // Fill merge fields ({{first_name}}, ...) as this person sees them.
  if (filtered.some((i) => hasMergeFields(i.title, i.body, i.cta_label, i.cta_url))) {
    const merge = await createViewerMerger(userId, filtered.map((i) => i.content_id))
    filtered = filtered.map((i) => {
      // The link must still be a real address after filling; else no button.
      const url = i.cta_url ? safeCtaUrl(merge(i.cta_url, i.content_id)) : null
      return {
        ...i,
        title: merge(i.title, i.content_id),
        body: merge(i.body, i.content_id),
        cta_label: url && i.cta_label ? merge(i.cta_label, i.content_id) : null,
        cta_url: url,
      }
    })
  }
  return filtered
}

/**
 * Lightweight count for the bell badge. Counts visible sent
 * notifications that either have no recipient row for the user or
 * whose recipient row has read_at = null.
 */
export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const items = await getNotificationFeedForUser(userId, { onlyUnread: true })
  return items.length
}

/**
 * Marks a single notification as read for the user. Inserts a
 * recipient row if one does not exist (e.g. legacy announcements).
 * Uses the admin client because legacy rows have no recipient row
 * yet, and we want to insert one even if no audience match was
 * recorded by the dispatcher.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  await admin
    .from('notification_recipients')
    .upsert(
      {
        notification_id: notificationId,
        profile_id: userId,
        email_status: 'skipped',
        read_at: now,
      },
      { onConflict: 'notification_id,profile_id' },
    )

  // Upsert with conflict ignore_duplicates would skip the read_at
  // update on existing rows; do an explicit update to make sure
  // read_at is set whether the row was just inserted or pre-existed.
  await admin
    .from('notification_recipients')
    .update({ read_at: now })
    .eq('notification_id', notificationId)
    .eq('profile_id', userId)
    .is('read_at', null)
}

/**
 * Marks every visible unread notification as read for the user.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const unread = await getNotificationFeedForUser(userId, { onlyUnread: true })
  if (unread.length === 0) return
  for (const item of unread) {
    await markNotificationRead(userId, item.id)
  }
}

/**
 * Clears a single notification from the user's feed. Idempotent: a
 * second call just refreshes `dismissed_at`. Inserts a recipient row
 * if one didn't exist yet (legacy announcements, or items the user
 * is seeing because of a global audience but never received an email
 * for).
 *
 * We also set `read_at` defensively so the unread badge clears even
 * for users who skipped reading and went straight to dismissing.
 */
export async function dismissNotification(
  userId: string,
  notificationId: string,
): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  await admin
    .from('notification_recipients')
    .upsert(
      {
        notification_id: notificationId,
        profile_id: userId,
        email_status: 'skipped',
        read_at: now,
        dismissed_at: now,
      },
      { onConflict: 'notification_id,profile_id' },
    )

  // Upsert with onConflict will update existing rows, but it leaves
  // any prior NULLs intact. Make absolutely sure the dismiss flag is
  // set on rows that already existed.
  await admin
    .from('notification_recipients')
    .update({ dismissed_at: now, read_at: now })
    .eq('notification_id', notificationId)
    .eq('profile_id', userId)
    .is('dismissed_at', null)
}

/**
 * Clears every visible notification from the user's feed at once.
 * "Visible" means anything currently in their feed that hasn't been
 * dismissed already - we look it up via the same query the UI uses
 * so there's no risk of dismissing items they couldn't see.
 */
export async function dismissAllNotifications(userId: string): Promise<void> {
  const visible = await getNotificationFeedForUser(userId, {
    excludeDismissed: true,
    limit: 200,
  })
  if (visible.length === 0) return
  for (const item of visible) {
    await dismissNotification(userId, item.id)
  }
}
