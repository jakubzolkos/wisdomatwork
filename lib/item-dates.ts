/**
 * When a curriculum item happens or is due, shown beside it in the
 * sidebar and the dashboard.
 *
 * Read from the item itself, so staff keep dates current by editing
 * items: a live session's scheduled start, otherwise dates written in
 * its description, e.g. "October 14, 2026" or "Due May 5, 2027" /
 * "before May 19, 2027" (a deadline). When the text offers several
 * dates ("October 14 or October 21"), the first one is shown.
 */
export interface ItemWhen {
  /** ISO datetime when `hasTime`, otherwise YYYY-MM-DD. */
  date: string
  hasTime: boolean
  /** A due date rather than an event. */
  isDeadline: boolean
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const DATE_PATTERN =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?/g

/**
 * Dates written in text. A date without a year takes the next year
 * written after it ("October 14 or October 21, 2026").
 */
export function datesInText(text: string): { dates: string[]; isDeadline: boolean } {
  const found = [...text.matchAll(DATE_PATTERN)].map((m) => ({
    month: MONTHS.indexOf(m[1].toLowerCase()) + 1,
    day: Number(m[2]),
    year: m[3] ? Number(m[3]) : null,
    index: m.index ?? 0,
  }))
  const dates = found.map((d, i) => {
    const year = d.year ?? found.slice(i + 1).find((x) => x.year)?.year ?? new Date().getFullYear()
    return `${year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  })
  const first = found[0]
  const before = first ? text.slice(Math.max(0, first.index - 12), first.index).toLowerCase() : ''
  return { dates, isDeadline: /\b(due|before|by)\s*$/.test(before) }
}

/** An item's date: its scheduled start, or dates in its description. */
export function itemWhen(item: { scheduled_at: string | null; description: string | null }): ItemWhen | null {
  if (item.scheduled_at) return { date: item.scheduled_at, hasTime: true, isDeadline: false }
  const { dates, isDeadline } = datesInText(item.description ?? '')
  return dates.length ? { date: dates[0], hasTime: false, isDeadline } : null
}

const SESSION = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
// Plain dates are read at UTC noon so no time zone shifts the day.
const PLAIN = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

/** "Wed, Oct 7, 2:00 PM", "Due Mar 10", "Oct 14". Times are Eastern. */
export function formatWhen(when: ItemWhen): string {
  if (when.hasTime) return SESSION.format(new Date(when.date))
  const day = PLAIN.format(new Date(`${when.date}T12:00:00Z`))
  return when.isDeadline ? `Due ${day}` : day
}
