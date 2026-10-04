import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Cohort } from '@/lib/cohorts'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import {
  canFellowSeeContent,
  canFellowSeeModule,
  canFellowSeePhase,
  isContentCategory,
  type ContentCategory,
} from '@/lib/curriculum'
import { computeModuleLocks, formatOpensAt, liveSessionHasEnded } from '@/lib/module-locks'
import { readPreviewCompletions, readPreviewReflections } from '@/lib/preview-completions'
import { completionGate, isPendingSurvey, type CompletionGate } from '@/lib/completion-gates'
import { readSessionLinkClicks } from '@/lib/session-link-clicks'

/**
 * Server-side data layer for the fellow curriculum view.
 *
 * Returns every Phase -> Module -> Content the current user is
 * allowed to see, plus their completion set, as a flat tree the
 * dashboard renders inline (no per-phase landing page).
 *
 * Visibility uses the same Phase -> Module -> Content cascade as
 * everywhere else, and is bypassed for admins/facilitators (they see
 * everything).
 */

export interface CurriculumItem {
  id: string
  title: string
  /**
   * Category drives in-module grouping (Before / During / After Lab,
   * etc.) - the tree splits items into category buckets per module.
   */
  category: ContentCategory
  /** Optional duration in minutes; rendered as "55min" in the tree. */
  durationMinutes: number | null
  /** href for the content viewer page. */
  href: string
  /** Whether the current user has marked this item complete. */
  isCompleted: boolean
  /**
   * What still stops the user ticking this item (session not over,
   * link not opened, reflection missing); null when it can be ticked
   * or is already complete. lib/completion-gates.ts.
   */
  completionGate: CompletionGate | null
  /** Placeholder survey with no link yet: shown, but not counted or locking. */
  isPending: boolean
  /**
   * In a phase the fellow has already finished (Cohort A's Deep
   * Learning year): shown as completed, including that year's live
   * sessions, which this year run for the other cohort and are view
   * only.
   */
  isPast: boolean
}

export interface CurriculumModule {
  id: string
  title: string
  description: string | null
  items: CurriculumItem[]
  /**
   * Locked until the earlier modules in the phase's sequence are
   * complete (lib/module-locks.ts). Items are still listed so progress
   * counts stay stable, but the UI must not link to them. Always false
   * for admins/facilitators.
   */
  isLocked: boolean
  /** Title of the module to finish first, when locked. */
  blockedBy: string | null
  /** Part of the phase's unlock sequence (061; off by default since 065). */
  isSequential: boolean
  /** Release date while still ahead (locked until then); null once open. */
  opensAt: string | null
}

export interface CurriculumPhase {
  id: string
  title: string
  description: string | null
  modules: CurriculumModule[]
  /** Total visible content items across all modules. */
  itemCount: number
  /** Total items the user has marked complete. */
  completedCount: number
  /**
   * True when the phase exists in the curriculum but the current
   * fellow's cohort isn't assigned to it. Locked phases are kept in
   * the tree so the UI can show them as gated, but their modules
   * array is intentionally empty - admins/facilitators always see
   * `isLocked: false`.
   */
  isLocked: boolean
}

export interface FullCurriculum {
  phases: CurriculumPhase[]
  /** True when the user is an admin/facilitator (visibility bypassed). */
  isPrivileged: boolean
}

/**
 * Load every visible phase + nested modules + items for the current
 * user, in display order. Single helper used by the dashboard's
 * collapsible curriculum tree.
 *
 * Wrapped in `cache()` so when both the layout and a sibling page
 * call it during the same render the database round-trip happens
 * once.
 */
export const loadFullCurriculum = cache(_loadFullCurriculum)

type PhaseRow = {
  id: string
  title: string
  description: string | null
  cohorts: string[] | null
  order_index: number
}
type ModuleRow = {
  id: string
  phase_id: string
  title: string
  description: string | null
  cohorts: string[] | null
  order_index: number
  is_sequential: boolean
  opens_at?: string | null
}
type ItemRow = {
  id: string
  year_id: string
  module_id: string | null
  title: string
  category: string | null
  cohorts: string[] | null
  duration_minutes: number | null
  order_index: number
  resource_type: string | null
  scheduled_at: string | null
  reflection_enabled: boolean
  url: string | null
}

/** The curriculum itself, in display order: the same for every viewer. */
export interface CurriculumRows {
  phases: PhaseRow[]
  modules: ModuleRow[]
  items: ItemRow[]
}

