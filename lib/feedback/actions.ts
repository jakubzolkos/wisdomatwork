'use server'

import { cookies } from 'next/headers'
import { getSessionUser, requireUser } from '@/lib/auth-server'
import { sendEmail } from '@/lib/email/client'
import { isFeedbackKind, renderFeedbackEmail } from '@/lib/email/templates/feedback'
import { getResearchId } from '@/lib/research-id'
import { getSiteOrigin } from '@/lib/site'

/** Where fellows' feedback goes (override with FEEDBACK_EMAIL). */
const FEEDBACK_TO = process.env.FEEDBACK_EMAIL ?? 'waw@abigailadamsinstitute.org'
const MAX_LENGTH = 5000
/** One message per 30 seconds per browser, against double sends and spam. */
const COOLDOWN_MS = 30_000
const COOLDOWN_COOKIE = 'waw_feedback_sent_at'

export type FeedbackResult = { ok: true } | { ok: false; message: string }

/**
 * Feedback button (components/feedback/feedback-button.tsx): emails the
 * WaW team with who sent it and from which page; replies go to the
 * sender. Staff can send too, always as themselves.
 */
export async function sendFeedback(formData: FormData): Promise<FeedbackResult> {
  try {
    const user = await requireUser()
    // In "Preview as a fellow" the user is the previewed fellow; the
    // message goes out as the admin actually signed in instead, so
    // nothing is ever sent in a fellow's name.
    const real = user.preview ? await getSessionUser() : null
    if (user.preview && !real) return { ok: false, message: 'Please sign in again.' }

    const kind = formData.get('kind')
    const message = String(formData.get('message') ?? '').trim()
    const page = String(formData.get('page') ?? '').trim()
    if (!isFeedbackKind(kind)) return { ok: false, message: 'Choose what kind of message this is.' }
    if (message.length < 3) return { ok: false, message: 'Write a few words first.' }
    if (message.length > MAX_LENGTH) {
      return { ok: false, message: `Please keep it under ${MAX_LENGTH.toLocaleString()} characters.` }
    }

    const jar = await cookies()
    const last = Number(jar.get(COOLDOWN_COOKIE)?.value ?? 0)
    if (Date.now() - last < COOLDOWN_MS) {
      return { ok: false, message: 'You just sent a message. Please wait a moment before sending another.' }
    }

    const sender = user.preview
      ? {
          name: `${user.preview.actualAdminName} (staff, previewing as ${user.preview.label})`,
          email: real!.email,
          cohort: null,
          school: null,
          researchId: null,
        }
      : {
          name: user.role === 'fellow' ? user.fullName : `${user.fullName} (staff)`,
          email: user.email,
          cohort: user.cohort ? `Cohort ${user.cohort}` : null,
          school: user.schoolName || null,
          researchId: user.role === 'fellow' ? await getResearchId(user.id) : null,
        }
    const appUrl = await getSiteOrigin()
    const email = renderFeedbackEmail({
      kind,
      message,
      ...sender,
      // Only a portal path, never an outside URL.
      page: page.startsWith('/') ? page.slice(0, 300) : null,
      appUrl,
    })
    const sent = await sendEmail({
      to: FEEDBACK_TO,
      replyTo: sender.email || undefined,
      ...email,
      tags: [
        { name: 'category', value: 'feedback' },
        { name: 'kind', value: kind },
      ],
    })
    if (!sent.ok) {
      console.error('Feedback email failed:', sent.error)
      return { ok: false, message: 'It didn’t send. Please try again, or email waw@abigailadamsinstitute.org.' }
    }

    jar.set(COOLDOWN_COOKIE, String(Date.now()), { httpOnly: true, sameSite: 'lax', maxAge: 60, path: '/' })
    return { ok: true }
  } catch (e) {
    console.error('Feedback failed:', e)
    return { ok: false, message: 'It didn’t send. Please try again, or email waw@abigailadamsinstitute.org.' }
  }
}
