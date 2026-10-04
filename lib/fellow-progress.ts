import { requireAdmin } from '@/lib/auth-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCohort, type Cohort } from '@/lib/cohorts'
import {
  buildCurriculum,
  fetchCurriculumRows,
  type CurriculumPhase,
  type CurriculumRows,
  type FullCurriculum,
} from '@/lib/curriculum-tree'

/**
 * Admin read model for fellows' progress (Admin -> Progress).
 *
 * Each fellow's curriculum is built with the same rules they see
 * (lib/curriculum-tree.ts buildCurriculum): cohort visibility, release
 * dates, ended sessions, finished years. Reads use the service role
 * because reflections are owner-only under RLS, so every entry point
 * checks the real account is an admin first.
 */

export interface FellowProfile {
  id: string
  fullName: string
  email: string | null
  cohort: Cohort | null
  schoolName: string | null
  teamName: string | null
  deactivated: boolean
}

export interface PhaseProgress {
  id: string
  title: string
  done: number
  total: number
  /** The phase being paced now (the latest one the fellow has). */
  isCurrent: boolean
}

export interface FellowSummary extends FellowProfile {
  phases: PhaseProgress[]
  reflectionCount: number
  /** Latest completion or reflection, ISO. */
  lastActivity: string | null
  lastSignIn: string | null
}

export interface Reflection {
  response: string
  submittedAt: string
}

export interface FellowDetail {
  fellow: FellowProfile
  researchId: string | null
  lastSignIn: string | null
  curriculum: FullCurriculum
  /** When each item was ticked, ISO, by item id. */
  completedAt: ReadonlyMap<string, string>
  reflections: ReadonlyMap<string, Reflection>
}

type Admin = ReturnType<typeof createAdminClient>

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  cohort: string | null
  deactivated_at: string | null
  schools: { name: string } | null
  school_teams: { name: string } | null
}

const PROFILE_COLUMNS = 'id, full_name, email, cohort, deactivated_at, schools(name), school_teams(name)'

function toFellow(p: ProfileRow): FellowProfile {
  return {
    id: p.id,
    fullName: p.full_name ?? p.email ?? 'Unnamed fellow',
    email: p.email,
    cohort: isCohort(p.cohort) ? p.cohort : null,
    schoolName: p.schools?.name ?? null,
    teamName: p.school_teams?.name ?? null,
    deactivated: !!p.deactivated_at,
  }
}

/** Every row of a query, past PostgREST's 1,000-row page. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < size) return out
  }
}

type CompletionRow = { profile_id: string; content_id: string; completed_at: string }
type ReflectionRow = { profile_id: string; content_id: string; response: string; submitted_at: string }

function completionsQuery(admin: Admin, profileIds: string[]) {
  return fetchAll<CompletionRow>((from, to) =>
    admin
      .from('user_content_completions')
      .select('profile_id, content_id, completed_at')
      .in('profile_id', profileIds)
      .order('profile_id')
      .order('content_id')
      .range(from, to),
  )
}

function reflectionsQuery(admin: Admin, profileIds: string[]) {
  return fetchAll<ReflectionRow>((from, to) =>
    admin
      .from('user_content_reflections')
      .select('profile_id, content_id, response, submitted_at')
      .in('profile_id', profileIds)
      .order('profile_id')
      .order('content_id')
      .range(from, to),
  )
}

async function lastSignInById(admin: Admin): Promise<Map<string, string>> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const out = new Map<string, string>()
  for (const u of data?.users ?? []) if (u.last_sign_in_at) out.set(u.id, u.last_sign_in_at)
  return out
}

function curriculumFor(
  rows: CurriculumRows,
  fellow: FellowProfile,
  completions: CompletionRow[],
  reflections: ReflectionRow[],
): FullCurriculum {
  return buildCurriculum(
    rows,
    { role: 'fellow', cohort: fellow.cohort },
    {
      completed: new Set(completions.map((c) => c.content_id)),
      reflectionById: new Map(reflections.map((r) => [r.content_id, r.response])),
      // Session-only state the admin can't see; it only affects which
      // untouched items show as gated.
      linkClicks: new Set(),
      acceptedReflections: new Set(),
    },
    Date.now(),
  )
}

/** Same rule as buildCurriculum: the latest phase the fellow can open. */
export function currentPhaseId(phases: readonly CurriculumPhase[]): string | null {
  return phases.findLast((p) => !p.isLocked && p.modules.length > 0)?.id ?? null
}

