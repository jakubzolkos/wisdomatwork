'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import {
  isSupportedScope,
  type AudienceInput,
} from '@/lib/notifications/audience'
import {
  NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationStatus,
} from '@/lib/notifications/types'
import { assertAdminArea } from '@/lib/admin-access-server'

export type NotificationFormResult =
  | { ok: true; id: string; status: NotificationStatus; message: string }
  | { ok: false; message: string }

const VALID_COHORT_CODES = ['A', 'B', 'C'] as const
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function requiredString(fd: FormData, key: string): string {
  const v = fd.get(key)
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`Missing required field: ${key}`)
  }
  return v.trim()
}

function optionalString(fd: FormData, key: string): string | null {
  const v = fd.get(key)
  if (typeof v !== 'string' || v.trim() === '') return null
  return v.trim()
}

function multiString(fd: FormData, key: string): string[] {
  const seen = new Set<string>()
  for (const raw of fd.getAll(key)) {
    if (typeof raw !== 'string') continue
    const v = raw.trim()
    if (v === '') continue
    seen.add(v)
  }
  return [...seen]
}

function parseKind(value: string): NotificationKind {
  if (!(NOTIFICATION_KINDS as readonly string[]).includes(value)) {
    throw new Error(`Invalid notification type: ${value}`)
  }
  return value as NotificationKind
}

function fail(message: string): NotificationFormResult {
  return { ok: false, message }
}

function ok(
  id: string,
  status: NotificationStatus,
  message: string,
): NotificationFormResult {
  return { ok: true, id, status, message }
}

// ---------------------------------------------------------------------------
// Audience resolution (mirrors the announcements implementation, kept
// inline so this module is self-contained).
// ---------------------------------------------------------------------------

async function resolveContentId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raw: string | null,
): Promise<string | null> {
  if (!raw) return null
  const { data, error } = await supabase
    .from('labs')
    .select('id')
    .eq('id', raw)
    .maybeSingle<{ id: string }>()
  if (error) throw error
  if (!data) {
    throw new Error('That curriculum item could not be found. Please pick another.')
  }
  return data.id
}

async function resolveAudience(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: string,
  cohortCodes: string[],
  schoolTeamIds: string[],
  userIds: string[],
): Promise<AudienceInput & { year_id: null; cohort_id: null }> {
  if (!isSupportedScope(scope)) throw new Error('Invalid audience scope')

  if (scope === 'global') {
    return {
      audience_scope: 'global',
      cohort_codes: null,
      school_team_ids: null,
      user_ids: null,
      year_id: null,
      cohort_id: null,
    }
  }

  if (scope === 'cohort') {
    const cleaned = cohortCodes.filter((c) =>
      (VALID_COHORT_CODES as readonly string[]).includes(c),
    )
    if (cleaned.length === 0) {
      throw new Error('Pick at least one cohort (A, B, or C).')
    }
    return {
      audience_scope: 'cohort',
      cohort_codes: cleaned,
      school_team_ids: null,
      user_ids: null,
      year_id: null,
      cohort_id: null,
    }
  }

  if (scope === 'school_team') {
    const cleaned = schoolTeamIds.filter((id) => UUID_RE.test(id))
    if (cleaned.length === 0) {
      throw new Error('Pick at least one school team.')
    }
    const { data: existing, error } = await supabase
      .from('cohorts')
      .select('id')
      .in('id', cleaned)
    if (error) throw error
    const found = new Set((existing ?? []).map((r) => r.id))
    const missing = cleaned.filter((id) => !found.has(id))
    if (missing.length > 0) {
      throw new Error('One or more school teams could not be found. Please reselect.')
    }
    return {
      audience_scope: 'school_team',
      cohort_codes: null,
      school_team_ids: cleaned,
      user_ids: null,
      year_id: null,
      cohort_id: null,
    }
  }

  // scope === 'users'
  const cleaned = userIds.filter((id) => UUID_RE.test(id))
  if (cleaned.length === 0) {
    throw new Error('Pick at least one fellow.')
  }
  const { data: existingUsers, error: usersErr } = await supabase
    .from('profiles')
    .select('id')
    .in('id', cleaned)
  if (usersErr) throw usersErr
  const foundUsers = new Set((existingUsers ?? []).map((r) => r.id))
  const missingUsers = cleaned.filter((id) => !foundUsers.has(id))
  if (missingUsers.length > 0) {
    throw new Error('One or more fellows could not be found. Please reselect.')
  }
  return {
    audience_scope: 'users',
    cohort_codes: null,
    school_team_ids: null,
    user_ids: cleaned,
    year_id: null,
    cohort_id: null,
  }
}

