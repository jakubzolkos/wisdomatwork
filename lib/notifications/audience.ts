import type { SupabaseClient } from '@supabase/supabase-js'
import { cohortLabel } from '@/lib/cohorts'
import type { AudienceScope, NotificationRow } from './types'

/**
 * Minimal audience input the resolver needs. Pulled out so callers
 * can pass an in-flight draft (before insert) or a saved row.
 */
export type AudienceInput = Pick<
  NotificationRow,
  'audience_scope' | 'cohort_codes' | 'school_team_ids' | 'user_ids'
>

export interface ResolvedRecipient {
  id: string
  email: string | null
  full_name: string | null
  cohort: string | null
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  cohort: string | null
  deactivated_at: string | null
}

interface CohortMemberRow {
  profile_id: string
  cohort_id: string
  profiles: ProfileRow | null
}

/**
 * Resolves a notification's audience to the actual list of profiles
 * that should receive it. Active profiles only (deactivated users are
 * filtered out) and de-duplicated by id.
 *
 * Must be called with a service-role client (createAdminClient) so
 * that all profiles in the audience are visible regardless of RLS.
 */
export async function resolveRecipients(
  supabase: SupabaseClient,
  audience: AudienceInput,
): Promise<ResolvedRecipient[]> {
  const seen = new Map<string, ResolvedRecipient>()

  function add(p: ProfileRow | null) {
    if (!p || !p.id) return
    if (p.deactivated_at) return
    if (seen.has(p.id)) return
    seen.set(p.id, {
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      cohort: p.cohort,
    })
  }

  switch (audience.audience_scope) {
    case 'global': {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, cohort, deactivated_at')
        .is('deactivated_at', null)
      if (error) throw error
      for (const row of (data ?? []) as ProfileRow[]) add(row)
      break
    }

    case 'cohort': {
      const codes = (audience.cohort_codes ?? []).filter(Boolean)
      if (codes.length === 0) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, cohort, deactivated_at')
        .in('cohort', codes)
        .is('deactivated_at', null)
      if (error) throw error
      for (const row of (data ?? []) as ProfileRow[]) add(row)
      break
    }

    case 'school_team': {
      const teamIds = (audience.school_team_ids ?? []).filter(Boolean)
      if (teamIds.length === 0) return []
      const { data, error } = await supabase
        .from('cohort_members')
        .select(
          'profile_id, cohort_id, profiles!inner(id, email, full_name, cohort, deactivated_at)',
        )
        .in('cohort_id', teamIds)
      if (error) throw error
      for (const row of (data ?? []) as unknown as CohortMemberRow[]) {
        add(row.profiles)
      }
      break
    }

    case 'users': {
      const ids = (audience.user_ids ?? []).filter(Boolean)
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, cohort, deactivated_at')
        .in('id', ids)
      if (error) throw error
      for (const row of (data ?? []) as ProfileRow[]) add(row)
      break
    }

    case 'year':
    default:
      // `year` is a legacy scope kept for backwards compatibility. New
      // notifications never use it; existing year-scoped rows are
      // already marked sent (they pre-date the recipient table) so we
      // resolve to no recipients and let the dispatcher mark sent.
      return []
  }

  return [...seen.values()]
}

/**
 * Human-readable description of an audience, used by admin lists,
 * email footers, and audit logs.
 */
export function describeAudience(audience: AudienceInput): string {
  switch (audience.audience_scope) {
    case 'global':
      return 'Everyone'
    case 'cohort':
      return audience.cohort_codes && audience.cohort_codes.length
        ? audience.cohort_codes.map(cohortLabel).join(', ')
        : 'Cohort'
    case 'school_team': {
      const n = audience.school_team_ids?.length ?? 0
      return n === 1 ? '1 school team' : `${n} school teams`
    }
    case 'users': {
      const n = audience.user_ids?.length ?? 0
      return n === 1 ? '1 fellow' : `${n} fellows`
    }
    case 'year':
      return 'Year (legacy)'
    default:
      return 'Unknown'
  }
}

const AUDIENCE_SCOPES: readonly AudienceScope[] = [
  'global',
  'cohort',
  'school_team',
  'users',
] as const

export function isSupportedScope(value: unknown): value is AudienceScope {
  return (
    typeof value === 'string' &&
    (AUDIENCE_SCOPES as readonly string[]).includes(value)
  )
}
