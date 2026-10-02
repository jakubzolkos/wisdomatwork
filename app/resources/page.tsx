import { requireUser } from '@/lib/auth-server'
import { canUserSeeLibraryResource } from '@/lib/content-access'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/top-bar'
import {
  LibraryView,
  type LibraryResource,
} from '@/components/library/library-view'

export const metadata = {
  title: 'Library | Leadership Fellowship',
  description:
    'Curated documents, videos, and readings for the Leadership Fellowship.',
}

/** Allowed values mirror the CHECK constraint on community_resources. */
const VALID_TYPES = new Set(['document', 'video', 'link', 'reading'])

/**
 * Library route. Server component: pulls every published resource,
 * splits Recommended Resources (universal) from My Resources (cohort-gated),
 * applies strict cohort assignment for fellows, then hands the lists
 * to the client `<LibraryView>` for tabs / search / filters.
 *
 * Cohort rules:
 *  - Universal rows (is_universal=true): visible to every authenticated user.
 *  - Cohort-gated rows for fellows (is_universal=false): strict assignment
 *    only. A fellow ONLY sees resources explicitly assigned to their cohort.
 *    A Cohort C fellow does NOT see resources assigned to A or B.
 *    Uses `canUserSeeLibraryResource` (exact cohort matching, not cumulative).
 *  - Facilitators / admins: see every resource so they can curate.
 *
 * Test cases:
 *  - Case 1: Fellow in Cohort C, no My Resources assigned to C → sees zero My Resources
 *  - Case 2: Fellow in Cohort A, resource assigned to A → sees it
 *  - Case 3: Fellow in Cohort C, resource assigned to A → does NOT see it
 *  - Case 4: Fellow in Cohort C, resource assigned to A+B → does NOT see it
 *  - Case 5: Any fellow, resource is Recommended → all see it
 */
export default async function LibraryPage() {
  // requireUser redirects to /auth/login when there's no session;
  // every code path below can assume a real CurrentUser.
  const user = await requireUser()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('community_resources')
    .select(
      'id, title, author, description, url, resource_type, tags, cohorts, is_universal, created_at, cover_url',
    )
    .order('created_at', { ascending: false })

  const all = rows ?? []

  // Two parallel slices. Visibility comes from the same rule the
  // stored-file route uses (canUserSeeLibraryResource), so a row a
  // fellow can't see here can't be downloaded either.
  const universalRows = all.filter((r) => r.is_universal === true)
  const cohortGatedRows = all
    .filter((r) => r.is_universal !== true)
    .filter((r) => canUserSeeLibraryResource(user, r))

  // Map raw rows -> view shape. Old rows that pre-date 033 may have
  // an unexpected resource_type from a hand edit; we coerce anything
  // unknown to 'reading' so the icon picker is always defined.
  function toResource(r: (typeof all)[number]): LibraryResource {
    return {
      id: r.id,
      title: r.title,
      // `author` may be NULL on legacy rows created before migration
      // 043; the view treats null as "no attribution" and just hides
      // the byline rather than rendering "by null".
      author: (r as { author?: string | null }).author ?? null,
      description: r.description,
      url: r.url,
      resourceType: VALID_TYPES.has(r.resource_type)
        ? (r.resource_type as LibraryResource['resourceType'])
        : 'reading',
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      cohorts: Array.isArray(r.cohorts) ? (r.cohorts as string[]) : [],
      isUniversal: r.is_universal === true,
      createdAt: r.created_at,
      coverUrl: r.cover_url ?? null,
    }
  }

  const myResources: LibraryResource[] = cohortGatedRows.map(toResource)
  // Further Reading (Recommended): filter to only include Readings,
  // Videos, and Documents. Exclude Field Guides (link type).
  const furtherReading: LibraryResource[] = universalRows
    .filter((r) => {
      const type = VALID_TYPES.has(r.resource_type)
        ? r.resource_type
        : 'reading'
      return type !== 'link'
    })
    .map(toResource)

  const canManage = user.role === 'admin' || user.role === 'facilitator'
  // Cohort labels are program-internal staging metadata. Surface
  // them on cards / list rows for admins only - facilitators and
  // fellows shouldn't see them.
  const showCohort = user.role === 'admin'

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        <LibraryView
          myResources={myResources}
          furtherReading={furtherReading}
          canManage={canManage}
          showCohort={showCohort}
        />
      </main>
    </div>
  )
}
