import { escapeHtml, firstNameOf, renderBaseLayout } from './base'

export type SignInCodeEmailArgs = {
  /** Display name to greet the recipient by. Falls back to "there". */
  recipientName?: string | null
  /** The 6-digit one-time code the recipient will type into the login form. */
  code: string
  /** Friendly expiry label, e.g. "10 minutes". Defaults to a sensible string. */
  expiresInLabel?: string
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

/**
 * Renders the "here is your sign-in code" email. Intentionally
 * code-only - no magic link - so the user must come back to the login
 * tab and type the digits. This avoids the surprise users hit when
 * Supabase's default magiclink template ships both, because clicking
 * the link bypasses the code UI entirely.
 */
export function renderSignInCodeEmail(args: SignInCodeEmailArgs): RenderedEmail {
  const greeting = firstNameOf(args.recipientName) ?? 'there'
  const expires = args.expiresInLabel?.trim() || '1 hour'
  const subject = `Your WaW Fellows Portal sign-in code: ${args.code}`

  const text = [
    `Hi ${greeting},`,
    '',
    'Use the code below to finish signing in to the WaW Fellows Portal:',
    '',
    `    ${args.code}`,
    '',
    `This code expires in ${expires}. If you did not request it, you can safely ignore this email.`,
  ].join('\n')

  // Big, monospaced, letter-spaced code block. Email clients ignore
  // most CSS, so we keep this to inline styles only.
  const codeBlock = `
    <div style="margin:24px 0;padding:20px 24px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;text-align:center;">
      <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;letter-spacing:8px;font-weight:600;color:#0f172a;">
        ${escapeHtml(args.code)}
      </div>
    </div>
  `

  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">Hi ${escapeHtml(
      greeting,
    )},</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#1f2937;">
      Use the code below to finish signing in to the WaW Fellows Portal.
    </p>
    ${codeBlock}
    <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#6b7280;">
      This code expires in ${escapeHtml(expires)}.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
      If you did not request it, you can safely ignore this email.
    </p>
  `

  const html = renderBaseLayout(inner, {
    heading: 'Your sign-in code',
    previewText: `Your sign-in code is ${args.code}`,
  })

  return { subject, html, text }
}