// ---------------------------------------------------------------------------
// Schedule + CTA helpers
// ---------------------------------------------------------------------------

function parseSchedule(
  fd: FormData,
): { mode: 'send_now' | 'schedule' | 'draft'; scheduled_for: string | null } {
  const action = String(fd.get('schedule_action') ?? 'send_now')
  if (action === 'draft') return { mode: 'draft', scheduled_for: null }
  if (action === 'schedule') {
    const raw = String(fd.get('scheduled_for') ?? '').trim()
    if (!raw) throw new Error('Pick a date and time to schedule for')
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('That schedule date and time is not valid')
    }
    if (parsed.getTime() <= Date.now() - 60_000) {
      throw new Error('Scheduled time must be in the future')
    }
    return { mode: 'schedule', scheduled_for: parsed.toISOString() }
  }
  return { mode: 'send_now', scheduled_for: null }
}

function parseCta(fd: FormData): { cta_label: string | null; cta_url: string | null } {
  const label = optionalString(fd, 'cta_label')
  const url = optionalString(fd, 'cta_url')
  if (label && !url) {
    throw new Error('CTA needs a link URL when a label is set')
  }
  if (url && !label) {
    throw new Error('CTA needs a label when a link URL is set')
  }
  if (url && !/^(https?:\/\/|\/)/i.test(url)) {
    throw new Error('CTA link must start with http(s):// or /')
  }
  return { cta_label: label, cta_url: url }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createNotification(
  fd: FormData,
): Promise<NotificationFormResult> {
  try {
    const admin = await assertAdminArea('comms')
    const supabase = await createClient()

    const kind = parseKind(requiredString(fd, 'kind'))
    const scope = requiredString(fd, 'audience_scope')
    const audience = await resolveAudience(
      supabase,
      scope,
      multiString(fd, 'cohort_codes'),
      multiString(fd, 'school_team_ids'),
      multiString(fd, 'user_ids'),
    )
    const contentId = await resolveContentId(
      supabase,
      optionalString(fd, 'content_id'),
    )
    const cta = parseCta(fd)
    const emailEnabled = fd.get('email_enabled') === 'on'
    const emailSubject = optionalString(fd, 'email_subject')

    const { mode, scheduled_for } = parseSchedule(fd)
    const initialStatus: NotificationStatus =
      mode === 'draft' ? 'draft' : mode === 'schedule' ? 'scheduled' : 'draft'

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        author_id: admin.id,
        kind,
        status: initialStatus,
        title: requiredString(fd, 'title'),
        body: requiredString(fd, 'body'),
        pinned: fd.get('pinned') === 'on',
        cta_label: cta.cta_label,
        cta_url: cta.cta_url,
        email_enabled: emailEnabled,
        email_subject: emailSubject,
        scheduled_for,
        content_id: contentId,
        ...audience,
      })
      .select('id')
      .single<{ id: string }>()
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not save notification')
    }

    let finalStatus: NotificationStatus = initialStatus
    let message: string

    if (mode === 'send_now') {
      const result = await dispatchNotification(data.id, {
        allowedFromStatuses: ['draft'],
      })
      finalStatus = result.status
      if (!result.ok) {
        // The notification row exists, but dispatch failed. Surface the
        // error and let the admin retry from the list.
        revalidatePath('/admin/notifications')
        return fail(result.error ?? 'Notification saved but dispatch failed')
      }
      message =
        result.emailsSent > 0
          ? `Sent to ${result.recipientsResolved} recipient${
              result.recipientsResolved === 1 ? '' : 's'
            } (${result.emailsSent} email${result.emailsSent === 1 ? '' : 's'} delivered)`
          : `Posted to ${result.recipientsResolved} recipient${
              result.recipientsResolved === 1 ? '' : 's'
            }`
    } else if (mode === 'schedule') {
      message = `Scheduled for ${new Date(scheduled_for!).toLocaleString()}`
    } else {
      message = 'Saved as draft'
    }

    revalidatePath('/admin/notifications')
    revalidatePath('/dashboard')
    revalidatePath('/notifications')
    return ok(data.id, finalStatus, message)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

