import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import {
  canFellowSeeContent,
  canFellowSeeModule,
  canFellowSeePhase,
  isContentCategory,
  type ContentCategory,
} from '@/lib/curriculum'
import { computeModuleLocks, liveSessionHasEnded } from '@/lib/module-locks'
import { readPreviewCompletions } from '@/lib/preview-completions'

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

async function _loadFullCurriculum(): Promise<FullCurriculum> {
  const user = await requireUser()
  const supabase = await createClient()
  const isFellow = user.role === 'fellow'
  const userCohort = user.cohort ?? null
  // Cohort preview runs as a synthetic, non-uuid user with no rows.
  const hasRealId = user.id !== '__preview__'

  const [
    { data: phaseRows },
    { data: moduleRows },
    { data: itemRows },
    { data: completionRows },
  ] = await Promise.all([
    supabase
      .from('years')
      .select('id, title, description, cohorts, order_index')
      .order('order_index', { ascending: true })
      .returns<
        Array<{
          id: string
          title: string
          description: string | null
          cohorts: string[] | null
          order_index: number
        }>
      >(),
    supabase
      .from('modules')
      .select('id, phase_id, title, description, cohorts, order_index, is_sequential')
      .order('order_index', { ascending: true })
      .returns<
        Array<{
          id: string
          phase_id: string
          title: string
          description: string | null
          cohorts: string[] | null
          order_index: number
          is_sequential: boolean
        }>
      >(),
    supabase
      .from('labs')
      .select(
        'id, year_id, module_id, title, category, cohorts, duration_minutes, order_index, resource_type, scheduled_at, reflection_enabled',
      )
      .order('order_index', { ascending: true })
      .returns<
        Array<{
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
        }>
      >(),
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
  ])

  const completedSet = new Set((completionRows ?? []).map((c) => c.content_id))
  // Preview toggles are kept in a cookie, never the database.
  for (const [id, done] of await readPreviewCompletions(user)) {
    if (done) completedSet.add(id)
    else completedSet.delete(id)
  }
  const now = Date.now()

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

  // Item visibility filter, grouped under their module.
  const itemsByModule = new Map<string, CurriculumItem[]>()
  for (const item of itemRows ?? []) {
    if (!item.module_id) continue
    if (!isContentCategory(item.category)) continue // legacy/draft rows
    const moduleCohorts = moduleCohortById.get(item.module_id)
    if (moduleCohorts === undefined) continue // module not visible
    const phaseCohorts = phaseCohortById.get(item.year_id) ?? null
    if (isFellow) {
      if (
        !canFellowSeeContent(
          item.cohorts,
          phaseCohorts,
          userCohort,
          moduleCohorts,
        )
      ) {
        continue
      }
    }
    const list = itemsByModule.get(item.module_id) ?? []
    list.push({
      id: item.id,
      title: item.title,
      category: item.category,
      durationMinutes: item.duration_minutes,
      href: `/phases/${item.year_id}/modules/${item.module_id}/items/${item.id}`,
      // An ended live session counts as done even if the fellow never
      // reopened its page (where the completion row gets written).
      isCompleted: completedSet.has(item.id) || liveSessionHasEnded(item, now),
    })
    itemsByModule.set(item.module_id, list)
  }

  // Stitch everything together in display order. Locked phases
  // come back with empty modules + zero counts so the UI can render
  // a gated stub without further conditionals.
  const phases: CurriculumPhase[] = allPhases.map((p) => {
    const isLocked = lockedPhaseIds.has(p.id)
    const phaseModules = isLocked ? [] : (modulesByPhase.get(p.id) ?? [])
    // Staff are never locked out; fellows (and previews) follow the
    // sequence.
    const locks = isFellow
      ? computeModuleLocks(
          phaseModules.map((m) => ({
            id: m.id,
            title: m.title,
            isSequential: m.is_sequential,
            items: itemsByModule.get(m.id) ?? [],
          })),
        )
      : null
    const modules: CurriculumModule[] = phaseModules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      items: itemsByModule.get(m.id) ?? [],
      isLocked: locks?.get(m.id)?.isLocked ?? false,
      blockedBy: locks?.get(m.id)?.blockedBy ?? null,
    }))
    let itemCount = 0
    let completedCount = 0
    for (const m of modules) {
      itemCount += m.items.length
      for (const i of m.items) if (i.isCompleted) completedCount += 1
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
 * Flatten a curriculum into its openable items in render order
 * (items in locked modules are skipped). Useful for prev/next
 * navigation.
 */
export function flattenCurriculumItems(
  curriculum: FullCurriculum,
): CurriculumItem[] {
  const flat: CurriculumItem[] = []
  for (const phase of curriculum.phases) {
    for (const module of phase.modules) {
      if (module.isLocked) continue
      for (const item of module.items) flat.push(item)
    }
  }
  return flat
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

/**
 * Compute the previous and next visible items relative to a given
 * content id. Used by the viewer's "Continue" button.
 */
export function findAdjacentItems(
  curriculum: FullCurriculum,
  contentId: string,
): { prev: CurriculumItem | null; next: CurriculumItem | null } {
  const flat = flattenCurriculumItems(curriculum)
  const idx = flat.findIndex((i) => i.id === contentId)
  if (idx === -1) return { prev: null, next: null }
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  }
}
