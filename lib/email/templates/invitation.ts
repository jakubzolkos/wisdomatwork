import { bodyToHtml, escapeHtml, renderBaseLayout, renderCtaButton } from './base'
import { EMAIL_LINK_EXPIRY_LABEL } from '@/lib/auth/link-expiry'

export type InvitationEmailArgs = {
  /** Display name to greet the recipient by. Falls back to "there". */
  recipientName?: string | null
  /**
   * URL of the /auth/activate page with the one-time activation token
   * encoded in the query string. Clicking the CTA opens the activation
   * page where the recipient picks how to sign in (password or
   * one-time code). The token alone does NOT grant access - they have
   * to complete one of those flows.
   */
  activationUrl: string
  /** Optional friendly link expiry (e.g. "in 1 hour"). */
  expiresAtLabel?: string | null
  /** Name of the admin who issued the invite, shown in the body. */
  invitedByName?: string | null
  /** Optional cohort name shown in the body to give context. */
  cohortLabel?: string | null
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

/**
 * Renders the invitation email shown to a newly invited fellow.
 *
 * The email is intentionally link-only. There's no 6-digit code in
 * the body - the link takes the recipient to /auth/activate, where
 * they explicitly choose between setting a password or having a
 * sign-in code emailed. Either path then completes activation. This
 * matches the product requirement that the code is only sent if the
 * user opts into email verification, not blasted out at invite time.
 */
export function renderInvitationEmail(args: InvitationEmailArgs): RenderedEmail {
  const greeting = args.recipientName?.trim() ? args.recipientName.trim() : 'there'
  const invitedBy = args.invitedByName?.trim()
  const cohort = args.cohortLabel?.trim()
  const expires = args.expiresAtLabel?.trim() || EMAIL_LINK_EXPIRY_LABEL

  const subject = 'Activate your WaW Fellows Portal account'

  const intro = invitedBy
    ? `${invitedBy} has invited you to join the WaW Fellows Portal.`
    : `You have been invited to join the WaW Fellows Portal.`

  const cohortLine = cohort ? `You will join as part of ${cohort}.` : ''

  const expiresLine = `This activation link expires in ${expires}. If it expires before you finish, ask the WaW team to resend your invitation.`

  const text = [
    `Hi ${greeting},`,
    '',
    intro,
    cohortLine,
    '',
    'Activate your account here:',
    args.activationUrl,
    '',
    "Once you click the link you'll choose how to sign in - either set a password, or have a 6-digit code emailed to you. Both options finish account setup.",
    '',
    expiresLine,
    '',
    "If you weren't expecting this email, you can safely ignore it.",
  ]
    .filter((line) => line !== null)
    .join('\n')

  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">Hi ${escapeHtml(
      greeting,
    )},</p>
    ${bodyToHtml([intro, cohortLine].filter(Boolean).join('\n\n'))}
    ${bodyToHtml(
      "Click the button below to activate your account. On the next page you'll choose how you want to sign in - either set a password, or have a 6-digit code emailed to you each time.",
    )}
    ${renderCtaButton('Activate your account', args.activationUrl)}
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;">If the button does not work, copy and paste this link into your browser:</p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#0f172a;word-break:break-all;"><a href="${escapeHtml(
      args.activationUrl,
    )}" style="color:#0f172a;">${escapeHtml(args.activationUrl)}</a></p>
    <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#6b7280;">${escapeHtml(
      expiresLine,
    )}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">If you weren&apos;t expecting this email, you can safely ignore it.</p>
  `

  const html = renderBaseLayout(inner, {
    heading: 'Your invitation is ready',
    previewText: subject,
  })

  return { subject, html, text }
}