/** One viewer's progress: what the tree's ticks and gates are built from. */
export interface ViewerProgress {
  completed: ReadonlySet<string>
  /** Saved reflection text by item id. */
  reflectionById: ReadonlyMap<string, string>
  /** Links opened this login session (the link gate). */
  linkClicks: ReadonlySet<string>
  /** Preview only: reflections accepted without being saved. */
  acceptedReflections: ReadonlySet<string>
}

/** Phase, module and item rows, with the caller's client (RLS applies). */
export async function fetchCurriculumRows(
  supabase: SupabaseClient<any, any, any>,
): Promise<CurriculumRows> {
  const [{ data: phases }, { data: modules }, { data: items }] = await Promise.all([
    supabase
      .from('years')
      .select('id, title, description, cohorts, order_index')
      .order('order_index', { ascending: true })
      .returns<PhaseRow[]>(),
    supabase
      .from('modules')
      // '*' so this keeps working before 065 adds opens_at.
      .select('*')
      .order('order_index', { ascending: true })
      .returns<ModuleRow[]>(),
    supabase
      .from('labs')
      .select(
        'id, year_id, module_id, title, category, cohorts, duration_minutes, order_index, resource_type, scheduled_at, reflection_enabled, url',
      )
      .order('order_index', { ascending: true })
      // Tie-break so equal order_index rows keep one stable order.
      .order('created_at', { ascending: true })
      .returns<ItemRow[]>(),
  ])
  return { phases: phases ?? [], modules: modules ?? [], items: items ?? [] }
}

async function _loadFullCurriculum(): Promise<FullCurriculum> {
  const user = await requireUser()
  const supabase = await createClient()
  // Cohort preview runs as a synthetic, non-uuid user with no rows.
  const hasRealId = user.id !== '__preview__'

  const [rows, { data: completionRows }, { data: reflectionRows }, linkClicks] =
    await Promise.all([
      fetchCurriculumRows(supabase),
      // Filter by profile explicitly: RLS (027) also lets fellows read
      // their cohort-mates' rows for team progress, which must not
      // count as this user's progress. In by-fellow preview this is the
      // previewed fellow (admins can read every row).
      hasRealId
        ? supabase
            .from('user_content_completions')
            .select('content_id')
            .eq('profile_id', user.id)
            .returns<Array<{ content_id: string }>>()
        : Promise.resolve({ data: [] as Array<{ content_id: string }> }),
      // Inputs to the completion gates, so the tree can disable a tick
      // the server would refuse.
      hasRealId
        ? supabase
            .from('user_content_reflections')
            .select('content_id, response')
            .eq('profile_id', user.id)
            .returns<Array<{ content_id: string; response: string }>>()
        : Promise.resolve({ data: [] as Array<{ content_id: string; response: string }> }),
      readSessionLinkClicks(),
    ])

  const completed = new Set((completionRows ?? []).map((c) => c.content_id))
  // Preview toggles and accepted reflections are kept in a cookie,
  // never the database.
  const [previewCompletions, acceptedReflections] = await Promise.all([
    readPreviewCompletions(user),
    readPreviewReflections(user),
  ])
  for (const [id, done] of previewCompletions) {
    if (done) completed.add(id)
    else completed.delete(id)
  }

  return buildCurriculum(
    rows,
    user,
    {
      completed,
      reflectionById: new Map((reflectionRows ?? []).map((r) => [r.content_id, r.response])),
      linkClicks,
      acceptedReflections,
    },
    Date.now(),
  )
}

/**
 * The curriculum as `viewer` sees it: visibility, release locks, ticks
 * and completion gates. Pure, so admin screens can build any fellow's
 * view (lib/fellow-progress.ts) with exactly the rules the fellow gets.
 */
