import { itemStatus, summarize, type FellowDetail } from '@/lib/fellow-progress'

/**
 * Admin -> Progress spreadsheets as CSV text (app/admin/progress/export).
 * Pure: takes already-loaded fellows, so the caller does the admin check.
 */
export function progressCsv(fellows: FellowDetail[], format: 'summary' | 'items'): string {
  return toCsv(format === 'items' ? itemRows(fellows) : summaryRows(fellows))
}

/** Cohort, then school, then name: how staff scan the sheet. */
function byCohortSchoolName(a: FellowDetail, b: FellowDetail): number {
  const key = (d: FellowDetail) => [d.fellow.cohort ?? '~', d.fellow.schoolName ?? '~', d.fellow.fullName]
  const [x, y] = [key(a), key(b)]
  for (let i = 0; i < x.length; i++) {
    const c = x[i].localeCompare(y[i])
    if (c) return c
  }
  return 0
}

/** The year the fellow is in now; a finished year is always 100% and left out. */
function currentPhase(d: FellowDetail) {
  return d.curriculum.phases.findLast((p) => !p.isLocked && p.modules.length > 0) ?? null
}

/** One row per fellow: who, where they are this year, when they were last active. */
function summaryRows(fellows: FellowDetail[]): string[][] {
  const header = [
    'Name',
    'Cohort',
    'School',
    'Year',
    'Done',
    '% done',
    'Reflections',
    'Last activity',
    'Last sign-in',
    'Unique ID',
    'Email',
  ]
  const rows = [...fellows].sort(byCohortSchoolName).map((d) => {
    const s = summarize(d)
    const year = s.phases.find((p) => p.isCurrent)
    return [
      d.fellow.fullName,
      d.fellow.cohort ?? '',
      d.fellow.schoolName ?? '',
      year?.title ?? '',
      year ? `${year.done} of ${year.total}` : '',
      year?.total ? String(Math.round((year.done / year.total) * 100)) : '',
      String(s.reflectionCount),
      isoDay(s.lastActivity),
      s.lastSignIn ? isoDay(s.lastSignIn) : 'Never',
      d.researchId ?? '',
      d.fellow.email ?? '',
    ]
  })
  return [header, ...rows]
}

/** One row per fellow and item of this year, with when it was done and any reflection. */
function itemRows(fellows: FellowDetail[]): string[][] {
  const header = [
    'Name',
    'Cohort',
    'School',
    'Module',
    'Item',
    'Status',
    'Completed on',
    'Reflection',
    'Reflection date',
    'Unique ID',
    'Email',
  ]
  const rows: string[][] = []
  for (const d of [...fellows].sort(byCohortSchoolName)) {
    for (const module of currentPhase(d)?.modules ?? []) {
      for (const item of module.items) {
        const completedAt = d.completedAt.get(item.id)
        const reflection = d.reflections.get(item.id)
        rows.push([
          d.fellow.fullName,
          d.fellow.cohort ?? '',
          d.fellow.schoolName ?? '',
          module.title,
          item.title,
          // The date has its own column.
          itemStatus(item, module.isLocked, completedAt).label.replace(/^Completed .*/, 'Completed'),
          isoDay(completedAt),
          reflection?.response ?? '',
          isoDay(reflection?.submittedAt),
          d.researchId ?? '',
          d.fellow.email ?? '',
        ])
      }
    }
  }
  return [header, ...rows]
}

const DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 2026-10-07 (Eastern): sorts and parses as a date in spreadsheets. */
export function isoDay(iso: string | null | undefined): string {
  return iso ? DAY.format(new Date(iso)) : ''
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

function csvCell(value: string): string {
  // Fellows write reflections, so a cell starting with = + - @ would
  // run as a formula in Excel; a leading apostrophe keeps it text.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
