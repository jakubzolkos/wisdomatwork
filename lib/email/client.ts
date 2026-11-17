import { Resend } from 'resend'

/**
 * Default sender for the WaW Fellows Portal. Resend's shared
 * `onboarding@resend.dev` works without domain verification but is
 * rate-limited and may only deliver to the email tied to your Resend
 * account. Override with EMAIL_FROM in production once the project's
 * sending domain is verified.
 */
export const DEFAULT_FROM =
  process.env.EMAIL_FROM ?? 'WaW Fellows Portal <onboarding@resend.dev>'

let cached: Resend | null = null

/**
 * Returns a memoized Resend client. Throws a clear error if the API
 * key is missing so callers don't have to special-case the env check.
 */
export function getResend(): Resend {
  if (cached) return cached
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it in the v0 Vars panel (and your Vercel project) to enable email sending.',
    )
  }
  cached = new Resend(apiKey)
  return cached
}

/**
 * True if the project has the API key configured. Use this to gate UI
 * (e.g. show a banner) without throwing.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export type EmailAttachment = {
  filename: string
  /** File contents. Text is sent as UTF-8. */
  content: string | Buffer
  contentType?: string
}

export type SendArgs = {
  to: string | string[]
  subject: string
  html: string
  text: string
  /** Optional override; falls back to DEFAULT_FROM. */
  from?: string
  replyTo?: string
  /**
   * Optional Resend tags. Useful for analytics filtering by
   * notification kind / invitation flow.
   */
  tags?: { name: string; value: string }[]
  /** Optional attachments, e.g. a calendar invite (.ics). */
  attachments?: EmailAttachment[]
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }

/**
 * Wraps `resend.emails.send` with consistent error normalization. We
 * never throw from this function: callers (cron jobs, server actions)
 * always want a structured result they can persist alongside the
 * notification recipient row.
 */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: args.from ?? DEFAULT_FROM,
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
      tags: args.tags,
      attachments: args.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? Buffer.from(a.content, 'utf-8') : a.content,
        contentType: a.contentType,
      })),
    })

    if (error) {
      return {
        ok: false,
        error: error.message ?? 'Resend returned an unspecified error',
      }
    }

    return { ok: true, id: data?.id ?? null }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    }
  }
}
