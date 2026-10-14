'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendSignInCodeEmail, sendPasswordSetupEmail } from '@/lib/email/send'
import { issueLoginCode, verifyLoginCode } from '@/lib/auth/email-login-code'
import { markInvitationAccepted } from '@/lib/invitations/invite'
import { siteUrl } from '@/lib/site'
import { EMAIL_LINK_EXPIRY_LABEL } from '@/lib/auth/link-expiry'

export type SendCodeResult =
  | { ok: true; email: string }
  | { ok: false; error: string }

/**
 * Issues a fresh 6-digit numeric sign-in code and emails it via Resend.
 *
 * Uses our own `email_login_codes` table (see lib/auth/email-login-code.ts)
 * instead of `admin.generateLink({ type: 'magiclink' })`. That older
 * approach had two problems:
 *
 *   1. Supabase's `email_otp` length is project-configurable, so we
 *      could end up emailing 8 digits when the spec demands 6.
 *   2. `generateLink` also returns an action_link AND auto-confirms
 *      the user's email server-side. Combined with the proxy that
 *      redirects authenticated users away from /auth/login, that was
 *      the source of the "fellow gets logged in immediately after
 *      requesting a code" bug. Our own helper has no such side
 *      effects: nothing about the user's auth state changes until the
 *      code is verified by `verifyEmailLoginCodeAction`.
 *
 * The portal is invite-only, so we first confirm the email matches a
 * known profile and refuse otherwise.
 */
export async function requestSignInCodeAction(
  rawEmail: string,
): Promise<SendCodeResult> {
  const email = String(rawEmail ?? '').trim().toLowerCase()
  if (!email) {
    return { ok: false, error: 'Enter your program email to receive a code.' }
  }

  try {
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('email', email)
      .maybeSingle<{ email: string | null; full_name: string | null }>()

    if (!profile) {
      return {
        ok: false,
        error:
          "We couldn't find an account for that email. Check the address or contact the WaW team.",
      }
    }

    const { code } = await issueLoginCode(email)

    const sendResult = await sendSignInCodeEmail(email, {
      recipientName: profile.full_name,
      code,
      expiresInLabel: '10 minutes',
    })
    if (!sendResult.ok) {
      return { ok: false, error: sendResult.error }
    }

    return { ok: true, email }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export type VerifyCodeResult = { ok: true } | { ok: false; error: string }

/**
 * Verifies the 6-digit code the user typed. On success:
 *   1. Marks our own code row as used (single-use).
 *   2. Mints a Supabase session via `admin.generateLink` +
 *      `verifyOtp` on the cookie-aware server client, so the response
 *      carries the auth cookies. This keeps the rest of the platform
 *      (RLS, getUser, etc.) working unchanged - the user IS a real
 *      Supabase session-bearer once this succeeds.
 *   3. If the verification was the activation step for an invited
 *      fellow, flips the `invitations` row to "accepted" so admin
 *      tooling reflects the change.
 *
 * Notes:
 *   - We only call `admin.generateLink` AFTER a successful code
 *     match. The user does not gain any auth state from merely
 *     requesting a code - that was the "immediate login" bug.
 *   - `verifyOtp({ type: 'magiclink', token_hash })` doesn't email
 *     anything; it just exchanges the freshly minted hash for a
 *     session on the response.
 */
export async function verifyEmailLoginCodeAction(
  rawEmail: string,
  rawCode: string,
  opts?: { fromInvite?: boolean },
): Promise<VerifyCodeResult> {
  const email = String(rawEmail ?? '').trim().toLowerCase()
  const code = String(rawCode ?? '').trim()
  if (!email) return { ok: false, error: 'Email is required.' }
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: 'Enter the 6-digit code from your email.' }
  }

  const result = await verifyLoginCode(email, code)
  if (!result.ok) {
    const msg =
      result.reason === 'expired'
        ? 'That code has expired. Request a new one.'
        : result.reason === 'missing'
          ? 'No active code for this email. Request a new one.'
          : 'That code is incorrect. Try again or request a new one.'
    return { ok: false, error: msg }
  }

  // Mint a Supabase session on top of the verified code.
  const admin = createAdminClient()
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkErr || !tokenHash) {
    return {
      ok: false,
      error: linkErr?.message ?? 'Could not establish session. Try again.',
    }
  }

  const supabase = await createClient()
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (verifyErr) return { ok: false, error: verifyErr.message }

  if (opts?.fromInvite) {
    try {
      await markInvitationAccepted(email)
    } catch {
      // Audit-only: must not block sign-in.
    }
  }

  return { ok: true }
}

