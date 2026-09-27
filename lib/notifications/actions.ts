'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-server'
import {
  dismissAllNotifications,
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from './feed'

/**
 * Marks a single notification as read for the current user. Idempotent
 * (safe to call from a button without optimistic-collision worries).
 */
export async function markNotificationReadAction(notificationId: string) {
  try {
    const user = await requireUser()
    // Admin preview is read-only: nothing is written for the previewed id.
    if (user.preview) return { ok: true as const }
    await markNotificationRead(user.id, notificationId)
    revalidatePath('/notifications')
    revalidatePath('/dashboard')
    return { ok: true as const }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Could not mark as read',
    }
  }
}

/**
 * Marks every visible unread notification as read for the user.
 */
export async function markAllNotificationsReadAction() {
  try {
    const user = await requireUser()
    // Admin preview is read-only: nothing is written for the previewed id.
    if (user.preview) return { ok: true as const }
    await markAllNotificationsRead(user.id)
    revalidatePath('/notifications')
    revalidatePath('/dashboard')
    return { ok: true as const }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Could not mark all as read',
    }
  }
}

/**
 * Clears a single notification from the user's feed. The notification
 * row itself is untouched; only the user's per-recipient row gets a
 * `dismissed_at` timestamp.
 */
export async function dismissNotificationAction(notificationId: string) {
  try {
    const user = await requireUser()
    // Admin preview is read-only: nothing is written for the previewed id.
    if (user.preview) return { ok: true as const }
    await dismissNotification(user.id, notificationId)
    revalidatePath('/notifications')
    revalidatePath('/dashboard')
    return { ok: true as const }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Could not clear notification',
    }
  }
}

/**
 * Clears every notification currently in the user's feed.
 */
export async function dismissAllNotificationsAction() {
  try {
    const user = await requireUser()
    // Admin preview is read-only: nothing is written for the previewed id.
    if (user.preview) return { ok: true as const }
    await dismissAllNotifications(user.id)
    revalidatePath('/notifications')
    revalidatePath('/dashboard')
    return { ok: true as const }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : 'Could not clear notifications',
    }
  }
}