// ---------------------------------------------------------------------------
// Update (drafts and scheduled only - sent notifications can be edited
// for typo fixes but we leave audience/scheduling alone)
// ---------------------------------------------------------------------------

export async function updateNotification(
  fd: FormData,
): Promise<NotificationFormResult> {
  try {
    await assertAdminArea('comms')
    const supabase = await createClient()

    const id = requiredString(fd, 'id')
    const kind = parseKind(requiredString(fd, 'kind'))
    const scope = requiredString(fd, 'audience_scope')
    const audience = await resolveAudience(
      supabase,
      scope,
      multiString(fd, 'cohort_codes'),
      multiString(fd, 'school_team_ids'),
      multiString(fd, 'user_ids'),
    )
    const contentId = await resolveContentId(
      supabase,
      optionalString(fd, 'content_id'),
    )
    const cta = parseCta(fd)
    const emailEnabled = fd.get('email_enabled') === 'on'
    const emailSubject = optionalString(fd, 'email_subject')

    const { data, error } = await supabase
      .from('notifications')
      .update({
        kind,
        title: requiredString(fd, 'title'),
        body: requiredString(fd, 'body'),
        pinned: fd.get('pinned') === 'on',
        cta_label: cta.cta_label,
        cta_url: cta.cta_url,
        email_enabled: emailEnabled,
        email_subject: emailSubject,
        content_id: contentId,
        updated_at: new Date().toISOString(),
        ...audience,
      })
      .eq('id', id)
      .select('id, status')
      .maybeSingle<{ id: string; status: NotificationStatus }>()
    if (error || !data) {
      throw new Error(error?.message ?? 'Notification not found')
    }

    revalidatePath('/admin/notifications')
    revalidatePath('/dashboard')
    revalidatePath('/notifications')
    return ok(data.id, data.status, 'Saved')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteNotification(fd: FormData) {
  await assertAdminArea('comms')
  const supabase = await createClient()
  const id = requiredString(fd, 'id')
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/admin/notifications')
  revalidatePath('/dashboard')
  revalidatePath('/notifications')
}

// ---------------------------------------------------------------------------
// Send-now (for drafts and scheduled rows)
// ---------------------------------------------------------------------------

export async function sendNotificationNow(fd: FormData) {
  await assertAdminArea('comms')
  const id = requiredString(fd, 'id')
  await dispatchNotification(id, {
    allowedFromStatuses: ['draft', 'scheduled', 'failed'],
  })
  revalidatePath('/admin/notifications')
  revalidatePath('/dashboard')
  revalidatePath('/notifications')
}

// ---------------------------------------------------------------------------
// Cancel a scheduled notification
// ---------------------------------------------------------------------------

export async function cancelScheduledNotification(fd: FormData) {
  await assertAdminArea('comms')
  const supabase = await createClient()
  const id = requiredString(fd, 'id')
  const { error } = await supabase
    .from('notifications')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'scheduled')
  if (error) throw error
  revalidatePath('/admin/notifications')
}

// ---------------------------------------------------------------------------
// Pin toggle
// ---------------------------------------------------------------------------

export async function toggleNotificationPin(fd: FormData) {
  await assertAdminArea('comms')
  const supabase = await createClient()
  const id = requiredString(fd, 'id')

  const { data: row, error: fetchErr } = await supabase
    .from('notifications')
    .select('pinned')
    .eq('id', id)
    .single<{ pinned: boolean }>()
  if (fetchErr) throw fetchErr

  const { error } = await supabase
    .from('notifications')
    .update({ pinned: !row.pinned, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  revalidatePath('/admin/notifications')
  revalidatePath('/dashboard')
  revalidatePath('/notifications')
}
