import { getCategory } from '@/lib/curriculum'
import { itemStatus, summarize, type FellowDetail } from '@/lib/fellow-progress'

/**
 * Admin -> Progress spreadsheets as CSV text (app/admin/progress/export).
 * Pure: takes already-loaded fellows, so the caller does the admin check.
 */
export function progressCsv(fellows: FellowDetail[], format: 'summary' | 'items'): string {
  return toCsv(format === 'items' ? itemRows(fellows) : summaryRows(fellows))
}

const FELLOW_COLUMNS = ['Name', 'Email', 'Unique ID', 'School', 'Cohort']

function fellowCells(d: FellowDetail): string[] {
  const f = d.fellow
  return [f.fullName, f.email ?? '', d.researchId ?? '', f.schoolName ?? '', f.cohort ?? '']
}

function summaryRows(fellows: FellowDetail[]): string[][] {
  // Every phase anyone in the export has, in curriculum order.
  const phaseTitles: string[] = []
  for (const d of fellows) {
    for (const p of d.curriculum.phases) {
      if (!p.isLocked && !phaseTitles.includes(p.title)) phaseTitles.push(p.title)
    }
  }
  const header = [
    ...FELLOW_COLUMNS,
    'Current year',
    ...phaseTitles.flatMap((t) => [`${t}: done`, `${t}: items`, `${t}: %`]),
    'Reflections',
    'Last activity',
    'Last sign-in',
  ]
  const rows = fellows.map((d) => {
    const s = summarize(d)
    const current = s.phases.find((p) => p.isCurrent)
    return [
      ...fellowCells(d),
      current?.title ?? '',
      ...phaseTitles.flatMap((t) => {
        const p = s.phases.find((x) => x.title === t)
        if (!p) return ['', '', '']
        return [String(p.done), String(p.total), p.total ? String(Math.round((p.done / p.total) * 100)) : '']
      }),
      String(s.reflectionCount),
      isoDay(s.lastActivity),
      isoDay(s.lastSignIn),
    ]
  })
  return [header, ...rows]
}

function itemRows(fellows: FellowDetail[]): string[][] {
  const header = [
    ...FELLOW_COLUMNS,
    'Year',
    'Module',
    'Item',
    'Section',
    'Status',
    'Done',
    'Completed on',
    'Reflection',
    'Reflection submitted',
  ]
  const rows: string[][] = []
  for (const d of fellows) {
    for (const phase of d.curriculum.phases) {
      if (phase.isLocked) continue
      for (const module of phase.modules) {
        for (const item of module.items) {
          const completedAt = d.completedAt.get(item.id)
          const status = itemStatus(item, module.isLocked, completedAt)
          const reflection = d.reflections.get(item.id)
          rows.push([
            ...fellowCells(d),
            phase.title,
            module.title,
            item.title,
            getCategory(item.category).label,
            status.label.replace(/^Completed .*/, 'Completed'),
            status.done ? 'Yes' : 'No',
            isoDay(completedAt),
            reflection?.response ?? '',
            isoDay(reflection?.submittedAt),
          ])
        }
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
