import { bodyToHtml, escapeHtml, renderBaseLayout, renderCtaButton } from './base'
import { EMAIL_LINK_EXPIRY_LABEL } from '@/lib/auth/link-expiry'

export type PasswordSetupEmailArgs = {
  /** Display name to greet the recipient by. Falls back to "there". */
  recipientName?: string | null
  /**
   * URL of the /auth/activate page (in password-only mode) carrying
   * a one-time recovery token in the query string. Clicking the CTA
   * lets the recipient set a new password and be signed in.
   *
   * IMPORTANT: this URL is single-use. Once the recipient sets a
   * password, the token is consumed.
   */
  passwordSetupUrl: string
  /** Optional friendly link expiry (e.g. "in 1 hour"). */
  expiresAtLabel?: string | null
  /**
   * Whether this user already has a password (true) or is setting
   * one for the first time (false). Drives subject + copy so the
   * email reads naturally either way.
   */
  isReset: boolean
}

export type RenderedPasswordSetupEmail = {
  subject: string
  html: string
  text: string
}

/**
 * Renders the "set or reset your password" email triggered from the
 * login page. Used for two cases:
 *
 *   1. A fellow who originally activated via email-code wants to add
 *      a password so they can sign in without a one-time code.
 *   2. Anyone (admin or fellow) who has forgotten their password.
 *
 * Both cases use the same template - only the subject + intro copy
 * differ. The link lands the recipient on /auth/activate in
 * password-only mode where they set a password and are signed in.
 */
export function renderPasswordSetupEmail(
  args: PasswordSetupEmailArgs,
): RenderedPasswordSetupEmail {
  const greeting = args.recipientName?.trim() ? args.recipientName.trim() : 'there'
  const expires = args.expiresAtLabel?.trim() || EMAIL_LINK_EXPIRY_LABEL
  const isReset = args.isReset

  const subject = isReset
    ? 'Reset your WaW Fellows Portal password'
    : 'Set up your WaW Fellows Portal password'

  const heading = isReset ? 'Reset your password' : 'Set up your password'

  const intro = isReset
    ? 'You asked to reset your WaW Fellows Portal password.'
    : 'You asked to set up a password for your WaW Fellows Portal account so you can sign in without a one-time code.'

  const followup = isReset
    ? 'Click the button below to choose a new password. The link expires shortly for your security.'
    : "Click the button below to choose a password. After that, you'll be able to sign in with either your password OR a one-time email code - whichever you prefer."

  const expiresLine = `This link expires in ${expires}. If it expires before you finish, request a new one from the sign-in page.`

  const text = [
    `Hi ${greeting},`,
    '',
    intro,
    followup,
    '',
    args.passwordSetupUrl,
    '',
    expiresLine,
    '',
    "If you didn't request this, you can safely ignore this email - your account stays unchanged.",
  ].join('\n')

  const ctaLabel = isReset ? 'Reset your password' : 'Set up your password'

  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">Hi ${escapeHtml(
      greeting,
    )},</p>
    ${bodyToHtml(intro)}
    ${bodyToHtml(followup)}
    ${renderCtaButton(ctaLabel, args.passwordSetupUrl)}
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#0f172a;word-break:break-all;"><a href="${escapeHtml(
      args.passwordSetupUrl,
    )}" style="color:#0f172a;">${escapeHtml(args.passwordSetupUrl)}</a></p>
    <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#6b7280;">${escapeHtml(
      expiresLine,
    )}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">If you didn&apos;t request this, you can safely ignore this email &mdash; your account stays unchanged.</p>
  `

  const html = renderBaseLayout(inner, {
    heading,
    previewText: subject,
  })

  return { subject, html, text }
}