export type PasswordSetupRequestResult =
  | { ok: true; email: string; isReset: boolean }
  | { ok: false; error: string }

/**
 * Sends the "set or reset your password" email triggered from the
 * login page. Two cases share this entry point:
 *
 *   1. A fellow who originally activated via email-code wants to add
 *      a password so they can sign in without a one-time code.
 *   2. Anyone (admin or fellow) has forgotten their password.
 *
 * In both cases we mint a one-time recovery link via
 * `admin.generateLink({ type: 'recovery' })` and email a CTA that
 * lands the recipient on /auth/activate in password-only mode. The
 * activate page already handles `type=recovery` correctly via
 * `verifyOtp` in `activateWithPasswordAction`.
 *
 * Security choices:
 *   - The portal is invite-only, so we ALWAYS confirm the email
 *     matches a known profile. Unknown emails get a generic friendly
 *     "if an account exists..." message so we don't leak which
 *     emails are registered.
 *   - The recovery link itself never auto-signs the user in. The
 *     activate page enforces that the user must set a password
 *     before any session is minted.
 */
export async function requestPasswordSetupAction(
  rawEmail: string,
): Promise<PasswordSetupRequestResult> {
  const email = String(rawEmail ?? '').trim().toLowerCase()
  if (!email) {
    return { ok: false, error: 'Enter your program email to continue.' }
  }

  try {
    const admin = createAdminClient()

    // Look up the profile. If we can't find one, return ok=true with
    // a generic "check your inbox" framing so we don't disclose which
    // emails are registered. The UI surfaces the same success message
    // either way.
    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('email', email)
      .maybeSingle<{ email: string | null; full_name: string | null }>()

    if (!profile) {
      // Generic success - do NOT reveal that the account doesn't
      // exist. The recipient will simply not get an email.
      return { ok: true, email, isReset: false }
    }

    // Determine whether the user already has a password so the email
    // copy / subject can read "Reset" vs "Set up". This is just a UX
    // hint - the underlying flow is identical.
    let isReset = false
    try {
      const { data: list } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      })
      // listUsers doesn't filter by email; fall back to searching
      // across the small page. For larger projects this should call
      // a dedicated `getUserByEmail`-style helper, but our directory
      // is small enough that scanning the first page is fine.
      const user = list?.users.find(
        (u) => (u.email ?? '').toLowerCase() === email,
      )
      // Supabase doesn't expose "has password" directly, but
      // `user.identities` containing one with provider 'email' is a
      // reliable proxy: an email/password account always has it.
      // Users that only signed in via OTP / magic-link will still
      // have an 'email' identity created on first verifyOtp, so this
      // isn't 100% accurate. We use `last_sign_in_at` + `created_at`
      // as a softer signal: if they've EVER signed in we treat it as
      // a reset. Worst-case the subject just says "Reset" instead of
      // "Set up" - functionally identical.
      if (user?.last_sign_in_at) isReset = true
    } catch {
      // Best-effort. Default to "set up" framing if listUsers fails.
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })
    const tokenHash = linkData?.properties?.hashed_token
    if (linkErr || !tokenHash) {
      return {
        ok: false,
        error:
          linkErr?.message ??
          'Could not generate a password setup link. Try again in a moment.',
      }
    }

    // Build the activate URL. `mode=password-only` tells the activate
    // page to hide the "Email me a code" option since the recipient
    // explicitly asked for a password.
    const params = new URLSearchParams({
      token_hash: tokenHash,
      type: 'recovery',
      email,
      mode: 'password-only',
      next: '/',
    })
    const passwordSetupUrl = await siteUrl(`/auth/activate?${params.toString()}`)
    if (!passwordSetupUrl) {
      return {
        ok: false,
        error:
          'Site URL is not configured. Set NEXT_PUBLIC_SITE_URL on the deployment.',
      }
    }

    const sendResult = await sendPasswordSetupEmail(email, {
      recipientName: profile.full_name,
      passwordSetupUrl,
      expiresAtLabel: EMAIL_LINK_EXPIRY_LABEL,
      isReset,
    })
    if (!sendResult.ok) return { ok: false, error: sendResult.error }

    return { ok: true, email, isReset }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
