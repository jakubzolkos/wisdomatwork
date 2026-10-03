/**
 * Single source of truth for "may this user open this thing?".
 *
 * The page that renders an item and the file route that serves the
 * item's stored file both call these, so the page and its files are
 * always gated together. These are the cohort rules only; the
 * sequence lock (earlier modules must be complete) needs the user's
 * progress and is answered by findCurriculumItem in
 * lib/curriculum-tree.ts, which the same callers also check.
 */

import { fellowCanAccess } from '@/lib/cohorts'
import {
  canFellowSeeContent,
  canFellowSeeModule,
  canFellowSeePhase,
} from '@/lib/curriculum'
import type { CurrentUser } from '@/lib/user-context'

type AccessUser = Pick<CurrentUser, 'role' | 'cohort'>

/**
 * Curriculum item, applying the Phase -> Module -> Content cohort
 * cascade. Admins and facilitators bypass it; an admin previewing as
 * a fellow arrives here with role 'fellow' and is gated like one.
 */
export function canUserSeeItem(
  user: AccessUser,
  phase: { cohorts: string[] | null },
  module: { cohorts: string[] | null },
  item: { cohorts: string[] | null },
): boolean {
  if (user.role !== 'fellow') return true
  const userCohort = user.cohort ?? null
  return (
    canFellowSeePhase(phase.cohorts, userCohort) &&
    canFellowSeeModule(module.cohorts, phase.cohorts, userCohort) &&
    canFellowSeeContent(item.cohorts, phase.cohorts, userCohort, module.cohorts)
  )
}

/**
 * Library resource. Universal rows are open to everyone signed in;
 * cohort-gated rows use strict assignment for fellows. Staff see all.
 */
export function canUserSeeLibraryResource(
  user: AccessUser,
  resource: { cohorts: string[] | null; is_universal: boolean | null },
): boolean {
  if (resource.is_universal === true) return true
  if (user.role !== 'fellow') return true
  return fellowCanAccess(resource.cohorts, user.cohort ?? null)
}
