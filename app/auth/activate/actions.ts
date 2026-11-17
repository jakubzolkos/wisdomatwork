'use server'

import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { markInvitationAccepted } from '@/lib/invitations/invite'

export type ActivateResult = { ok: true } | { ok: false; error: string }

/**
 * Completes activation by verifying the one-time invite token and
 * setting a real password for the now-authenticated user. The session
 * cookies are written by the server-side Supabase client during
 * verifyOtp, so by the time the client navigates away the user is
 * fully signed in.
 *
 * Failures fall into two buckets:
 *   - the token is missing/expired/already used (verifyOtp throws)
 *   - the password is rejected (length/complexity etc.)
 * Both are surfaced as friendly messages so the activation page can
 * render them without exposing internal error strings.
 */
export async function activateWithPasswordAction(args: {
  tokenHash: string
  type: EmailOtpType
  password: string
}): Promise<ActivateResult> {
  const tokenHash = args.tokenHash?.trim()
  const type = args.type
  const password = args.password ?? ''

  if (!tokenHash || !type) {
    return {
      ok: false,
      error:
        'This activation link is incomplete. On the sign-in page, choose "Set or reset your password" to get a new link.',
    }
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }

  const supabase = await createClient()

  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  })
  if (verifyErr) {
    return {
      ok: false,
      error:
        'This activation link is invalid or has expired. Use the email-code option below, or on the sign-in page choose "Set or reset your password" to get a new link.',
    }
  }

  const { error: updateErr } = await supabase.auth.updateUser({ password })
  if (updateErr) {
    return { ok: false, error: updateErr.message }
  }

  // Resolve the email from the freshly-established session so we
  // mark the right invitation row even if the link's `email` query
  // param was missing. Best-effort - never blocks the activation.
  try {
    const { data } = await supabase.auth.getUser()
    if (data.user?.email) {
      await markInvitationAccepted(data.user.email)
    }
  } catch (err) {
    console.log('[v0] post-activate accept marking failed', err)
  }

  return { ok: true }
}

/**
 * Server-action shim used by the login page after a successful
 * verify-OTP on the invite-code path. The OTP is already verified
 * client-side; this just updates the audit row so the admin sees
 * "Activated" instead of "Invited".
 */
export async function completeInviteCodeActivationAction(
  rawEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(rawEmail ?? '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'Missing email' }
  await markInvitationAccepted(email)
  return { ok: true }
}
