/**
 * Send ONE test session reminder (with its calendar invite attached) to a
 * single address, to check what Fellows will actually receive.
 *
 *   bun --env-file=.env.local scripts/send-test-invite.ts you@example.com           # dry run
 *   bun --env-file=.env.local scripts/send-test-invite.ts you@example.com --apply   # send
 *
 * Uses the same email template and invite builder as the real reminders,
 * with Wisdom Coaching Module Three as the sample session. The subject is
 * marked [TEST]. Nothing is written to the database.
 */
import { buildSessionIcs } from '@/lib/email/ics'
import { sendNotificationEmail } from '@/lib/email/send'
import { DEFAULT_FROM } from '@/lib/email/client'
import { WISDOM_COACHING_ZOOM, WISDOM_COACHING_SESSIONS } from './data/cohorts-2026-27'

async function main() {
  const to = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!to || to.startsWith('--') || !to.includes('@')) throw new Error('Pass the address to send the test to')

  const session = WISDOM_COACHING_SESSIONS[2] // Module Three
  const start = new Date(session.startsAt)
  const title = `${session.title} (Wisdom at Work)`
  const ics = buildSessionIcs({ uid: 'test-invite', title, start, minutes: 90, url: WISDOM_COACHING_ZOOM })

  console.log(`${apply ? '' : '[dry] '}send [TEST] reminder to ${to}`)
  console.log(`  from: ${DEFAULT_FROM}`)
  console.log(`  session: ${title}, ${start.toISOString()}, 90 min`)
  console.log(`  zoom: ${WISDOM_COACHING_ZOOM ? 'set' : 'MISSING'}; ics: ${ics.length} bytes`)
  if (!apply) return

  const result = await sendNotificationEmail(to, {
    recipientName: 'Test Fellow',
    kind: 'reminder',
    title: `Today: ${session.title.replace(' Module', '')} at 2:00 PM ET`,
    body: `${session.title} is today, at 2:00 PM ET on Zoom. Use the button below to join.\n\nThis is a test of the session reminder and its calendar invite. Open the attachment (session.ics) to check that it offers to add the session to your calendar.`,
    ctaLabel: 'Join on Zoom',
    ctaUrl: WISDOM_COACHING_ZOOM,
    subjectOverride: '[TEST] Today: your Wisdom Coaching session',
    footerNote: 'Test email: not a real reminder.',
    attachments: [{ filename: 'session.ics', content: ics, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }],
  })
  console.log(result.ok ? `sent (id ${result.id})` : `FAILED: ${result.error}`)
  if (!result.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
