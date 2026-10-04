import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvitationEmail } from '@/lib/email/send'
import { isEmailConfigured } from '@/lib/email/client'
import { siteUrl } from '@/lib/site'
import type { Role } from '@/lib/roles'

export interface InvitePayload {
  email: string
  fullName: string
  title?: string | null
  role: Role
  /** cohort_id from the cohorts table (school team membership). */
  schoolTeamId?: string | null
  /** Cohort A/B/C - only valid for fellow role. */
  cohortLetter?: string | null
  /** Display name of the admin issuing the invite (for email body). */
  invitedByName?: string | null
  /** Optional cohort label shown in the invite email body. */
  cohortLabel?: string | null
  /** School profile fields to upsert when creating invitation. */
  schoolName?: string | null
  schoolDescription?: string | null
  schoolLocation?: string | null
  schoolContactEmail?: string | null
  schoolWebsiteUrl?: string | null
  schoolLogoUrl?: string | null
}

export interface InviteResult {
  ok: boolean
  email: string
  /** Invitation row id we persisted. */
  invitationId?: string
  /** Auth user id of the invitee, if known. */
  userId?: string
  /** The one-time link the recipient should click. */
  actionLink?: string
  /** Provider id from Resend, if email actually sent. */
  emailProviderId?: string | null
  /** True when this call created a new auth user. */
  isNewUser?: boolean
  message?: string
  error?: string
}

/**
 * Builds the URL we put in the invitation email's CTA button. The
 * recipient lands on /auth/activate where they pick how to finish
 * setting up their account. The token_hash + type pair lets the
 * activation page consume the invitation server-side via verifyOtp
 * if the user opts to set a password. The email is included so the
 * code-fallback path (which doesn't need the token) can issue a
 * fresh OTP for the same address.
 *
 * Note: this URL alone does NOT grant access. The recipient still has
 * to complete password creation OR enter a fresh 6-digit code on the
 * activation page.
 */
async function buildActivationUrl(args: {
  email: string
  tokenHash: string
  verificationType: 'invite' | 'magiclink'
}): Promise<string> {
  const params = new URLSearchParams({
    token_hash: args.tokenHash,
    type: args.verificationType,
    email: args.email,
    next: '/',
  })
  const url = await siteUrl(`/auth/activate?${params.toString()}`)
  if (!url) {
    throw new Error(
      'Cannot determine site URL for invitation link. Set NEXT_PUBLIC_SITE_URL.',
    )
  }
  return url
}

/**
 * Generates a one-time activation token for the recipient. Tries
 * `invite` first (creates the auth user), falling back to `magiclink`
 * for the resend-an-existing-user case. Returns the opaque token_hash
 * plus the verification_type, which the activation page passes to
 * verifyOtp if the user picks the password path.
 */
async function generateActivationToken(
  email: string,
  metadata: Record<string, unknown>,
): Promise<{
  tokenHash: string
  verificationType: 'invite' | 'magiclink'
  userId: string | undefined
  isNewUser: boolean
}> {
  const admin = createAdminClient()

  const inviteRes = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: metadata },
  })

  const inviteHash = inviteRes.data?.properties?.hashed_token
  const inviteType = inviteRes.data?.properties?.verification_type
  if (!inviteRes.error && inviteHash && inviteType) {
    return {
      tokenHash: inviteHash,
      verificationType: inviteType as 'invite' | 'magiclink',
      userId: inviteRes.data?.user?.id,
      isNewUser: true,
    }
  }

  // User most likely exists - reissue a magic-link token. This is the
  // resend-invite path. Magic-link tokens verify with type 'magiclink'.
  const magicRes = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  const magicHash = magicRes.data?.properties?.hashed_token
  const magicType = magicRes.data?.properties?.verification_type
  if (magicRes.error || !magicHash || !magicType) {
    throw new Error(
      magicRes.error?.message ??
        inviteRes.error?.message ??
        'Could not generate activation token',
    )
  }

  return {
    tokenHash: magicHash,
    verificationType: magicType as 'invite' | 'magiclink',
    userId: magicRes.data?.user?.id,
    isNewUser: false,
  }
}

