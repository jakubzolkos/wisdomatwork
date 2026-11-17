/**
 * Curriculum domain model.
 *
 * The curriculum is two flat tables in the database:
 *
 *   - `years`  -> "phases"        (top-level groupings, e.g. "Year 1", "Foundations")
 *   - `labs`   -> "content items" (every fellow-facing piece of content)
 *
 * Each content item belongs to exactly one phase and one category
 * (see `CONTENT_CATEGORIES`), and has a single resource type (see
 * `RESOURCE_TYPES`) that drives icon + display behaviour. There are no
 * blocks, no nested groups, no per-content progress tracking - just
 * phase -> category -> ordered list of items.
 *
 * Cohort access works at two levels:
 *
 *   1. Phase-level (`years.cohorts`): which cohorts can see the phase
 *      at all. Empty array means the phase is unassigned and hidden
 *      from every fellow.
 *
 *   2. Content-level (`labs.cohorts`):
 *        - NULL     -> inherit from the parent phase
 *        - []       -> locked, hidden from every fellow even if the
 *                      phase itself is visible
 *        - ['A',..] -> override; only those cohorts can see the item,
 *                      and they must also be allowed by the phase
 *
 * Admins and facilitators always bypass these checks.
 */

import { fellowCanAccess, type Cohort } from '@/lib/cohorts'

// ============================================================================
// Categories
// ============================================================================

export const CONTENT_CATEGORIES = [
  {
    value: 'before_lab',
    label: 'Before the Lab',
    short: 'Before',
    description: 'Preparation - readings, reflections, and context to do before the live session.',
  },
  {
    value: 'during_lab',
    label: 'During the Lab',
    short: 'During',
    description: 'Materials used live in session: agenda, protocols, slides, join links.',
  },
  {
    value: 'after_lab',
    // Shown as one header: fieldwork, its tool, and the Reflection on
    // Practice all sit under it (Mark, Nov 2026).
    label: 'Wisdom Lab Fieldwork',
    short: 'Fieldwork',
    description: 'Fieldwork after the lab: the practice, its tool, and the Reflection on Practice.',
  },
  {
    value: 'general_resources',
    label: 'General Resources',
    short: 'Resources',
    description: 'Supporting reference materials available throughout this phase.',
  },
  {
    value: 'wisdom_coaching',
    label: 'Wisdom Coaching',
    short: 'Coaching',
    description: 'One-to-one coaching guidance, prompts, and companion documents.',
  },
  {
    value: 'community_of_practice',
    label: 'Community of Practice',
    short: 'Community',
    description: 'Cohort gatherings and peer-practice materials.',
  },
] as const

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]['value']
export const CONTENT_CATEGORY_VALUES = CONTENT_CATEGORIES.map((c) => c.value) as readonly ContentCategory[]

const CATEGORY_LOOKUP = new Map(CONTENT_CATEGORIES.map((c) => [c.value, c] as const))

export function getCategory(value: ContentCategory) {
  return CATEGORY_LOOKUP.get(value)!
}

export function isContentCategory(v: unknown): v is ContentCategory {
  return typeof v === 'string' && CATEGORY_LOOKUP.has(v as ContentCategory)
}

// ============================================================================
// Resource types
// ============================================================================

export const RESOURCE_TYPES = [
  { value: 'reading', label: 'Reading' },
  { value: 'video', label: 'Video' },
  { value: 'slide_deck', label: 'Slide deck' },
  { value: 'pdf', label: 'PDF' },
  { value: 'worksheet', label: 'Worksheet' },
  { value: 'reflection_prompt', label: 'Reflection prompt' },
  { value: 'survey', label: 'Survey' },
  { value: 'external_link', label: 'External link' },
  { value: 'protocol', label: 'Protocol' },
  { value: 'companion_guide', label: 'Companion guide' },
  { value: 'assignment', label: 'Assignment' },
  // Live session always carries a join URL (Zoom, Meet, etc.). The
  // form/validator below treat its `url` field as required.
  { value: 'live_session', label: 'Live session' },
  { value: 'other', label: 'Other' },
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]['value']
export const RESOURCE_TYPE_VALUES = RESOURCE_TYPES.map((r) => r.value) as readonly ResourceType[]

