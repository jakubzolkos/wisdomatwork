'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-server'
import { sendBrandedInvite, type InvitePayload } from '@/lib/invitations/invite'
import { parseCsv, parsePastedList, type ParsedInviteRow } from '@/lib/invitations/parse'
import type { Role } from '@/lib/roles'
import { isCohort, type Cohort } from '@/lib/cohorts'

const ROLES: readonly Role[] = ['fellow', 'facilitator', 'admin'] as const

function ok(message: string) {
  return { ok: true as const, message }
}
function fail(message: string) {
  return { ok: false as const, message }
}

export type ActionResult = { ok: true; message: string } | { ok: false; message: string }

function assertRole(value: unknown): asserts value is Role {
  if (!ROLES.includes(value as Role)) {
    throw new Error(`Invalid role: ${String(value)}`)
  }
}

async function profileDisplayName(profileId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', profileId)
    .maybeSingle<{ full_name: string | null; email: string | null }>()
  return data?.full_name ?? data?.email ?? null
}

export async function inviteUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireAdmin()

    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const firstName = String(formData.get('firstName') ?? '').trim()
    const lastName = String(formData.get('lastName') ?? '').trim()
    const title = String(formData.get('title') ?? '').trim()
    const role = String(formData.get('role') ?? 'fellow')
    // schoolTeamId comes from the existing "cohorts" table, surfaced
    // in the UI as "School Name". cohortLetter is the A/B/C label
    // stored on profiles.cohort - only valid for fellows.
    const schoolTeamId = String(formData.get('cohortId') ?? '')
    const cohortLetterRaw = String(formData.get('cohortLetter') ?? '')
    // School profile fields (optional)
    const schoolDescription = String(formData.get('schoolDescription') ?? '').trim()
    const schoolLocation = String(formData.get('schoolLocation') ?? '').trim()
    const schoolContactEmail = String(formData.get('schoolContactEmail') ?? '').trim()
    const schoolWebsiteUrl = String(formData.get('schoolWebsiteUrl') ?? '').trim()
    const schoolLogoUrl = String(formData.get('schoolLogoUrl') ?? '').trim()

    if (!firstName) return fail('First Name is required')
    if (!lastName) return fail('Last Name is required')
    if (!email) return fail('Email Address is required')
    assertRole(role)

    // The downstream invite + profile pipeline still uses a single
    // `fullName` string. Build it from the split inputs so we don't
    // have to touch profiles.full_name or the email template.
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

    // Cohorts are exclusively a program-fellow concept. Admins and
    // facilitators have unrestricted access to all curriculum and are
    // never bound to a cohort, so we silently drop any cohort value
    // submitted with a non-fellow role.
    const cohortLetter: Cohort | null =
      role === 'fellow' && isCohort(cohortLetterRaw) ? cohortLetterRaw : null

    const invitedByName = await profileDisplayName(me.id)

    const result = await sendBrandedInvite(
      {
        email,
        fullName,
        title: title || null,
        role,
        schoolTeamId: schoolTeamId || null,
        cohortLetter,
        invitedByName,
        cohortLabel: cohortLetter ? `Cohort ${cohortLetter}` : null,
        schoolDescription: schoolDescription || null,
        schoolLocation: schoolLocation || null,
        schoolContactEmail: schoolContactEmail || null,
        schoolWebsiteUrl: schoolWebsiteUrl || null,
        schoolLogoUrl: schoolLogoUrl || null,
      },
      me.id,
    )

    revalidatePath('/admin/users')

    if (!result.ok) {
      return fail(result.error ?? 'Failed to send invite')
    }
    return ok(result.message ?? `Invite sent to ${email}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export type BulkInviteSummary = {
  ok: true
  total: number
  invited: number
  failed: number
  results: Array<{
    email: string
    status: 'invited' | 'failed'
    message?: string
  }>
}

export type BulkInviteResult = BulkInviteSummary | { ok: false; message: string }

export async function bulkInviteAction(formData: FormData): Promise<BulkInviteResult> {
  try {
    const me = await requireAdmin()

    const source = String(formData.get('source') ?? 'paste') as 'paste' | 'csv'
    const text = String(formData.get('text') ?? '')
    const role = String(formData.get('role') ?? 'fellow')
    const defaultSchoolTeamId = String(formData.get('cohortId') ?? '')
    const cohortLetterRaw = String(formData.get('cohortLetter') ?? '')

    if (!text.trim()) return fail('Paste or upload at least one row')
    assertRole(role)
    const defaultCohort: Cohort | null =
      role === 'fellow' && isCohort(cohortLetterRaw) ? cohortLetterRaw : null

    let rows: ParsedInviteRow[]
    if (source === 'csv') {
      const parsed = parseCsv(text)
      if (parsed.headerError) return fail(parsed.headerError)
      rows = parsed.rows
    } else {
      rows = parsePastedList(text)
    }

    if (rows.length === 0) return fail('No rows found in input')

    // Resolve any per-row "School Name" string to an existing school
    // team (cohorts.id) by case-insensitive name match. We deliberately
    // do NOT auto-create a new team for unknown names: the spec says
    // to preserve the existing School Team workflow, so unmatched names
    // fall back to the bulk-default team and we surface it in the
    // per-row note so the admin can fix it after the fact.
    const admin = createAdminClient()
    const { data: cohortRows } = await admin
      .from('cohorts')
      .select('id, name')
    const schoolByName = new Map<string, { id: string; name: string }>()
    for (const c of (cohortRows ?? []) as Array<{ id: string; name: string | null }>) {
      if (c.name) schoolByName.set(c.name.trim().toLowerCase(), { id: c.id, name: c.name })
    }

    const invitedByName = await profileDisplayName(me.id)
    const results: BulkInviteSummary['results'] = []
    let invited = 0
    let failed = 0

    for (const row of rows) {
      if (!row.ok || !row.data) {
        failed++
        results.push({
          email: row.raw.slice(0, 80),
          status: 'failed',
          message: row.error ?? 'invalid row',
        })
        continue
      }

      // School Name resolution: explicit name > bulk default > unset.
      let resolvedSchoolTeamId: string | null = defaultSchoolTeamId || null
      let schoolNote: string | null = null
      const rawSchool = row.data.school_name?.trim()
      if (rawSchool) {
        const match = schoolByName.get(rawSchool.toLowerCase())
        if (match) {
          resolvedSchoolTeamId = match.id
        } else {
          // Don't fail the row over a mismatched school - the email
          // still goes out. The admin can attach the team later.
          schoolNote = `school "${rawSchool}" not found, left unassigned`
          resolvedSchoolTeamId = null
        }
      }

      const payload: InvitePayload = {
        email: row.data.email,
        fullName: row.data.full_name || row.data.email,
        title: row.data.title ?? null,
        role: role as Role,
        schoolTeamId: resolvedSchoolTeamId,
        cohortLetter: defaultCohort,
        invitedByName,
        cohortLabel: defaultCohort ? `Cohort ${defaultCohort}` : null,
        schoolName: row.data.school_name ?? null,
        schoolDescription: row.data.school_description ?? null,
        schoolLocation: row.data.school_location ?? null,
        schoolContactEmail: row.data.school_contact_email ?? null,
        schoolWebsiteUrl: row.data.school_website_url ?? null,
      }

      const result = await sendBrandedInvite(payload, me.id)
      if (result.ok) {
        invited++
        const baseMessage = result.message ?? `Invited ${result.email}`
        results.push({
          email: result.email,
          status: 'invited',
          message: schoolNote ? `${baseMessage} (${schoolNote})` : baseMessage,
        })
      } else {
        failed++
        results.push({
          email: result.email,
          status: 'failed',
          message: result.error ?? 'failed',
        })
      }
    }

    revalidatePath('/admin/users')
    return { ok: true, total: rows.length, invited, failed, results }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function updateRoleAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const userId = String(formData.get('userId') ?? '')
    const role = String(formData.get('role') ?? '')
    if (!userId) return fail('Missing user id')
    assertRole(role)

    const admin = createAdminClient()

    // Cohort labels are fellow-only. Promoting a fellow to facilitator
    // or admin must clear their cohort - both to keep the data model
    // consistent (there's a CHECK constraint enforcing this) and to
    // reflect that admins/facilitators have unrestricted access.
    const update: { role: Role; cohort?: null } =
      role === 'fellow' ? { role } : { role, cohort: null }

    const { error } = await admin.from('profiles').update(update).eq('id', userId)
    if (error) return fail(error.message)

    revalidatePath('/admin/users')
    return ok('Role updated')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

/**
 * Updates the high-level cohort label (A/B/C) stored on profiles.cohort.
 * Empty string clears the cohort. This is the field that gates phase /
 * item / resource access for fellows in the user-facing UI.
 *
 * Refuses to set a cohort on any non-fellow profile. Admins and
 * facilitators are never cohort-scoped: they have full unrestricted
 * access to every curriculum item and library resource.
 */
export async function updateCohortLetterAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const userId = String(formData.get('userId') ?? '')
    const raw = String(formData.get('cohort') ?? '')
    if (!userId) return fail('Missing user id')

    const cohort: Cohort | null = isCohort(raw) ? raw : null
    if (raw && !cohort) return fail('Invalid cohort')

    const admin = createAdminClient()

    // Verify the target is actually a fellow before assigning a cohort.
    // (Clearing a cohort - cohort === null - is always allowed so we
    // can recover from any pre-constraint legacy data.)
    if (cohort) {
      const { data: target, error: tErr } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle<{ role: Role }>()
      if (tErr) return fail(tErr.message)
      if (!target) return fail('User not found')
      if (target.role !== 'fellow') {
        return fail('Cohorts can only be assigned to fellows.')
      }
    }

    const { error } = await admin
      .from('profiles')
      .update({ cohort })
      .eq('id', userId)
    if (error) return fail(error.message)

    revalidatePath('/admin/users')
    return ok(cohort ? `Cohort set to ${cohort}` : 'Cohort cleared')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

/**
 * Updates a fellow's School Team membership. Kept under the legacy
 * "updateCohortAction" name and "cohortId" form field so older callers
 * (and the cohort_members table itself) don't need to be renamed.
 */
export async function updateCohortAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const userId = String(formData.get('userId') ?? '')
    const cohortId = String(formData.get('cohortId') ?? '')
    if (!userId) return fail('Missing user id')

    const admin = createAdminClient()

    // Simple model: a user belongs to at most one cohort at a time.
    const { error: delErr } = await admin.from('cohort_members').delete().eq('profile_id', userId)
    if (delErr) return fail(delErr.message)

    if (cohortId) {
      const { error: insErr } = await admin
        .from('cohort_members')
        .insert({ cohort_id: cohortId, profile_id: userId })
      if (insErr) return fail(insErr.message)
    }

    // Profiles, team progress and Schools & teams follow the school_teams
    // link (057); keep it in step with the membership.
    const { data: schoolTeam } = cohortId
      ? await admin.from('school_teams').select('id, school_id').eq('cohort_id', cohortId).maybeSingle()
      : { data: null }
    const { error: profErr } = await admin
      .from('profiles')
      .update(
        schoolTeam
          ? { school_team_id: schoolTeam.id, school_id: schoolTeam.school_id }
          : { school_team_id: null },
      )
      .eq('id', userId)
    if (profErr) return fail(profErr.message)

    revalidatePath('/admin/users')
    revalidatePath('/admin/schools')
    return ok(cohortId ? 'Cohort updated' : 'Removed from cohort')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function resendInviteAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireAdmin()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    if (!email) return fail('Missing email')

    const admin = createAdminClient()

    // Pull the existing profile so the resent invite preserves
    // role, name, title, and cohort assignment - we want a true
    // resend, not a downgrade to a defaultized fellow invite.
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, title, role, cohort, cohort_members(cohort_id)')
      .eq('email', email)
      .maybeSingle<{
        full_name: string | null
        title: string | null
        role: Role
        cohort: Cohort | null
        cohort_members: { cohort_id: string }[] | { cohort_id: string } | null
      }>()

    const memberships = profile?.cohort_members
    const schoolTeamId = Array.isArray(memberships)
      ? memberships[0]?.cohort_id ?? null
      : memberships?.cohort_id ?? null

    const invitedByName = await profileDisplayName(me.id)

    const result = await sendBrandedInvite(
      {
        email,
        fullName: profile?.full_name ?? email,
        title: profile?.title ?? null,
        role: profile?.role ?? 'fellow',
        schoolTeamId,
        cohortLetter: profile?.cohort ?? null,
        invitedByName,
        cohortLabel: profile?.cohort ? `Cohort ${profile.cohort}` : null,
      },
      me.id,
    )

    revalidatePath('/admin/users')

    if (!result.ok) return fail(result.error ?? 'Failed to resend invite')
    return ok(result.message ?? `Invite resent to ${email}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

/**
 * Permanently removes a user. We delete the Supabase Auth record first
 * (which triggers the ON DELETE CASCADE on profiles.id -> auth.users.id);
 * if no such cascade exists we follow up with an explicit profile delete
 * so the /admin/users list is always consistent. Cohort memberships,
 * progress rows, etc. are wiped by the FKs that reference profile_id.
 *
 * Admins cannot delete themselves - they'd lock themselves out of the
 * admin panel and there's no self-service recovery.
 */
export async function deleteUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireAdmin()
    const userId = String(formData.get('userId') ?? '').trim()
    if (!userId) return fail('Missing user id')
    if (userId === me.id) return fail('You cannot delete your own account')

    const admin = createAdminClient()

    // Auth deletion. If the user was already removed from auth.users
    // (e.g. manual DB surgery) we continue to the profile cleanup.
    const { error: authErr } = await admin.auth.admin.deleteUser(userId)
    if (authErr && !/user.*not found/i.test(authErr.message)) {
      return fail(authErr.message)
    }

    // Best-effort explicit profile cleanup. Ignored if the auth delete
    // already cascaded it away.
    await admin.from('profiles').delete().eq('id', userId)

    revalidatePath('/admin/users')
    return ok('User deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function toggleDeactivateAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireAdmin()
    const userId = String(formData.get('userId') ?? '')
    const deactivate = String(formData.get('deactivate') ?? '') === 'true'
    if (!userId) return fail('Missing user id')
    if (userId === me.id && deactivate) return fail('You cannot deactivate yourself')

    const admin = createAdminClient()

    const { error: profErr } = await admin
      .from('profiles')
      .update({ deactivated_at: deactivate ? new Date().toISOString() : null })
      .eq('id', userId)
    if (profErr) return fail(profErr.message)

    // Also ban/unban in auth so the user can't actually sign in.
    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: deactivate ? '876000h' : 'none', // ~100y for "permanent" lockout
    })
    if (authErr) return fail(authErr.message)

    revalidatePath('/admin/users')
    return ok(deactivate ? 'User deactivated' : 'User reactivated')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
