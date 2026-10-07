'use server'

import { revalidatePath } from 'next/cache'
import { put } from '@vercel/blob'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-server'

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

function ok(message: string): ActionResult {
  return { ok: true, message }
}
function fail(message: string): ActionResult {
  return { ok: false, message }
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

export async function createSchoolAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const name = String(formData.get('name') ?? '').trim()
    const iconFile = formData.get('icon') as File | null
    if (!name) return fail('Name is required')

    let iconUrl: string | null = null
    if (iconFile && iconFile.size > 0) {
      try {
        // Validate file size (5MB max)
        if (iconFile.size > 5 * 1024 * 1024) {
          return fail('Icon file must be less than 5 MB')
        }

        // Validate MIME type
        const validTypes = ['image/png', 'image/jpeg', 'image/webp']
        if (!validTypes.includes(iconFile.type)) {
          return fail('Icon must be PNG, JPG, or WebP')
        }

        const blob = await put(`schools/${name}-${Date.now()}`, iconFile, {
          access: 'public',
        })
        iconUrl = blob.url
      } catch (blobErr) {
        return fail(`Failed to upload icon: ${blobErr instanceof Error ? blobErr.message : 'Unknown error'}`)
      }
    }

    const admin = createAdminClient()
    const { error } = await admin.from('schools').insert({ name, icon_url: iconUrl })
    if (error) return fail(error.message)

    revalidatePath('/admin/schools')
    return ok(`Added ${name}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function renameSchoolAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = String(formData.get('id') ?? '')
    const name = String(formData.get('name') ?? '').trim()
    if (!id) return fail('Missing id')
    if (!name) return fail('Name is required')

    const admin = createAdminClient()
    const { error } = await admin.from('schools').update({ name }).eq('id', id)
    if (error) return fail(error.message)

    revalidatePath('/admin/schools')
    return ok('School renamed')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function deleteSchoolAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = String(formData.get('id') ?? '')
    if (!id) return fail('Missing id')

    const admin = createAdminClient()

    // Guard: refuse if anyone is still assigned here.
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', id)
    if ((count ?? 0) > 0) {
      return fail('Move or remove members before deleting this school')
    }

    const { error } = await admin.from('schools').delete().eq('id', id)
    if (error) return fail(error.message)

    revalidatePath('/admin/schools')
    return ok('School deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

// ---------------------------------------------------------------------------
// Cohorts (a.k.a. school teams)
//
// A team is two rows: the legacy `cohorts` row (memberships hang off it)
// and its `school_teams` row (057), which this page and fellows'
// profiles read. Create and rename keep both; deleting the cohort
// cascades to the school team and clears fellows' links.
// ---------------------------------------------------------------------------

export async function createCohortAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const schoolId = String(formData.get('schoolId') ?? '')
    const name = String(formData.get('name') ?? '').trim()
    const currentYear = Math.max(
      1,
      Math.min(3, Number(formData.get('currentYear') ?? 1)),
    )
    if (!schoolId) return fail('Missing school')
    if (!name) return fail('Team name is required')

    const admin = createAdminClient()
    const { data: cohort, error } = await admin
      .from('cohorts')
      .insert({ school_id: schoolId, name, current_year: currentYear })
      .select('id')
      .single()
    if (error || !cohort) return fail(error?.message ?? 'Could not create the team')

    const { error: teamError } = await admin
      .from('school_teams')
      .insert({ school_id: schoolId, cohort_id: cohort.id, name })
    if (teamError) {
      // Don't leave a half-made team behind.
      await admin.from('cohorts').delete().eq('id', cohort.id)
      return fail(teamError.message)
    }

    revalidatePath('/admin/schools')
    return ok(`Added ${name}`)
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function updateCohortAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = String(formData.get('id') ?? '')
    const name = String(formData.get('name') ?? '').trim()
    const currentYear = Math.max(
      1,
      Math.min(3, Number(formData.get('currentYear') ?? 1)),
    )
    if (!id) return fail('Missing id')
    if (!name) return fail('Team name is required')

    const admin = createAdminClient()
    const { error } = await admin
      .from('cohorts')
      .update({ name, current_year: currentYear })
      .eq('id', id)
    if (error) return fail(error.message)
    const { error: teamError } = await admin.from('school_teams').update({ name }).eq('cohort_id', id)
    if (teamError) return fail(teamError.message)

    revalidatePath('/admin/schools')
    return ok('Team updated')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function deleteCohortAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = String(formData.get('id') ?? '')
    if (!id) return fail('Missing id')

    const admin = createAdminClient()
    // Remove memberships first (no cascade on this FK).
    const { error: delMemErr } = await admin
      .from('cohort_members')
      .delete()
      .eq('cohort_id', id)
    if (delMemErr) return fail(delMemErr.message)

    const { error } = await admin.from('cohorts').delete().eq('id', id)
    if (error) return fail(error.message)

    revalidatePath('/admin/schools')
    return ok('Team deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function addMemberAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    // The add-member form sends the team's cohort id; accept either id.
    const schoolTeamId = String(formData.get('schoolTeamId') ?? '')
    const cohortId = String(formData.get('cohortId') ?? '')
    const profileId = String(formData.get('profileId') ?? '')
    if ((!schoolTeamId && !cohortId) || !profileId) return fail('Missing school team or profile')

    const admin = createAdminClient()

    const { data: schoolTeam, error: stErr } = await admin
      .from('school_teams')
      .select('id, cohort_id, school_id')
      .eq(schoolTeamId ? 'id' : 'cohort_id', schoolTeamId || cohortId)
      .maybeSingle()
    if (stErr || !schoolTeam) return fail(stErr?.message ?? 'Team not found')

    // One team per fellow (as on the Users page): leave any other team.
    const { error: leaveErr } = await admin.from('cohort_members').delete().eq('profile_id', profileId)
    if (leaveErr) return fail(leaveErr.message)
    const { error: memErr } = await admin
      .from('cohort_members')
      .insert({ cohort_id: schoolTeam.cohort_id, profile_id: profileId })
    if (memErr) return fail(memErr.message)

    // Set school_team_id on profile (and school_id for backward compatibility)
    const { error: profErr } = await admin
      .from('profiles')
      .update({ school_team_id: schoolTeam.id, school_id: schoolTeam.school_id })
      .eq('id', profileId)
    if (profErr) return fail(profErr.message)

    revalidatePath('/admin/schools')
    return ok('Added to team')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function removeMemberAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const cohortId = String(formData.get('cohortId') ?? '')
    const profileId = String(formData.get('profileId') ?? '')
    if (!cohortId || !profileId) return fail('Missing cohort or profile')

    const admin = createAdminClient()
    const { error } = await admin
      .from('cohort_members')
      .delete()
      .eq('cohort_id', cohortId)
      .eq('profile_id', profileId)
    if (error) return fail(error.message)

    // Clear the profile's team link too, or the fellow still counts as
    // on this team (profile, team progress) and can't be re-added.
    const { data: schoolTeam } = await admin
      .from('school_teams')
      .select('id')
      .eq('cohort_id', cohortId)
      .maybeSingle()
    if (schoolTeam) {
      const { error: profErr } = await admin
        .from('profiles')
        .update({ school_team_id: null })
        .eq('id', profileId)
        .eq('school_team_id', schoolTeam.id)
      if (profErr) return fail(profErr.message)
    }

    revalidatePath('/admin/schools')
    return ok('Removed from team')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
