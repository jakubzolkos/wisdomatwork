/**
 * Shared definition of the high-level Cohort enum (A / B / C).
 *
 * Note: this is **not** the same concept as the `cohorts` table in
 * the database. Historically that table represented program "cohorts"
 * but in the product it is now surfaced as "School Team" - a grouping
 * of staff from one school. The `Cohort` here is a coarser, all-program
 * label used to gate phases / items / library resources to subsets of
 * fellows. See migration 019_cohort_gating.sql.
 */

export const COHORTS = ['A', 'B', 'C'] as const

export type Cohort = (typeof COHORTS)[number]

export function isCohort(value: unknown): value is Cohort {
  return typeof value === 'string' && (COHORTS as readonly string[]).includes(value)
}

/**
 * The three pathways, by cohort letter. The letter is the stored value
 * (and what content is gated by); the name is what people see.
 *   A = Wisdom Coaching, B = Deep Learning, C = Liaisons (the expert
 *   alumni panel, who get selected pilot tools and resources).
 */
export const COHORT_NAMES: Record<Cohort, string> = {
  A: 'Wisdom Coaching',
  B: 'Deep Learning',
  C: 'Liaisons',
}

/** Display label for a cohort letter, e.g. "Cohort A (Wisdom Coaching)" or "Liaisons". */
export function cohortLabel(value: string | null | undefined): string {
  if (!isCohort(value)) return value ? `Cohort ${value}` : 'No cohort'
  return value === 'C' ? COHORT_NAMES.C : `Cohort ${value} (${COHORT_NAMES[value]})`
}

/** The Liaisons pathway: expert alumni, kept to their own content. */
export function isLiaisonCohort(value: string | null | undefined): boolean {
  return value === 'C'
}

/**
 * Returns true if a fellow with `userCohort` should be allowed to see
 * content gated by `targetCohorts`. Strict assigned-only access:
 *
 *  - empty `targetCohorts` array  -> NOT visible to any fellow
 *                                    (curriculum is not assigned to
 *                                    anyone yet)
 *  - non-empty                   -> only fellows whose cohort is listed
 *  - fellow with no cohort set   -> can never see gated content;
 *                                    they must be assigned a cohort
 *                                    first
 *
 * Admins / facilitators bypass this check at the call site (they always
 * see everything regardless of cohort and never carry a cohort value).
 */
export function fellowCanAccess(
  targetCohorts: readonly string[] | null | undefined,
  userCohort: Cohort | null | undefined,
): boolean {
  if (!targetCohorts || targetCohorts.length === 0) return false
  if (!userCohort) return false
  return targetCohorts.includes(userCohort)
}

/**
 * Cumulative-access variant of {@link fellowCanAccess}.
 *
 * Used by the Library page where Karen wants "stage-up" semantics:
 * a fellow in Cohort B can see resources released for A *and* B; a
 * fellow in C sees A + B + C. The simplest way to model that on top
 * of the existing `cohorts text[]` column is to interpret each entry
 * as the stage at which the resource was released, and visibility =
 * "any of those stages is at or below the user's stage".
 *
 *  - row.cohorts = ['A']     -> visible to A, B, C
 *  - row.cohorts = ['B']     -> visible to B, C
 *  - row.cohorts = ['C']     -> visible to C only
 *  - row.cohorts = ['A','B'] -> visible to A, B, C (driven by 'A')
 *  - row.cohorts empty/null  -> NOT visible (unassigned, same as
 *                                fellowCanAccess)
 *
 * Curriculum gating still uses {@link fellowCanAccess} so that a
 * phase pinned to "B only" stays B-only - the cumulative rule is a
 * Library-only concession.
 */
export function cohortReleasedFor(
  targetCohorts: readonly string[] | null | undefined,
  userCohort: Cohort | null | undefined,
): boolean {
  if (!targetCohorts || targetCohorts.length === 0) return false
  if (!userCohort) return false
  const userIdx = COHORTS.indexOf(userCohort)
  if (userIdx < 0) return false
  // Visible if any of the target labels is at or before the user's
  // stage in the canonical A < B < C ordering.
  return targetCohorts.some((label) => {
    const idx = COHORTS.indexOf(label as Cohort)
    return idx >= 0 && idx <= userIdx
  })
}