export function buildCurriculum(
  rows: CurriculumRows,
  viewer: { role: string; cohort?: Cohort | null },
  progress: ViewerProgress,
  now: number,
): FullCurriculum {
  const isFellow = viewer.role === 'fellow'
  const userCohort = viewer.cohort ?? null
  const { phases: phaseRows, modules: moduleRows, items: itemRows } = rows
  const completedSet = progress.completed
  const reflectionById = progress.reflectionById
  const linkClicks = progress.linkClicks
  const previewReflections = progress.acceptedReflections

  // Phase visibility. Fellows still see every phase in the tree,
  // but unassigned ones are flagged `isLocked` so the UI can render
  // them as gated cards instead of hiding them. Privileged users
  // never see a locked phase.
  const allPhases = phaseRows ?? []
  const lockedPhaseIds = new Set<string>()
  if (isFellow) {
    for (const p of allPhases) {
      if (!canFellowSeePhase(p.cohorts, userCohort)) {
        lockedPhaseIds.add(p.id)
      }
    }
  }
  const phaseCohortById = new Map<string, string[] | null>()
  for (const p of allPhases) phaseCohortById.set(p.id, p.cohorts)

  // Module visibility filter, grouped under their phase. Modules
  // under a locked phase are dropped entirely - we render the phase
  // as a "locked" stub with no children, so loading them would just
  // be wasted work and could leak titles into the client bundle.
  const modulesByPhase = new Map<string, typeof moduleRows>()
  const moduleCohortById = new Map<string, string[] | null>()
  for (const m of moduleRows ?? []) {
    const phaseCohorts = phaseCohortById.get(m.phase_id)
    if (phaseCohorts === undefined) continue // phase not in curriculum
    if (lockedPhaseIds.has(m.phase_id)) continue
    if (
      isFellow &&
      !canFellowSeeModule(m.cohorts, phaseCohorts, userCohort)
    ) {
      continue
    }
    moduleCohortById.set(m.id, m.cohorts)
    const list = modulesByPhase.get(m.phase_id) ?? []
    list.push(m)
    modulesByPhase.set(m.phase_id, list)
  }

  // Release dates and the unlock sequence pace the fellow's current
  // phase: the latest one their cohort has. Earlier phases are a
  // finished year kept as reference (Cohort A's Deep Learning
  // readings), so nothing in them is locked.
  const currentPhaseId = allPhases.findLast(
    (p) => !lockedPhaseIds.has(p.id) && modulesByPhase.has(p.id),
  )?.id

  // Item visibility filter, grouped under their module.
  const itemsByModule = new Map<string, CurriculumItem[]>()
  for (const item of itemRows ?? []) {
    if (!item.module_id) continue
    if (!isContentCategory(item.category)) continue // legacy/draft rows
    const moduleCohorts = moduleCohortById.get(item.module_id)
    if (moduleCohorts === undefined) continue // module not visible
    const phaseCohorts = phaseCohortById.get(item.year_id) ?? null
    // A phase before the fellow's current one is a year they have
    // finished: everything in it shows as done.
    const isPast = isFellow && item.year_id !== currentPhaseId
    if (isFellow) {
      if (
        !canFellowSeeContent(
          item.cohorts,
          phaseCohorts,
          userCohort,
          moduleCohorts,
        )
      ) {
        // A finished phase still lists its live sessions (the fellow
        // attended last year's). This year's surveys stay with the
        // cohort they belong to.
        if (!isPast || item.resource_type !== 'live_session') continue
      }
    }
    const list = itemsByModule.get(item.module_id) ?? []
    if (isPast) {
      list.push({
        id: item.id,
        title: item.title,
        category: item.category,
        durationMinutes: item.duration_minutes,
        href: `/phases/${item.year_id}/modules/${item.module_id}/items/${item.id}`,
        isCompleted: true,
        isPending: false,
        isPast: true,
        completionGate: null,
      })
      itemsByModule.set(item.module_id, list)
      continue
    }
    const isCompleted = completedSet.has(item.id) || liveSessionHasEnded(item, now)
    list.push({
      id: item.id,
      title: item.title,
      category: item.category,
      durationMinutes: item.duration_minutes,
      href: `/phases/${item.year_id}/modules/${item.module_id}/items/${item.id}`,
      // An ended live session counts as done even if the fellow never
      // reopened its page (where the completion row gets written).
      isCompleted,
      isPending: isPendingSurvey(item),
      isPast: false,
      // Preview meets the same gates as a fellow.
      completionGate: isCompleted
        ? null
        : completionGate(
            item,
            {
              linkClicked: linkClicks.has(item.id),
              reflection: reflectionById.get(item.id) ?? null,
              reflectionAccepted: previewReflections.has(item.id),
            },
            now,
          ),
    })
    itemsByModule.set(item.module_id, list)
  }

  // Display order inside a module: Before / During / After the Lab,
  // then anything else, each group in order_index order (the sort is
  // stable). The tree renders these groups and Continue walks the
  // same list, so the two always agree.
  for (const list of itemsByModule.values()) {
    list.sort((a, b) => categoryRank(a.category) - categoryRank(b.category))
  }

  // Stitch everything together in display order. Locked phases
  // come back with empty modules + zero counts so the UI can render
  // a gated stub without further conditionals.
  const phases: CurriculumPhase[] = allPhases.map((p) => {
    const isLocked = lockedPhaseIds.has(p.id)
    const phaseModules = isLocked ? [] : (modulesByPhase.get(p.id) ?? [])
    // Staff are never locked out; fellows (and previews) follow the
    // sequence in their current phase.
    const locks = isFellow && p.id === currentPhaseId
      ? computeModuleLocks(
          phaseModules.map((m) => ({
            id: m.id,
            title: m.title,
            isSequential: m.is_sequential,
            opensAt: m.opens_at ?? null,
            items: itemsByModule.get(m.id) ?? [],
          })),
          now,
        )
      : null
    const modules: CurriculumModule[] = phaseModules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      items: itemsByModule.get(m.id) ?? [],
      isLocked: locks?.get(m.id)?.isLocked ?? false,
      blockedBy: locks?.get(m.id)?.blockedBy ?? null,
      isSequential: m.is_sequential,
      opensAt: locks?.get(m.id)?.opensAt ?? null,
    }))
    let itemCount = 0
    let completedCount = 0
    for (const m of modules) {
      for (const i of m.items) {
        if (i.isPending) continue
        itemCount += 1
        if (i.isCompleted) completedCount += 1
      }
    }
    return {
      id: p.id,
      title: p.title,
      // Don't leak descriptive copy for phases the fellow can't
      // access - just the title is enough to convey "this exists".
      description: isLocked ? null : p.description,
      modules,
      itemCount,
      completedCount,
      isLocked,
    }
  })

  return { phases, isPrivileged: !isFellow }
}

