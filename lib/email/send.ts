import { sendEmail, type EmailAttachment, type SendResult } from './client'
import {
  renderInvitationEmail,
  type InvitationEmailArgs,
} from './templates/invitation'
import {
  renderNotificationEmail,
  type NotificationEmailArgs,
} from './templates/notification'
import {
  renderSignInCodeEmail,
  type SignInCodeEmailArgs,
} from './templates/sign-in-code'
import {
  renderPasswordSetupEmail,
  type PasswordSetupEmailArgs,
} from './templates/password-setup'

/**
 * High-level wrapper used by invite flows. Renders the branded
 * invitation template and dispatches via Resend, returning a
 * structured result the caller can persist on the invitation row.
 */
export async function sendInvitationEmail(
  to: string,
  args: InvitationEmailArgs,
): Promise<SendResult> {
  const { subject, html, text } = renderInvitationEmail(args)
  return sendEmail({
    to,
    subject,
    html,
    text,
    tags: [{ name: 'category', value: 'invitation' }],
  })
}

/**
 * Sends the "here is your sign-in code" email used by the
 * passwordless login flow. We keep this code-only (no magic link) so
 * the recipient must return to the open login tab and type the digits,
 * which is the explicit UX the admin asked for.
 */
export async function sendSignInCodeEmail(
  to: string,
  args: SignInCodeEmailArgs,
): Promise<SendResult> {
  const { subject, html, text } = renderSignInCodeEmail(args)
  return sendEmail({
    to,
    subject,
    html,
    text,
    tags: [{ name: 'category', value: 'sign-in-code' }],
  })
}

/**
 * Sends the "set or reset your password" email triggered from the
 * login page. Used both for first-time password setup (a fellow who
 * activated via email-code now wants a password) and for password
 * resets. The link goes to /auth/activate in password-only mode.
 */
export async function sendPasswordSetupEmail(
  to: string,
  args: PasswordSetupEmailArgs,
): Promise<SendResult> {
  const { subject, html, text } = renderPasswordSetupEmail(args)
  return sendEmail({
    to,
    subject,
    html,
    text,
    tags: [
      { name: 'category', value: 'password-setup' },
      { name: 'is_reset', value: args.isReset ? 'true' : 'false' },
    ],
  })
}

/**
 * High-level wrapper used by the notification dispatcher. One call
 * sends one personalized email; the dispatcher iterates per recipient
 * so we can persist provider IDs and errors per-row.
 */
export async function sendNotificationEmail(
  to: string,
  args: NotificationEmailArgs & { attachments?: EmailAttachment[] },
): Promise<SendResult> {
  const { subject, html, text } = renderNotificationEmail(args)
  return sendEmail({
    to,
    subject,
    html,
    text,
    attachments: args.attachments,
    tags: [
      { name: 'category', value: 'notification' },
      { name: 'kind', value: args.kind },
    ],
  })
}
