import type { CurriculumItem, CurriculumModule, FullCurriculum } from '@/lib/curriculum-tree'

/**
 * The dashboard's "where am I" summary for a fellow, read from the same
 * curriculum tree as the sidebar: the next live session, what to do in
 * the module they're on, open surveys, and what opens next.
 *
 * Only the current phase counts (the latest one the fellow has); a
 * finished year is history.
 */
export interface WhereAmI {
  phaseTitle: string
  done: number
  total: number
  nextSession: { item: CurriculumItem; moduleTitle: string; startsAt: string; isLive: boolean } | null
  /** The first open module with something left to do. */
  current: { module: CurriculumModule; todo: CurriculumItem[] } | null
  /** Surveys with a link, not yet done, in any open module. */
  surveys: Array<{ item: CurriculumItem; moduleTitle: string }>
  /** The next module still to open. */
  upcoming: { title: string; opensAt: string } | null
}

/** How many items to list under "To do". */
const TODO_LIMIT = 4

export function whereAmI(curriculum: FullCurriculum, now = Date.now()): WhereAmI | null {
  const phase = curriculum.phases.findLast((p) => !p.isLocked && p.modules.length > 0)
  if (!phase) return null
  const open = phase.modules.filter((m) => !m.isLocked)
  // Items around a scheduled session wait for it: the surveys done on
  // the call show from 15 minutes before it starts, after-the-lab work
  // once it has ended.
  const sessionWindow = new Map<string, { start: number; end: number }>()
  for (const m of open) {
    const session = m.items.find((i) => i.resourceType === 'live_session' && i.scheduledAt)
    if (!session?.scheduledAt) continue
    const start = new Date(session.scheduledAt).getTime()
    sessionWindow.set(m.id, { start, end: start + (session.durationMinutes ?? 60) * 60_000 })
  }
  const notYet = (i: CurriculumItem, m: CurriculumModule) => {
    const w = sessionWindow.get(m.id)
    if (!w || i.resourceType === 'live_session') return false
    if (i.category === 'during_lab') return now < w.start - 15 * 60_000
    if (i.category === 'after_lab') return now < w.end
    return false
  }
  const left = (i: CurriculumItem, m: CurriculumModule) =>
    !i.isCompleted && !i.isPending && !i.isReference && !i.waitingOn && !notYet(i, m)

  let nextSession: WhereAmI['nextSession'] = null
  for (const m of open) {
    for (const i of m.items) {
      if (i.resourceType !== 'live_session' || !i.scheduledAt || i.isReference) continue
      const start = new Date(i.scheduledAt).getTime()
      const end = start + (i.durationMinutes ?? 60) * 60_000
      if (end <= now) continue
      if (!nextSession || start < new Date(nextSession.startsAt).getTime()) {
        nextSession = { item: i, moduleTitle: m.title, startsAt: i.scheduledAt, isLive: start <= now }
      }
    }
  }

  const currentModule = open.find((m) => m.items.some((i) => left(i, m))) ?? null
  const current = currentModule
    ? {
        module: currentModule,
        // The session itself is shown above; list what to do around it.
        todo: currentModule.items
          .filter((i) => left(i, currentModule) && i.id !== nextSession?.item.id)
          .slice(0, TODO_LIMIT),
      }
    : null

  const surveys = open.flatMap((m) =>
    m.items.filter((i) => i.resourceType === 'survey' && left(i, m)).map((item) => ({ item, moduleTitle: m.title })),
  )

  const next = phase.modules.find((m) => m.isLocked && m.opensAt)
  return {
    phaseTitle: phase.title,
    done: phase.completedCount,
    total: phase.itemCount,
    nextSession,
    current,
    surveys,
    upcoming: next?.opensAt ? { title: next.title, opensAt: next.opensAt } : null,
  }
}
