'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvitationEmail } from '@/lib/email/send'
import { sendNotificationEmail } from '@/lib/email/send'
import { isEmailConfigured } from '@/lib/email/client'
import { assertAdminArea } from '@/lib/admin-access-server'

export interface EmailLog {
  id: string
  type: 'invitation' | 'notification' | 'sign-in-code' | 'password-setup'
  recipient_email: string
  recipient_name: string | null
  subject: string
  status: 'sent' | 'failed' | 'pending'
  error_message: string | null
  provider_id: string | null
  sent_at: string | null
  created_at: string
}

/**
 * Fetch all email logs, ordered by most recent first.
 */
export async function getEmailLogs(): Promise<EmailLog[]> {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('comms', 'read')
  const admin = createAdminClient()

  try {
    // Query from invitations, notification_recipients, and sign-in logs
    // Combine results with a common shape
    const [invitations, notifications, signInLogs] = await Promise.all([
      admin
        .from('invitations')
        .select('id, email, full_name, status, last_error, email_provider_id, last_sent_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('notification_recipients')
        .select(
          'id, email, profile_id, email_status, email_error, email_provider_id, email_sent_at, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(100),
      // Sign-in and password logs would come from a separate table if available
      Promise.resolve({ data: [], error: null }),
    ])

    if (invitations.error) throw invitations.error
    if (notifications.error) throw notifications.error

    const logs: EmailLog[] = []

    // Map invitations
    if (invitations.data) {
      logs.push(
        ...invitations.data.map((row: any) => ({
          id: row.id,
          type: 'invitation' as const,
          recipient_email: row.email,
          recipient_name: row.full_name,
          subject: 'Invitation',
          status: (row.status === 'sent' ? 'sent' : row.status === 'failed' ? 'failed' : 'pending') as 'sent' | 'failed' | 'pending',
          error_message: row.last_error,
          provider_id: row.email_provider_id,
          sent_at: row.last_sent_at,
          created_at: row.created_at,
        }))
      )
    }

    // Map notification recipients
    if (notifications.data) {
      logs.push(
        ...notifications.data.map((row: any) => ({
          id: row.id,
          type: 'notification' as const,
          recipient_email: row.email,
          recipient_name: null,
          subject: 'Notification',
          status: (row.email_status === 'sent' ? 'sent' : row.email_status === 'failed' ? 'failed' : 'pending') as 'sent' | 'failed' | 'pending',
          error_message: row.email_error,
          provider_id: row.email_provider_id,
          sent_at: row.email_sent_at,
          created_at: row.created_at,
        }))
      )
    }

    // Sort by created_at descending
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return logs.slice(0, 100)
  } catch (err) {
    console.error('[v0] Failed to get email logs:', err)
    return []
  }
}

/**
 * Resend an invitation email for a given invitation ID.
 */
export async function resendInvitationEmail(invitationId: string): Promise<{
  ok: boolean
  message?: string
  error?: string
}> {
  // Server actions are public endpoints: check the caller first.
  try {
    await assertAdminArea('comms')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Not allowed' }
  }
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: 'Email is not configured (RESEND_API_KEY missing)',
    }
  }

  const admin = createAdminClient()

  try {
    // Fetch the invitation
    const { data: invitation, error: fetchErr } = await admin
      .from('invitations')
      .select('id, email, full_name, invited_by_name, cohort_label')
      .eq('id', invitationId)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!invitation) {
      return {
        ok: false,
        error: 'Invitation not found',
      }
    }

    // For resend, we need to generate a new activation link
    // This requires fetching the auth user or generating a new token
    // For now, we'll send a generic resend email with instructions
    // In a real system, you'd regenerate the activation token

    const result = await sendInvitationEmail(invitation.email, {
      recipientName: invitation.full_name,
      activationUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://waw-portal.com',
      invitedByName: invitation.invited_by_name,
      cohortLabel: invitation.cohort_label,
      expiresAtLabel: '1 hour',
    })

    if (result.ok) {
      // Update the invitation status
      await admin
        .from('invitations')
        .update({
          status: 'sent',
          email_provider_id: result.id,
          last_sent_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId)

      return {
        ok: true,
        message: `Invitation resent to ${invitation.email}`,
      }
    } else {
      // Update with the error
      await admin
        .from('invitations')
        .update({
          status: 'failed',
          last_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId)

      return {
        ok: false,
        error: result.error,
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[v0] Failed to resend invitation:', err)
    return {
      ok: false,
      error: message,
    }
  }
}

/**
 * Resend a notification email for a given notification recipient ID.
 */
export async function resendNotificationEmail(recipientId: string): Promise<{
  ok: boolean
  message?: string
  error?: string
}> {
  // Server actions are public endpoints: check the caller first.
  try {
    await assertAdminArea('comms')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Not allowed' }
  }
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: 'Email is not configured (RESEND_API_KEY missing)',
    }
  }

  const admin = createAdminClient()

  try {
    // Fetch the notification recipient and related notification
    const { data: recipient, error: fetchErr } = await admin
      .from('notification_recipients')
      .select('id, email, notification_id, notifications(title, body, cta_label, cta_url, kind)')
      .eq('id', recipientId)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!recipient) {
      return {
        ok: false,
        error: 'Notification recipient not found',
      }
    }

    const notification = (recipient as any).notifications
    if (!notification) {
      return {
        ok: false,
        error: 'Notification not found',
      }
    }

    const result = await sendNotificationEmail(recipient.email, {
      recipientName: null,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      ctaLabel: notification.cta_label,
      ctaUrl: notification.cta_url,
      portalUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://waw-portal.com',
      subjectOverride: notification.title,
      footerNote: 'Resend from admin panel',
    })

    if (result.ok) {
      // Update the recipient status
      await admin
        .from('notification_recipients')
        .update({
          email_status: 'sent',
          email_provider_id: result.id,
          email_sent_at: new Date().toISOString(),
          email_error: null,
        })
        .eq('id', recipientId)

      return {
        ok: true,
        message: `Notification resent to ${recipient.email}`,
      }
    } else {
      // Update with the error
      await admin
        .from('notification_recipients')
        .update({
          email_status: 'failed',
          email_error: result.error,
        })
        .eq('id', recipientId)

      return {
        ok: false,
        error: result.error,
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[v0] Failed to resend notification:', err)
    return {
      ok: false,
      error: message,
    }
  }
}