/**
 * Where an item sits in the user's curriculum. Null when the user
 * can't see it at all (cohort rules); check `module.isLocked` for the
 * sequence lock. The single access answer shared by the item page,
 * the item actions and the stored-file route.
 */
export function findCurriculumItem(
  curriculum: FullCurriculum,
  contentId: string,
): { module: CurriculumModule; item: CurriculumItem } | null {
  for (const phase of curriculum.phases) {
    for (const module of phase.modules) {
      const item = module.items.find((i) => i.id === contentId)
      if (item) return { module, item }
    }
  }
  return null
}

/** Lab stages first, in session order; other categories after. */
const CATEGORY_ORDER: readonly ContentCategory[] = ['before_lab', 'during_lab', 'after_lab']

function categoryRank(category: ContentCategory): number {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

/**
 * Previous and next items for the viewer's "Go to next item".
 *
 * Walks items in display order and never skips past a locked module:
 * when the next item sits in a module that stays locked even once the
 * current item is complete, there is no next item and `nextLocked`
 * says why ("The next module opens Jan 27."). Locks are re-evaluated
 * with the current item counted as done because "Go to next item"
 * completes it first, so finishing the last item of a sequential
 * module still continues into the next.
 */
export function findAdjacentItems(
  curriculum: FullCurriculum,
  contentId: string,
): {
  prev: CurriculumItem | null
  next: CurriculumItem | null
  nextLocked: string | null
} {
  const flat: Array<{ item: CurriculumItem; module: CurriculumModule; phase: CurriculumPhase }> = []
  for (const phase of curriculum.phases) {
    for (const module of phase.modules) {
      for (const item of module.items) flat.push({ item, module, phase })
    }
  }
  const idx = flat.findIndex((e) => e.item.id === contentId)
  if (idx === -1) return { prev: null, next: null, nextLocked: null }

  const before = flat[idx - 1]
  const prev = before && !before.module.isLocked ? before.item : null

  const after = flat[idx + 1]
  if (!after) return { prev, next: null, nextLocked: null }
  if (!after.module.isLocked) return { prev, next: after.item, nextLocked: null }

  // Locks are per phase, so the current item can only unlock modules
  // in its own phase (and never a date lock).
  const current = flat[idx]
  let lock: { opensAt: string | null; blockedBy: string | null } = after.module
  if (after.phase.id === current.phase.id) {
    const recomputed = computeModuleLocks(
      current.phase.modules.map((m) => ({
        id: m.id,
        title: m.title,
        isSequential: m.isSequential,
        opensAt: m.opensAt,
        items: m.items.map((i) => ({
          isCompleted: i.isCompleted || i.id === contentId,
          isPending: i.isPending,
        })),
      })),
    ).get(after.module.id)
    if (!recomputed?.isLocked) return { prev, next: after.item, nextLocked: null }
    lock = recomputed
  }
  const nextLocked = lock.opensAt
    ? `The next module opens ${formatOpensAt(lock.opensAt)}.`
    : lock.blockedBy
      ? `Finish every item in ${lock.blockedBy} to unlock the next module.`
      : null
  return { prev, next: null, nextLocked }
}
