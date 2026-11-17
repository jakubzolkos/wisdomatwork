import { bodyToHtml, escapeHtml, firstNameOf, renderBaseLayout, renderCtaButton } from './base'

export type SchedulingInviteEmailArgs = {
  /** Display name to greet the recipient by. Falls back to "there". */
  fellowName?: string | null
  /** Title of the scheduling poll/meeting. */
  scheduleTitle: string
  /** URL to the voting/availability page. */
  votingUrl: string
}

export type RenderedSchedulingEmail = {
  subject: string
  html: string
  text: string
}

/**
 * Renders the scheduling availability invitation email sent to fellows.
 * Notifies them that they've been invited to set their availability for a meeting.
 */
export function renderSchedulingInviteEmail(
  args: SchedulingInviteEmailArgs,
): RenderedSchedulingEmail {
  const greeting = firstNameOf(args.fellowName) ?? 'there'
  const subject = `Action Required: Set Your Availability for "${escapeHtml(args.scheduleTitle)}"`

  const text = [
    `Hi ${greeting},`,
    '',
    `You've been invited to set your availability for: ${args.scheduleTitle}`,
    '',
    'Please follow the link below to indicate your available times. This helps us find the best time for everyone to meet.',
    '',
    args.votingUrl,
    '',
    "Once all participants have voted, you'll be notified of the confirmed meeting time.",
    '',
    'If you have any questions, reach out to the WaW team.',
  ].join('\n')

  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2937;">Hi ${escapeHtml(greeting)},</p>
    ${bodyToHtml(
      `You've been invited to set your availability for:\n\n${args.scheduleTitle}`,
    )}
    ${bodyToHtml(
      'Please click the button below to indicate your available times. This helps us find the best time for everyone to meet.',
    )}
    ${renderCtaButton('Set Your Availability', args.votingUrl)}
    ${bodyToHtml(
      'Once all participants have voted, you\'ll be notified of the confirmed meeting time.\n\nIf you have any questions, reach out to the WaW team.',
    )}
  `

  const html = renderBaseLayout(inner, {
    heading: 'Availability Needed',
    previewText: subject,
  })

  return { subject, html, text }
}

