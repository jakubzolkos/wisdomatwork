import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import { loadFullCurriculum } from '@/lib/curriculum-tree'

/**
 * Per-phase progress for the current user + each of their school
 * team teammates. Powers the dashboard's "your progress / your
 * team's progress" meters.
 *
 * "Teammate" === another fellow on at least one of the current
 * user's school leadership teams (`public.cohort_members`).
 * Migration 049 ("School team peers read completions") lets two
 * fellows read each other's completion rows iff they share at
 * least one cohort_members row, so this loader runs entirely as
 * the signed-in user - no service-role escape hatch needed.
 */

export interface TeammateProgress {
  id: string
  name: string
  initials: string
  avatarUrl: string | null
  completed: number
  /** 0..100, rounded; 0 when itemCount is 0. */
  percent: number
}

export interface PhaseProgress {
  id: string
  title: string
  itemCount: number
  /** Current user's own meter for this phase. */
  me: { completed: number; percent: number }
  /** Cohort teammates ordered by progress desc, then name. */
  teammates: TeammateProgress[]
}

export interface TeamProgressData {
  phases: PhaseProgress[]
  /** Total cohort teammates returned (pre-truncation). Useful for the UI. */
  teammateCount: number
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export async function loadTeamProgress(): Promise<TeamProgressData> {
  const user = await requireUser()
  const supabase = await createClient()

  // Reuse the cached curriculum loader so the dashboard layout +
  // this query share the same database round-trip. We only need the
  // visible item ids per phase to scope teammates' completion counts
  // - any item the current user can't see is also irrelevant for
  // their teammates' meters.
  const curriculum = await loadFullCurriculum()

  // Locked phases have no accessible items for this fellow, so
  // they're dropped from the progress meters - they belong on the
  // curriculum tree (where they read as "Locked"), not on a 0%
  // meter card. Privileged users never get `isLocked: true`.
  const accessiblePhases = curriculum.phases.filter((p) => !p.isLocked)

  // Build a contentId -> phaseId index for O(1) bucket assignment.
  const phaseByItem = new Map<string, string>()
  const itemCountByPhase = new Map<string, number>()
  for (const phase of accessiblePhases) {
    let count = 0
    for (const module of phase.modules) {
      for (const item of module.items) {
        // Placeholder surveys (no link yet) don't count, matching the
        // curriculum tree's totals.
        if (item.isPending) continue
        phaseByItem.set(item.id, phase.id)
        count += 1
      }
    }
    itemCountByPhase.set(phase.id, count)
  }

  // 1) Look up every school leadership team the current user
  //    belongs to. No memberships -> no teammates, but we still
  //    return per-phase progress so the user's own meters render.
  const { data: myTeamRows } = await supabase
    .from('cohort_members')
    .select('cohort_id')
    .eq('profile_id', user.id)
    .returns<Array<{ cohort_id: string }>>()

  const myTeamIds = (myTeamRows ?? []).map((r) => r.cohort_id)

  // 2) Find every other fellow who shares at least one of those
  //    teams. We dedupe across teams so a fellow on two of the
  //    user's teams only appears once.
  let teammates: Array<{
    id: string
    full_name: string | null
    avatar_url: string | null
  }> = []
  if (myTeamIds.length > 0) {
    const { data: peerRows } = await supabase
      .from('cohort_members')
      .select('profile_id')
      .in('cohort_id', myTeamIds)
      .neq('profile_id', user.id)
      .returns<Array<{ profile_id: string }>>()

    const peerIds = Array.from(
      new Set((peerRows ?? []).map((r) => r.profile_id)),
    )

    if (peerIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', peerIds)
        .eq('role', 'fellow')
        .is('deactivated_at', null)
        .order('full_name', { ascending: true })
        .returns<
          Array<{
            id: string
            full_name: string | null
            avatar_url: string | null
          }>
        >()
      teammates = data ?? []
    }
  }

  // Pull every completion row visible under RLS for { me + teammates },
  // but only for items in the visible curriculum. One round-trip,
  // grouped client-side.
  const profileIds = [user.id, ...teammates.map((t) => t.id)]
  const visibleItemIds = Array.from(phaseByItem.keys())

  let completionRows: Array<{ profile_id: string; content_id: string }> = []
  if (profileIds.length > 0 && visibleItemIds.length > 0) {
    const { data } = await supabase
      .from('user_content_completions')
      .select('profile_id, content_id')
      .in('profile_id', profileIds)
      .in('content_id', visibleItemIds)
      .returns<Array<{ profile_id: string; content_id: string }>>()
    completionRows = data ?? []
  }

  // profile -> phase -> count
  const tally = new Map<string, Map<string, number>>()
  for (const row of completionRows) {
    const phaseId = phaseByItem.get(row.content_id)
    if (!phaseId) continue
    let perProfile = tally.get(row.profile_id)
    if (!perProfile) {
      perProfile = new Map()
      tally.set(row.profile_id, perProfile)
    }
    perProfile.set(phaseId, (perProfile.get(phaseId) ?? 0) + 1)
  }

  const phases: PhaseProgress[] = accessiblePhases.map((phase) => {
    const total = itemCountByPhase.get(phase.id) ?? 0
    const myCompleted = tally.get(user.id)?.get(phase.id) ?? 0

    const teamRows: TeammateProgress[] = teammates.map((t) => {
      const completed = tally.get(t.id)?.get(phase.id) ?? 0
      return {
        id: t.id,
        name: t.full_name ?? 'Teammate',
        initials: initialsFor(t.full_name),
        avatarUrl: t.avatar_url,
        completed,
        percent: pct(completed, total),
      }
    })

    // Most engaged teammates surface first; ties break alphabetically
    // (the source array is already name-sorted).
    teamRows.sort((a, b) => b.percent - a.percent)

    return {
      id: phase.id,
      title: phase.title,
      itemCount: total,
      me: { completed: myCompleted, percent: pct(myCompleted, total) },
      teammates: teamRows,
    }
  })

  return { phases, teammateCount: teammates.length }
}
