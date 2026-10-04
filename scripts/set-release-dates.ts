/**
 * Set modules.opens_at (065) to the 2026-27 release dates: each module
 * opens right after the previous session ends. Writes only opens_at,
 * so item edits made in the admin panel are left alone.
 *
 *   bun --env-file=.env.local scripts/set-release-dates.ts           # dry run
 *   bun --env-file=.env.local scripts/set-release-dates.ts --apply   # write
 */
import { createClient } from '@supabase/supabase-js'

/** Phase title fragment -> module title -> release date. */
export const RELEASE_DATES: Record<string, Record<string, string>> = {
  'Deep Learning': {
    'Wisdom Lab Two: Institutional North Star': '2026-11-18T13:30:00-05:00',
    'North Star School Team Discussion': '2027-01-27T13:30:00-05:00',
    'Wisdom Lab Three: Teaching and Learning': '2027-01-27T13:30:00-05:00',
    'Wisdom Lab Four: Formative Discipline': '2027-02-24T13:30:00-05:00',
    'Wisdom Lab Five: Courageous Dialogue (Capstone)': '2027-03-24T13:30:00-04:00',
    'Post-Program Survey': '2027-04-28T13:30:00-04:00',
    'Capstone Interview & Feedback Session': '2027-04-28T13:30:00-04:00',
  },
  'Wisdom Coaching': {
    'Wisdom Coaching Two': '2026-10-07T15:00:00-04:00',
    'Wisdom Coaching Three': '2026-11-04T15:00:00-05:00',
    'Wisdom Coaching Four': '2026-12-02T15:00:00-05:00',
    'Wisdom Coaching Five': '2027-02-03T15:00:00-05:00',
    'Post-Program Survey': '2027-03-03T15:00:00-05:00',
    'Capstone Interview & Feedback Session': '2027-03-03T15:00:00-05:00',
  },
}

/** Release date for a module, or null when it opens with its phase. */
export function plannedOpensAt(phaseTitle: string, moduleTitle: string): string | null {
  for (const [phaseKey, modules] of Object.entries(RELEASE_DATES)) {
    if (phaseTitle.includes(phaseKey)) return modules[moduleTitle] ?? null
  }
  return null
}

async function main() {
  const apply = process.argv.includes('--apply')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? 'APPLYING' : 'DRY RUN (pass --apply to write)')
  const [{ data: phases }, { data: modules }] = await Promise.all([
    sb.from('years').select('id, title'),
    sb.from('modules').select('id, phase_id, title, opens_at'),
  ])
  for (const m of modules ?? []) {
    const phase = phases?.find((p) => p.id === m.phase_id)
    if (!phase) continue
    const want = plannedOpensAt(phase.title, m.title)
    const same =
      (m.opens_at && want && new Date(m.opens_at).getTime() === new Date(want).getTime()) || (!m.opens_at && !want)
    if (same) continue
    console.log(`${phase.title} / ${m.title}: ${m.opens_at ?? 'none'} -> ${want ?? 'none'}`)
    if (apply) {
      const { error } = await sb.from('modules').update({ opens_at: want }).eq('id', m.id)
      if (error) console.error(`  ERR ${error.message}`)
    }
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
