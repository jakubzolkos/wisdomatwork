/**
 * Minimal iCalendar (.ics) builder for session reminders, so a Fellow can
 * add the session (with its Zoom link) to Google / Apple / Outlook
 * calendar from the email. Pure and dependency-free.
 *
 * Times are written in UTC (`...Z`), which every calendar converts to the
 * Fellow's own time zone. The UID is stable per session, so adding the
 * same session twice updates the entry instead of duplicating it.
 */

export type SessionInvite = {
  /** Stable id for the session (the curriculum item id). */
  uid: string
  title: string
  start: Date
  /** Length in minutes. */
  minutes: number
  /** Zoom link, shown as the location and in the description. */
  url?: string | null
  description?: string | null
}

function stamp(d: Date): string {
  // 2026-12-02T19:00:00.000Z -> 20261202T190000Z
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Escape text values per RFC 5545 (backslash, semicolon, comma, newline). */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Fold a content line at 75 octets, continuing with a leading space (RFC 5545 3.1). */
function fold(line: string): string {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    // Continuation lines start with a space, which counts toward the 75.
    const limit = out.length === 0 ? 75 : 74
    if (bytes + n > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += n
  }
  out.push(current)
  return out.join('\r\n ')
}

export function buildSessionIcs(invite: SessionInvite, now: Date = new Date()): string {
  const end = new Date(invite.start.getTime() + invite.minutes * 60_000)
  const description = [invite.description?.trim(), invite.url ? `Join on Zoom: ${invite.url}` : null]
    .filter(Boolean)
    .join('\n\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wisdom at Work//Fellows Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${invite.uid}@wisdomatwork-portal`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(invite.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(invite.title)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    invite.url ? `LOCATION:${esc(invite.url)}` : null,
    invite.url ? `URL:${invite.url}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(invite.title)} starts in 30 minutes`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null)

  return lines.map(fold).join('\r\n') + '\r\n'
}
