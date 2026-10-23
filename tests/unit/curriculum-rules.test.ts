import { describe, expect, test } from 'bun:test'
import { buildCurriculum, type CurriculumRows, type FullCurriculum } from '@/lib/curriculum-tree'
import { whereAmI } from '@/lib/where-am-i'
import { countDone, doneByFellow } from '@/lib/fellow-progress'

/**
 * The access rules fellows depend on, on a small made-up curriculum:
 * Year One (Deep Learning) is Cohort B's current year and Cohort A's
 * finished year; Year Two (Wisdom Coaching) is Cohort A's.
 */

const NOW = new Date('2026-11-01T12:00:00Z').getTime()
const DAY = 24 * 60 * 60 * 1000
const iso = (ms: number) => new Date(ms).toISOString()

function item(
  id: string,
  module_id: string,
  year_id: string,
  over: Partial<CurriculumRows['items'][number]> = {},
): CurriculumRows['items'][number] {
  return {
    id,
    module_id,
    year_id,
    title: id,
    category: 'before_lab',
    cohorts: null,
    duration_minutes: null,
    order_index: 1,
    resource_type: 'reading',
    scheduled_at: null,
    reflection_enabled: false,
    url: 'https://example.org/reading',
    description: null,
    ...over,
  }
}

const ROWS: CurriculumRows = {
  phases: [
    { id: 'y1', title: 'Year One: Deep Learning', description: null, cohorts: ['A', 'B'], order_index: 1 },
    { id: 'y2', title: 'Year Two: Wisdom Coaching', description: null, cohorts: ['A'], order_index: 2 },
  ],
  modules: [
    { id: 'lab1', phase_id: 'y1', title: 'Wisdom Lab One', description: null, cohorts: null, order_index: 1, is_sequential: false, opens_at: null },
    { id: 'lab2', phase_id: 'y1', title: 'Wisdom Lab Two', description: null, cohorts: null, order_index: 2, is_sequential: false, opens_at: iso(NOW + 10 * DAY) },
    { id: 'bonly', phase_id: 'y1', title: 'Listening Launch', description: null, cohorts: ['B'], order_index: 3, is_sequential: false, opens_at: null },
    { id: 'wc1', phase_id: 'y2', title: 'Wisdom Coaching One', description: null, cohorts: null, order_index: 1, is_sequential: false, opens_at: null },
  ],
  items: [
    // Lab One: prep, then on the Zoom RoP -> lab -> RoL, then field work.
    item('lab1-prep', 'lab1', 'y1'),
    item('lab1-rop', 'lab1', 'y1', { category: 'during_lab', order_index: 1, resource_type: 'survey', cohorts: ['B'], url: 'https://forms.example/rop' }),
    item('lab1-session', 'lab1', 'y1', {
      category: 'during_lab',
      order_index: 2,
      resource_type: 'live_session',
      cohorts: ['B'],
      scheduled_at: iso(NOW + 2 * DAY),
      duration_minutes: 150,
      url: 'https://zoom.example/b',
    }),
    item('lab1-rol', 'lab1', 'y1', { category: 'during_lab', order_index: 3, resource_type: 'survey', cohorts: ['B'], url: 'https://forms.example/rol' }),
    item('lab1-field', 'lab1', 'y1', { category: 'after_lab', resource_type: 'assignment', url: null }),
    item('lab2-prep', 'lab2', 'y1'),
    item('bonly-session', 'bonly', 'y1', { category: 'during_lab', resource_type: 'live_session', url: null }),
    // Wisdom Coaching One: its session has already ended.
    item('wc1-prep', 'wc1', 'y2', { resource_type: 'assignment', url: null }),
    item('wc1-checkin', 'wc1', 'y2', { category: 'during_lab', order_index: 1, resource_type: 'survey', url: 'https://forms.example/checkin' }),
    item('wc1-session', 'wc1', 'y2', {
      category: 'during_lab',
      order_index: 2,
      resource_type: 'live_session',
      scheduled_at: iso(NOW - 5 * DAY),
      duration_minutes: 60,
      url: 'https://zoom.example/a',
    }),
    item('wc1-retro', 'wc1', 'y2', { category: 'during_lab', order_index: 3, resource_type: 'survey', url: null }),
  ],
}

function build(role: 'fellow' | 'admin', cohort: 'A' | 'B' | null, completed: string[] = [], now = NOW): FullCurriculum {
  return buildCurriculum(
    ROWS,
    { role, cohort },
    { completed: new Set(completed), reflectionById: new Map(), linkClicks: new Set(), acceptedReflections: new Set() },
    now,
  )
}

