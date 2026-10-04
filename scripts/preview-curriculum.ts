/**
 * Print the curriculum sidebar exactly as one fellow sees it: which
 * phases and modules are visible, which are locked (and why), and the
 * items inside each open module with their completion state.
 *
 * Mirrors lib/curriculum-tree.ts with a service-role client, the same
 * data an admin's "Preview as fellow" session reads. Read-only.
 *
 *   bun --env-file=.env.local scripts/preview-curriculum.ts --cohort A
 *   bun --env-file=.env.local scripts/preview-curriculum.ts --email someone@school.org
 *   ... --at 2026-11-19            # as it will look on that date
 *   ... --done-before 2026-11-19   # pretend every item open by then is complete
 *   ... --planned                  # use set-release-dates.ts dates instead of the database's
 */
import { createClient } from '@supabase/supabase-js'
import { canFellowSeeContent, canFellowSeeModule, canFellowSeePhase, isContentCategory } from '@/lib/curriculum'
import { computeModuleLocks, formatOpensAt, liveSessionHasEnded } from '@/lib/module-locks'
import { completionGate, isPendingSurvey } from '@/lib/completion-gates'
import { plannedOpensAt } from './set-release-dates'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

const at = arg('at') ? new Date(arg('at')!).getTime() : Date.now()
const planned = process.argv.includes('--planned')
const doneBefore = arg('done-before') ? new Date(arg('done-before')!).getTime() : null

async function pickFellow() {
  const email = arg('email')
  const cohort = arg('cohort')
  let q = sb.from('profiles').select('id, full_name, email, cohort, role').eq('role', 'fellow')
  if (email) q = q.ilike('email', email)
  else if (cohort) q = q.eq('cohort', cohort.toUpperCase())
  const { data, error } = await q.order('full_name').limit(1)
  if (error) throw error
  if (!data?.length) throw new Error('No matching fellow')
  return data[0]
}

async function main() {
  const fellow = await pickFellow()

  const [{ data: phases }, { data: modules }, { data: items }, { data: completions }] = await Promise.all([
    sb.from('years').select('id, title, cohorts, order_index').order('order_index'),
    sb.from('modules').select('*').order('order_index'),
    sb
      .from('labs')
      .select(
        'id, year_id, module_id, title, category, cohorts, order_index, duration_minutes, resource_type, scheduled_at, reflection_enabled, url',
      )
      .order('order_index')
      .order('created_at'),
    sb.from('user_content_completions').select('content_id').eq('profile_id', fellow.id),
  ])
  const completed = new Set((completions ?? []).map((c) => c.content_id))
  const hasOpensAt = planned || (modules ?? []).some((m) => 'opens_at' in m)
  if (planned) {
    for (const m of modules ?? []) {
      const phase = phases?.find((p) => p.id === m.phase_id)
      m.opens_at = phase ? plannedOpensAt(phase.title, m.title) : null
    }
  }

  const CATEGORY_ORDER = ['before_lab', 'during_lab', 'after_lab']
  const rank = (c: string) => (CATEGORY_ORDER.indexOf(c) === -1 ? 3 : CATEGORY_ORDER.indexOf(c))

  console.log(`\n${fellow.full_name} <${fellow.email}>  cohort ${fellow.cohort}`)
  console.log(
    `as of ${new Date(at).toISOString()}${doneBefore ? `, everything open by ${new Date(doneBefore).toISOString().slice(0, 10)} marked done` : ''}`,
  )
  if (!hasOpensAt) console.log('NOTE: modules.opens_at missing (065 not applied) - no release dates in effect')

  // Same rule as lib/curriculum-tree.ts: only the latest phase the
  // fellow's cohort has is paced; earlier phases are open reference.
  const currentPhaseId = (phases ?? []).findLast(
    (p) =>
      canFellowSeePhase(p.cohorts, fellow.cohort) &&
      (modules ?? []).some((m) => m.phase_id === p.id && canFellowSeeModule(m.cohorts, p.cohorts, fellow.cohort)),
  )?.id

  for (const p of phases ?? []) {
    if (!canFellowSeePhase(p.cohorts, fellow.cohort)) {
      console.log(`\n[LOCKED PHASE] ${p.title}`)
      continue
    }
    const phaseModules = (modules ?? []).filter(
      (m) => m.phase_id === p.id && canFellowSeeModule(m.cohorts, p.cohorts, fellow.cohort),
    )
    const paced = p.id === currentPhaseId
    const itemsByModule = new Map<string, any[]>()
    for (const m of phaseModules) {
      const list = (items ?? [])
        .filter(
          (i) =>
            i.module_id === m.id &&
            isContentCategory(i.category) &&
            (canFellowSeeContent(i.cohorts, p.cohorts, fellow.cohort, m.cohorts) ||
              // As lib/curriculum-tree.ts: a finished phase keeps its sessions, as already held.
              (!paced && i.resource_type === 'live_session')),
        )
        .map((i) => {
          // As lib/curriculum-tree.ts: a finished phase shows as done.
          if (!paced) return { ...i, isCompleted: true, isPending: false, isPast: true, gate: null }
          const opensAt = m.opens_at ? new Date(m.opens_at).getTime() : null
          const simulatedDone = doneBefore != null && (opensAt == null || opensAt <= doneBefore)
          const isCompleted = completed.has(i.id) || simulatedDone || liveSessionHasEnded(i, at)
          return {
            ...i,
            isCompleted,
            isPending: isPendingSurvey(i),
            gate: isCompleted ? null : completionGate(i, { linkClicked: false, reflection: null }, at),
          }
        })
        .sort((a, b) => rank(a.category) - rank(b.category))
      itemsByModule.set(m.id, list)
    }
    const locks = computeModuleLocks(
      phaseModules.map((m) => ({
        id: m.id,
        title: m.title,
        isSequential: paced && m.is_sequential,
        opensAt: paced ? (m.opens_at ?? null) : null,
        items: itemsByModule.get(m.id) ?? [],
      })),
      at,
    )

    console.log(`\n== ${p.title}${paced ? '' : '  (earlier phase: reference, never locked)'}`)
    for (const m of phaseModules) {
      const lock = locks.get(m.id)!
      const list = itemsByModule.get(m.id) ?? []
      const counted = list.filter((i) => !i.isPending)
      const done = counted.filter((i) => i.isCompleted).length
      const flags = [m.is_sequential ? 'sequential' : null, m.opens_at ? `opens_at ${m.opens_at}` : null]
        .filter(Boolean)
        .join(', ')
      if (lock.isLocked) {
        const why = lock.opensAt
          ? `Opens ${formatOpensAt(lock.opensAt, new Date(at))}`
          : `Complete ${lock.blockedBy} to unlock`
        console.log(`  [LOCKED] ${m.title}  -> "${why}"  (${list.length} items hidden${flags ? `; ${flags}` : ''})`)
        continue
      }
      console.log(`  [open]   ${m.title}  ${done}/${counted.length}${flags ? `  (${flags})` : ''}`)
      if (!list.length) console.log('             (No content yet.)')
      for (const i of list) {
        const mark = i.isCompleted ? 'x' : i.isPending ? '~' : ' '
        const note = [i.resource_type, i.isPending ? 'pending survey' : null, i.isPast ? 'finished year' : null, i.gate ? `gate:${i.gate}` : null]
          .filter(Boolean)
          .join(', ')
        console.log(`             [${mark}] ${i.category.padEnd(10)} ${i.title}  (${note})`)
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
