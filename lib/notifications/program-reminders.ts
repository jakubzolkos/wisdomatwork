import type { CurriculumRows } from '@/lib/curriculum-tree'

/**
 * Program reminders: email + in-app notifications worked out from the
 * curriculum, so staff don't write them one by one.
 *
 *   - a session reminder 24 hours before each scheduled live session
 *   - a "now open" notice when a module's release date passes
 *
 * They become ordinary scheduled notifications (Admin -> Notifications),
 * where staff read, edit or cancel them before the cron sends them.
 * Pure: the caller loads the curriculum and does the writing.
 */

export interface PlannedReminder {
  /** Which reminder this is, so re-running never makes a second one. */
  key: { content_id: string | null; module_id: string | null }
  title: string
  body: string
  sendAt: string
  cohorts: string[]
  ctaLabel: string
  /** Portal path; made absolute when saved (emails need full links). */
  ctaPath: string
}

const SESSION_LEAD_MS = 24 * 60 * 60 * 1000

const DAY_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})
const TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
})

function shortTitle(title: string): string {
  const at = title.indexOf(': ')
  return at > 0 ? title.slice(0, at) : title
}

function list(titles: string[]): string {
  if (titles.length <= 1) return titles.join('')
  return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`
}

export function planProgramReminders(rows: CurriculumRows, now = Date.now()): PlannedReminder[] {
  const phaseById = new Map(rows.phases.map((p) => [p.id, p]))
  const moduleById = new Map(rows.modules.map((m) => [m.id, m]))
  const itemsByModule = new Map<string, CurriculumRows['items']>()
  for (const i of rows.items) {
    if (!i.module_id) continue
    itemsByModule.set(i.module_id, [...(itemsByModule.get(i.module_id) ?? []), i])
  }
  const href = (i: CurriculumRows['items'][number]) => `/phases/${i.year_id}/modules/${i.module_id}/items/${i.id}`
  // Each cohort's current year: the latest phase it has. An earlier
  // phase is a finished year for that cohort (Cohort A's Deep Learning),
  // so nothing in it is announced to them.
  const currentPhaseOf = new Map<string, string>()
  for (const p of [...rows.phases].sort((a, b) => a.order_index - b.order_index)) {
    for (const c of p.cohorts ?? []) currentPhaseOf.set(c, p.id)
  }
  /** Phase -> module -> item cascade (lib/curriculum.ts), current year only. */
  const cohortsOf = (phaseId: string, moduleCohorts: string[] | null, itemCohorts?: string[] | null) =>
    (itemCohorts ?? moduleCohorts ?? phaseById.get(phaseId)?.cohorts ?? []).filter(
      (c) => currentPhaseOf.get(c) === phaseId,
    )

  const out: PlannedReminder[] = []

  // 1. The day before each session.
  for (const item of rows.items) {
    if (item.resource_type !== 'live_session' || !item.scheduled_at || !item.module_id) continue
    const module = moduleById.get(item.module_id)
    if (!module) continue
    const start = new Date(item.scheduled_at)
    const sendAt = start.getTime() - SESSION_LEAD_MS
    if (sendAt <= now) continue
    const cohorts = cohortsOf(module.phase_id, module.cohorts, item.cohorts)
    if (cohorts.length === 0) continue

    const siblings = (itemsByModule.get(module.id) ?? []).filter((i) => i.id !== item.id)
    const prep = siblings.filter((i) => i.category === 'before_lab').map((i) => i.title)
    const onCall = siblings
      .filter((i) => i.category === 'during_lab' && i.resource_type === 'survey')
      .map((i) => i.title)
    const name = shortTitle(module.title)
    out.push({
      key: { content_id: item.id, module_id: null },
      title: `Tomorrow: ${name} at ${TIME.format(start)} ET`,
      body: [
        `${name} is tomorrow, ${DAY_TIME.format(start)}, at ${TIME.format(start)} ET on Zoom. The join link is on the session page.`,
        prep.length ? `Before the call: ${list(prep)}.` : null,
        onCall.length
          ? `On the call you'll complete ${list(onCall)}. Have your Unique ID ready (it's on your dashboard).`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      sendAt: new Date(sendAt).toISOString(),
      cohorts,
      ctaLabel: 'Open the session',
      ctaPath: href(item),
    })
  }

  // 2. When a module opens.
  for (const module of rows.modules) {
    if (!module.opens_at || new Date(module.opens_at).getTime() <= now) continue
    const cohorts = cohortsOf(module.phase_id, module.cohorts)
    const items = itemsByModule.get(module.id) ?? []
    if (cohorts.length === 0 || items.length === 0) continue
    const prep = items.filter((i) => i.category === 'before_lab').map((i) => i.title)
    const first = [...items].sort((a, b) => a.order_index - b.order_index)[0]
    const name = shortTitle(module.title)
    out.push({
      key: { content_id: null, module_id: module.id },
      title: `${name} is now open`,
      body: [
        `${module.title} is now open in the portal.`,
        prep.length ? `To prepare: ${list(prep)}.` : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      sendAt: new Date(module.opens_at).toISOString(),
      cohorts,
      ctaLabel: `Open ${name}`,
      ctaPath: href(first),
    })
  }

  return out.sort((a, b) => a.sendAt.localeCompare(b.sendAt))
}