function find(c: FullCurriculum, id: string) {
  for (const p of c.phases) for (const m of p.modules) for (const i of m.items) if (i.id === id) return { phase: p, module: m, item: i }
  return null
}

describe('cohort isolation', () => {
  test("Cohort B can't see Cohort A's year at all", () => {
    const b = build('fellow', 'B')
    const y2 = b.phases.find((p) => p.id === 'y2')!
    expect(y2.isLocked).toBe(true)
    expect(y2.modules).toHaveLength(0)
    expect(find(b, 'wc1-session')).toBeNull()
  })

  test("Cohort A sees Cohort B's sessions and surveys only as view-only reference", () => {
    const a = build('fellow', 'A')
    for (const id of ['lab1-session', 'lab1-rol', 'lab1-rop', 'bonly-session']) {
      const hit = find(a, id)
      expect(hit?.item.isReference).toBe(true)
    }
    // Their own readings are not reference.
    expect(find(a, 'lab1-prep')?.item.isReference).toBe(false)
  })
})

describe('finished year (Cohort A in Deep Learning)', () => {
  test('everything is done and nothing is locked', () => {
    const y1 = build('fellow', 'A').phases.find((p) => p.id === 'y1')!
    for (const m of y1.modules) {
      expect(m.isLocked).toBe(false)
      for (const i of m.items) {
        expect(i.isPast).toBe(true)
        expect(i.isCompleted).toBe(true)
        expect(i.when).toBeNull() // this year's dates are Cohort B's
      }
    }
  })
})

describe('release dates', () => {
  test('a module locks for its cohort until its date', () => {
    expect(find(build('fellow', 'B'), 'lab2-prep')?.module.isLocked).toBe(true)
    expect(find(build('fellow', 'B', [], NOW + 11 * DAY), 'lab2-prep')?.module.isLocked).toBe(false)
  })

  test('staff are never locked out', () => {
    const admin = build('admin', null)
    expect(admin.isPrivileged).toBe(true)
    expect(find(admin, 'lab2-prep')?.module.isLocked).toBe(false)
    expect(find(admin, 'wc1-session')).not.toBeNull()
  })
})

describe('"completed survey" gate', () => {
  test('steps after an unticked survey wait; live sessions never do', () => {
    const a = build('fellow', 'A')
    expect(find(a, 'wc1-session')?.item.waitingOn).toBeNull()
    // The Retrospective has no link yet, so it is a placeholder, but it
    // still sits after the Check-in.
    expect(find(a, 'wc1-retro')?.item.waitingOn?.id).toBe('wc1-checkin')
  })

  test('ticking the survey opens what waits on it', () => {
    expect(find(build('fellow', 'A', ['wc1-checkin']), 'wc1-retro')?.item.waitingOn).toBeNull()
  })

  test("Cohort B's field work waits for the first unticked survey on the call", () => {
    expect(find(build('fellow', 'B'), 'lab1-field')?.item.waitingOn?.id).toBe('lab1-rop')
  })
})

describe('progress counting', () => {
  test('an ended session shows as done to the fellow but not on staff screens', () => {
    const a = build('fellow', 'A')
    const session = find(a, 'wc1-session')!.item
    expect(session.isCompleted).toBe(true)
    expect(doneByFellow(session, new Map())).toBe(false)
    expect(doneByFellow(session, new Map([['wc1-session', iso(NOW)]]))).toBe(true)
  })

  test('staff count only what the fellow did', () => {
    const wc1 = find(build('fellow', 'A', ['wc1-checkin']), 'wc1-prep')!.module
    expect(countDone(wc1.items, new Map([['wc1-checkin', iso(NOW)]]))).toEqual({ done: 1, total: 3 })
  })
})

describe('"where you are" on the dashboard', () => {
  test('surveys done on the call wait until just before it', () => {
    const early = whereAmI(build('fellow', 'B'), NOW)!
    expect(early.surveys.map((s) => s.item.id)).not.toContain('lab1-rol')
    const atCall = whereAmI(build('fellow', 'B', [], NOW + 2 * DAY - 10 * 60_000), NOW + 2 * DAY - 10 * 60_000)!
    expect(atCall.surveys.map((s) => s.item.id)).toContain('lab1-rop')
  })

  test('the next session is the upcoming one, not one already over', () => {
    expect(whereAmI(build('fellow', 'B'), NOW)!.nextSession?.item.id).toBe('lab1-session')
    expect(whereAmI(build('fellow', 'A'), NOW)!.nextSession).toBeNull()
  })
})