const RESOURCE_LOOKUP = new Map(RESOURCE_TYPES.map((r) => [r.value, r] as const))

export function getResourceType(value: ResourceType) {
  return RESOURCE_LOOKUP.get(value)!
}

export function isResourceType(v: unknown): v is ResourceType {
  return typeof v === 'string' && RESOURCE_LOOKUP.has(v as ResourceType)
}

// ============================================================================
// Cohort access
// ============================================================================

/**
 * Cohort access cascades down the hierarchy:
 *
 *   Phase  ->  Module  ->  Content
 *
 * At every level except the phase, NULL means "inherit from parent",
 * an empty array means "explicitly locked", and any non-empty array
 * is an override that *replaces* the inherited list. The phase itself
 * is the source of truth, so its NULL is treated the same as [].
 */

/**
 * Effective cohorts for a module, after cascading from its phase.
 * Returns the module's own list when set; otherwise inherits the
 * phase's list.
 */
export function effectiveModuleCohorts(
  moduleCohorts: readonly string[] | null | undefined,
  phaseCohorts: readonly string[] | null | undefined,
): readonly string[] {
  if (moduleCohorts == null) return phaseCohorts ?? []
  return moduleCohorts
}

/**
 * Effective cohorts for a content item, after cascading from its
 * module (which itself cascades from the phase).
 *
 * The optional `moduleCohorts` parameter lets older call sites that
 * don't yet have a module in scope keep working - they get the
 * pre-modules behaviour (inherit straight from the phase).
 */
export function effectiveCohorts(
  itemCohorts: readonly string[] | null | undefined,
  phaseCohorts: readonly string[] | null | undefined,
  moduleCohorts?: readonly string[] | null | undefined,
): readonly string[] {
  if (itemCohorts == null) {
    return effectiveModuleCohorts(moduleCohorts, phaseCohorts)
  }
  return itemCohorts
}

/** Whether a fellow with `userCohort` can see a given phase. */
export function canFellowSeePhase(
  phaseCohorts: readonly string[] | null | undefined,
  userCohort: Cohort | null | undefined,
): boolean {
  return fellowCanAccess(phaseCohorts ?? null, userCohort)
}

/**
 * Whether a fellow with `userCohort` can see a given module.
 * Visible when the parent phase is visible AND the effective module
 * cohorts (override OR inherited phase list) include the fellow.
 */
export function canFellowSeeModule(
  moduleCohorts: readonly string[] | null | undefined,
  phaseCohorts: readonly string[] | null | undefined,
  userCohort: Cohort | null | undefined,
): boolean {
  if (!canFellowSeePhase(phaseCohorts, userCohort)) return false
  return fellowCanAccess(
    effectiveModuleCohorts(moduleCohorts, phaseCohorts),
    userCohort,
  )
}

/**
 * Whether a fellow with `userCohort` can see a given content item,
 * applying the full Phase -> Module -> Content cascade.
 *
 * The `moduleCohorts` parameter is optional for backwards-compat with
 * any caller that hasn't been updated yet; passing `undefined` makes
 * inheritance fall straight through to the phase.
 */
export function canFellowSeeContent(
  itemCohorts: readonly string[] | null | undefined,
  phaseCohorts: readonly string[] | null | undefined,
  userCohort: Cohort | null | undefined,
  moduleCohorts?: readonly string[] | null | undefined,
): boolean {
  if (!canFellowSeePhase(phaseCohorts, userCohort)) return false
  if (moduleCohorts !== undefined) {
    if (
      !fellowCanAccess(
        effectiveModuleCohorts(moduleCohorts, phaseCohorts),
        userCohort,
      )
    ) {
      return false
    }
  }
  return fellowCanAccess(
    effectiveCohorts(itemCohorts, phaseCohorts, moduleCohorts),
    userCohort,
  )
}