function phaseProgress(curriculum: FullCurriculum): PhaseProgress[] {
  const current = currentPhaseId(curriculum.phases)
  return curriculum.phases
    .filter((p) => !p.isLocked)
    .map((p) => ({
      id: p.id,
      title: p.title,
      done: p.completedCount,
      total: p.itemCount,
      isCurrent: p.id === current,
    }))
}

function latest(...dates: Array<string | null | undefined>): string | null {
  let best: string | null = null
  for (const d of dates) if (d && (!best || d > best)) best = d
  return best
}

/** Every fellow with their progress per phase, sorted by name. */
export async function loadFellowProgressList(): Promise<FellowSummary[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const [{ data: profileRows, error }, rows, signIns] = await Promise.all([
    admin
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('role', 'fellow')
      .order('full_name', { ascending: true })
      .returns<ProfileRow[]>(),
    fetchCurriculumRows(admin),
    lastSignInById(admin),
  ])
  if (error) throw new Error(error.message)
  const fellows = (profileRows ?? []).map(toFellow)
  const ids = fellows.map((f) => f.id)
  const [completions, reflections] = ids.length
    ? await Promise.all([completionsQuery(admin, ids), reflectionsQuery(admin, ids)])
    : [[], []]

  const completionsBy = Map.groupBy(completions, (c) => c.profile_id)
  const reflectionsBy = Map.groupBy(reflections, (r) => r.profile_id)

  return fellows.map((fellow) => {
    const mine = completionsBy.get(fellow.id) ?? []
    const myReflections = reflectionsBy.get(fellow.id) ?? []
    return {
      ...fellow,
      phases: phaseProgress(curriculumFor(rows, fellow, mine, myReflections)),
      reflectionCount: myReflections.length,
      lastActivity: latest(
        ...mine.map((c) => c.completed_at),
        ...myReflections.map((r) => r.submitted_at),
      ),
      lastSignIn: signIns.get(fellow.id) ?? null,
    }
  })
}

/** One fellow's curriculum, tick dates and reflections; null if not a fellow. */
export async function loadFellowProgress(profileId: string): Promise<FellowDetail | null> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', profileId)
    .eq('role', 'fellow')
    .maybeSingle<ProfileRow>()
  if (!profile) return null
  const fellow = toFellow(profile)

  const [rows, completions, reflections, { data: research }, { data: auth }] = await Promise.all([
    fetchCurriculumRows(admin),
    completionsQuery(admin, [fellow.id]),
    reflectionsQuery(admin, [fellow.id]),
    admin
      .from('profile_research_ids')
      .select('research_id')
      .eq('profile_id', fellow.id)
      .maybeSingle<{ research_id: string }>(),
    admin.auth.admin.getUserById(fellow.id),
  ])

  return {
    fellow,
    researchId: research?.research_id ?? null,
    lastSignIn: auth?.user?.last_sign_in_at ?? null,
    curriculum: curriculumFor(rows, fellow, completions, reflections),
    completedAt: new Map(completions.map((c) => [c.content_id, c.completed_at])),
    reflections: new Map(
      reflections.map((r) => [r.content_id, { response: r.response, submittedAt: r.submitted_at }]),
    ),
  }
}


const DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Oct 7, 2026" (Eastern), or an em dash when there's no date. */
export function formatProgressDate(iso: string | null | undefined): string {
  return iso ? DATE.format(new Date(iso)) : '—'
}