/**
 * Persist a new invitation row (or update an existing one for the
 * same email). Captures everything we need to surface invite status
 * and retry from the admin UI.
 */
async function upsertInvitation(args: {
  email: string
  fullName: string | null
  title: string | null
  role: Role
  cohortLetter: string | null
  invitedBy: string
}) {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('invitations')
    .upsert(
      {
        email: args.email,
        full_name: args.fullName,
        title: args.title,
        role: args.role,
        cohort: args.cohortLetter,
        status: 'pending',
        invited_by: args.invitedBy,
        invited_at: now,
        last_sent_at: now,
        updated_at: now,
      },
      { onConflict: 'email' },
    )
    .select('id')
    .single<{ id: string }>()

  if (error) throw error
  return data?.id
}

async function markInvitationSent(
  invitationId: string,
  emailProviderId: string | null,
) {
  const admin = createAdminClient()
  await admin
    .from('invitations')
    .update({
      status: 'sent',
      email_provider_id: emailProviderId,
      last_sent_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
}

async function markInvitationFailed(invitationId: string, message: string) {
  const admin = createAdminClient()
  await admin
    .from('invitations')
    .update({
      status: 'failed',
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
}

async function attachUserId(invitationId: string, userId: string) {
  const admin = createAdminClient()
  await admin
    .from('invitations')
    .update({ supabase_user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', invitationId)
}

/**
 * Mark every still-open invitation for this email address as
 * accepted. Called from both activation paths once the recipient
 * finishes setup (password set, or 6-digit code verified). Only
 * touches rows in `pending` or `sent` so we never accidentally
 * downgrade a row that admin tooling has already moved out (e.g.
 * cancelled / expired).
 *
 * Best-effort: failures are swallowed because the user has already
 * been signed in by the time we call this; we don't want a stale
 * audit row to block their access. Errors are surfaced to logs.
 */
export async function markInvitationAccepted(rawEmail: string): Promise<void> {
  const email = String(rawEmail ?? '')
    .trim()
    .toLowerCase()
  if (!email) return

  const admin = createAdminClient()
  const now = new Date().toISOString()

  try {
    await admin
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq('email', email)
      .in('status', ['pending', 'sent'])
  } catch (err) {
    console.log('[v0] markInvitationAccepted failed', email, err)
  }
}

/**
 * Apply the invite-time profile metadata. The handle_new_user trigger
 * has already created the profiles row; we enrich it with title / role
 * / cohort, and (optionally) attach the user to a school team.
 */
async function applyProfileEnrichment(
  userId: string,
  payload: InvitePayload,
) {
  const admin = createAdminClient()

  // Phase 2: Resolve school_team_id from the schoolTeamId (which is now a school_teams.id from the UI).
  // Then set both school_team_id on profiles AND add to cohort_members for curriculum/session queries.
  let schoolTeamId: string | null = null

  if (payload.schoolTeamId) {
    // Callers pass either a school_teams.id or a cohorts.id (resend and
    // bulk invite pass the fellow's cohort_members.cohort_id), so match
    // on both. A cohorts row belongs to one school, so it maps to at
    // most one school_teams row.
    const { data: schoolTeam, error: stErr } = await admin
      .from('school_teams')
      .select('id, cohort_id')
      .or(`id.eq.${payload.schoolTeamId},cohort_id.eq.${payload.schoolTeamId}`)
      .limit(1)
      .maybeSingle<{ id: string; cohort_id: string }>()

    if (stErr) throw stErr
    if (schoolTeam) {
      schoolTeamId = schoolTeam.id

      // Add to cohort_members so curriculum queries still work
      const { error: memErr } = await admin
        .from('cohort_members')
        .insert({ cohort_id: schoolTeam.cohort_id, profile_id: userId })
      if (memErr && !/duplicate/i.test(memErr.message)) {
        throw memErr
      }
    }
  }

  const { error: profErr } = await admin
    .from('profiles')
    .update({
      full_name: payload.fullName,
      title: payload.title ?? null,
      role: payload.role,
      cohort: payload.role === 'fellow' ? payload.cohortLetter ?? null : null,
      // Only when a team was resolved: re-inviting an existing fellow
      // must never wipe the team they already have.
      ...(schoolTeamId ? { school_team_id: schoolTeamId } : {}),
    })
    .eq('id', userId)
  if (profErr) throw profErr
}

/**
 * Send a fully branded invitation: generates the magic link, persists
 * an invitations row, sends the email through Resend, and enriches
 * the new profile. Returns a structured result so callers can render
 * per-email feedback (e.g. bulk import).
 */
export async function sendBrandedInvite(
  payload: InvitePayload,
  invitedByProfileId: string,
): Promise<InviteResult> {
  const email = payload.email.trim().toLowerCase()
  if (!email) return { ok: false, email, error: 'Email is required' }

  let invitationId: string | undefined

  try {
    // Persist a pending row up front so even a downstream failure
    // (link generation, send) is observable and retriable.
    invitationId = await upsertInvitation({
      email,
      fullName: payload.fullName?.trim() || null,
      title: payload.title?.trim() || null,
      role: payload.role,
      cohortLetter:
        payload.role === 'fellow' ? payload.cohortLetter ?? null : null,
      invitedBy: invitedByProfileId,
    })

    const { tokenHash, verificationType, userId, isNewUser } =
      await generateActivationToken(email, {
        full_name: payload.fullName,
        role: payload.role,
      })
    const activationUrl = await buildActivationUrl({
      email,
      tokenHash,
      verificationType,
    })

    if (userId) {
      if (invitationId) await attachUserId(invitationId, userId)
      await applyProfileEnrichment(userId, payload)
    }

    if (!isEmailConfigured()) {
      // We have a working activation URL but cannot email it. Mark
      // the invitation as failed (so the admin sees why) and surface
      // the link in the result so it can be passed along manually.
      if (invitationId) {
        await markInvitationFailed(
          invitationId,
          'RESEND_API_KEY is not set; activation link generated but email not sent',
        )
      }
      return {
        ok: false,
        email,
        invitationId,
        userId,
        actionLink: activationUrl,
        isNewUser,
        error:
          'Email is not configured (RESEND_API_KEY missing). Copy the activation link manually.',
      }
    }

    const sendResult = await sendInvitationEmail(email, {
      recipientName: payload.fullName,
      activationUrl,
      invitedByName: payload.invitedByName,
      cohortLabel: payload.cohortLabel,
      // Supabase OTP/link TTL defaults to 1 hour. Match it in the
      // copy unless the project later overrides it in the Supabase
      // dashboard.
      expiresAtLabel: '1 hour',
    })

    if (!sendResult.ok) {
      if (invitationId) await markInvitationFailed(invitationId, sendResult.error)
      return {
        ok: false,
        email,
        invitationId,
        userId,
        actionLink: activationUrl,
        isNewUser,
        error: sendResult.error,
      }
    }

    if (invitationId) await markInvitationSent(invitationId, sendResult.id)

    return {
      ok: true,
      email,
      invitationId,
      userId,
      actionLink: activationUrl,
      emailProviderId: sendResult.id,
      isNewUser,
      message: isNewUser ? `Invite sent to ${email}` : `Invite resent to ${email}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown invite error'
    if (invitationId) {
      try {
        await markInvitationFailed(invitationId, message)
      } catch {
        // best-effort - already in error path
      }
    }
    return { ok: false, email, invitationId, error: message }
  }
}
