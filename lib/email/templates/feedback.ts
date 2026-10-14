import { bodyToHtml, escapeHtml, renderBaseLayout } from './base'

export const FEEDBACK_KINDS = {
  feedback: 'Feedback',
  problem: 'Problem',
  question: 'Question',
} as const

export type FeedbackKind = keyof typeof FEEDBACK_KINDS

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FEEDBACK_KINDS, value)
}

export type FeedbackEmailArgs = {
  kind: FeedbackKind
  message: string
  name: string
  email: string
  cohort: string | null
  school: string | null
  researchId: string | null
  /** Portal path the fellow was on when they wrote it. */
  page: string | null
  appUrl: string | null
}

/**
 * The email the WaW team gets when a fellow uses the feedback button.
 * Replies go to the fellow (reply-to is set by the sender).
 */
export function renderFeedbackEmail(args: FeedbackEmailArgs) {
  const label = FEEDBACK_KINDS[args.kind]
  const subject = `[Fellows Portal] ${label} from ${args.name}`
  const pageUrl = args.page ? `${args.appUrl ?? ''}${args.page}` : null

  const details: Array<[string, string]> = [
    ['From', `${args.name} <${args.email}>`],
    ...(args.cohort ? ([['Cohort', args.cohort]] as Array<[string, string]>) : []),
    ...(args.school ? ([['School', args.school]] as Array<[string, string]>) : []),
    ...(args.researchId ? ([['Unique ID', args.researchId]] as Array<[string, string]>) : []),
    ...(pageUrl ? ([['Page', pageUrl]] as Array<[string, string]>) : []),
  ]

  const rows = details
    .map(
      ([k, v]) =>
        `<tr><td style="padding:2px 12px 2px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">${escapeHtml(
          k,
        )}</td><td style="padding:2px 0;font-size:13px;color:#1f2937;">${escapeHtml(v)}</td></tr>`,
    )
    .join('')

  const html = renderBaseLayout(
    `${bodyToHtml(args.message)}
<table role="presentation" style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:12px;border-collapse:collapse;">${rows}</table>
<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Reply to this email to answer ${escapeHtml(args.name)} directly.</p>`,
    { heading: `${label} from a fellow`, previewText: args.message.slice(0, 120) },
  )

  const text = [
    `${label} from ${args.name}`,
    '',
    args.message,
    '',
    ...details.map(([k, v]) => `${k}: ${v}`),
    '',
    `Reply to this email to answer ${args.name} directly.`,
  ].join('\n')

  return { subject, html, text }
}
