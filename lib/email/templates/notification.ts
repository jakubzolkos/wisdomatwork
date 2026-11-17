import { bodyToHtml, escapeHtml, firstNameOf, renderBaseLayout, renderCtaButton } from './base'

// Kept importable from here for existing callers; it lives in ./base so every template can use it.
export { firstNameOf }
import type { RenderedEmail } from './invitation'

export type NotificationKind = 'announcement' | 'reminder' | 'alert'

export type NotificationEmailArgs = {
  recipientName?: string | null
  kind: NotificationKind
  /** Notification title (also used as default subject). */
  title: string
  /** Plain-text body. Paragraph breaks are preserved. */
  body: string
  /** Optional CTA button. */
  ctaLabel?: string | null
  ctaUrl?: string | null
  /** Absolute URL back to the portal feed (rendered as a secondary link). */
  portalUrl?: string | null
  /** Optional explicit subject override. Defaults to a kind-specific prefix. */
  subjectOverride?: string | null
  /** Optional footer note shown below the body, e.g. audience scope. */
  footerNote?: string | null
  /**
   * Add "Hi <first name>," above the message. Defaults to true; turned off
   * when the author wrote their own greeting with a name merge field.
   */
  autoGreeting?: boolean
}

const KIND_LABEL: Record<NotificationKind, string> = {
  announcement: 'Announcement',
  reminder: 'Reminder',
  alert: 'Alert',
}

const KIND_BADGE_BG: Record<NotificationKind, string> = {
  announcement: '#0f172a',
  reminder: '#1e3a8a',
  alert: '#b91c1c',
}

/**
 * Renders the standard cohort/global notification email used by the
 * dispatcher. Maps 1:1 with what the recipient sees in their in-app
 * notifications feed so there is one consistent message surface.
 */
export function renderNotificationEmail(
  args: NotificationEmailArgs,
): RenderedEmail {
  const kindLabel = KIND_LABEL[args.kind]
  const subject =
    args.subjectOverride?.trim() ||
    (args.kind === 'announcement' ? args.title : `[${kindLabel}] ${args.title}`)

  const greeting = firstNameOf(args.recipientName) ?? 'there'

  const showGreeting = args.autoGreeting !== false
  const textLines: string[] = [
    ...(showGreeting ? [`Hi ${greeting},`, ''] : []),
    args.body.trim(),
  ]
  if (args.ctaLabel && args.ctaUrl) {
    textLines.push('', `${args.ctaLabel}: ${args.ctaUrl}`)
  }
  if (args.portalUrl) {
    textLines.push('', `View in portal: ${args.portalUrl}`)
  }
  const text = textLines.join('\n')

  const cta =
    args.ctaLabel && args.ctaUrl ? renderCtaButton(args.ctaLabel, args.ctaUrl) : ''

  const portalLink = args.portalUrl
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">Or <a href="${escapeHtml(
        args.portalUrl,
      )}" style="color:#0f172a;text-decoration:underline;">view this in the portal</a>.</p>`
    : ''

  const inner = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
      <tr>
        <td bgcolor="${KIND_BADGE_BG[args.kind]}" style="border-radius:999px;padding:4px 12px;">
          <span style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;font-weight:600;">${escapeHtml(
            kindLabel,
          )}</span>
        </td>
      </tr>
    </table>
    <h2 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a;font-weight:600;">${escapeHtml(
      args.title,
    )}</h2>
    ${
      showGreeting
        ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">Hi ${escapeHtml(
            greeting,
          )},</p>`
        : ''
    }
    ${bodyToHtml(args.body)}
    ${cta}
    ${portalLink}
  `

  const html = renderBaseLayout(inner, {
    heading: kindLabel,
    previewText: args.title,
    footerNote: args.footerNote ?? undefined,
  })

  return { subject, html, text }
}
