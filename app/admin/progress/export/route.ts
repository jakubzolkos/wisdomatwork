import { loadAllFellowProgress } from '@/lib/fellow-progress'
import { isoDay, progressCsv } from '@/lib/progress-csv'

/**
 * Admin -> Progress spreadsheet export (CSV, opens in Excel and Google
 * Sheets).
 *
 *   /admin/progress/export                    one row per fellow
 *   /admin/progress/export?format=items       one row per fellow and item,
 *                                             with tick dates and reflections
 *   ...&cohort=A                              one cohort only
 *
 * loadAllFellowProgress checks the caller is an admin.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const format = params.get('format') === 'items' ? 'items' : 'summary'
  const cohort = params.get('cohort')

  const fellows = (await loadAllFellowProgress()).filter(
    (d) => !d.fellow.deactivated && (!cohort || d.fellow.cohort === cohort),
  )

  const day = isoDay(new Date().toISOString())
  const name = `fellow-progress-${format}${cohort ? `-cohort-${cohort}` : ''}-${day}.csv`
  // The BOM makes Excel read the file as UTF-8 (names, curly quotes).
  return new Response(`﻿${progressCsv(fellows, format)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}
