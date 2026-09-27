import { Users } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { BiosDirectory } from '@/components/community/bios-directory'
import { SectionHeader } from '@/components/community/section-header'
import { getSectionBySlug } from '@/lib/community/sections'
import type { DirectoryProfile } from '@/lib/types/profile'

export const metadata = {
  title: 'Fellow Bios | Community | Leadership Fellowship',
}

interface RawProfile {
  id: string
  full_name: string | null
  email: string | null
  title: string | null
  avatar_url: string | null
  role: string | null
  cohort: string | null
  bio: string | null
  // Community of Practice phase 1 fields (migration 049). Optional
  // because legacy seed data may be NULL.
  linkedin_url: string | null
  twitter_url: string | null
  website_url: string | null
  looking_for: string | null
  willing_to_help: string | null
  years_in_education: number | null
  community_role: string | null
  featured_member_from: string | null
  featured_member_until: string | null
}

interface RawMembership {
  profile_id: string
  cohorts: { name: string | null } | null
}

/**
 * /community/bios - the searchable directory of fellows + facilitators.
 *
 * The directory always lists every active fellow, facilitator, and
 * admin (faculty roles), regardless of which school leadership team
 * the viewer belongs to. Fellows in turn see the entire fellowship
 * cohort, with rich filters (name search, school team, role tabs)
 * to narrow down.
 *
 * School-team membership comes from `cohort_members → cohorts(name)`.
 * `cohorts` here are the school leadership teams (Lincoln, IVA,
 * Atchison, ...) - NOT the A/B/C admission cohort, which is the
 * single-letter `profiles.cohort` text column. Some members
 * (admins, brand-new fellows) belong to no team and surface with no
 * school chip.
 */
export default async function CommunityBiosPage() {
  const user = await requireUser()
  const section = getSectionBySlug('bios')!
  const supabase = await createClient()

  // Step 1: pull every active member we want to surface. Single
  // round-trip, ordered by name so the grid is alphabetised by
  // default and the team dropdown renders deterministically.
  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select(
      `id, full_name, email, title, avatar_url, role, cohort, bio,
       linkedin_url, twitter_url, website_url,
       looking_for, willing_to_help, years_in_education, community_role,
       featured_member_from, featured_member_until`,
    )
    .in('role', ['fellow', 'facilitator', 'admin'])
    .is('deactivated_at', null)
    .order('full_name', { ascending: true })
    .limit(500)
    .returns<RawProfile[]>()

  const profileIds = (rawProfiles ?? []).map((p) => p.id)

  // Step 2: school-team membership for those profiles. We fetch
  // separately (rather than nesting under profiles) because a
  // profile can belong to multiple teams - the join would multiply
  // rows and force us to dedupe anyway. We pick the first team
  // (alphabetical) as the displayed `school_name`; the whole list
  // is also exposed via `school_names` for client-side filtering.
  const membershipByProfile = new Map<string, string[]>()
  if (profileIds.length > 0) {
    const { data: memberships } = await supabase
      .from('cohort_members')
      .select('profile_id, cohorts:cohort_id ( name )')
      .in('profile_id', profileIds)
      .returns<RawMembership[]>()

    for (const m of memberships ?? []) {
      const name = m.cohorts?.name?.trim()
      if (!name) continue
      const list = membershipByProfile.get(m.profile_id) ?? []
      list.push(name)
      membershipByProfile.set(m.profile_id, list)
    }
    // Sort each profile's team list alphabetically so the "primary"
    // team (first element) is stable across renders.
    for (const [id, names] of membershipByProfile) {
      membershipByProfile.set(id, [...new Set(names)].sort())
    }
  }

  const profiles: DirectoryProfile[] = (rawProfiles ?? []).map((p) => {
    const teams = membershipByProfile.get(p.id) ?? []
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      title: p.title,
      avatar_url: p.avatar_url,
      role: p.role,
      cohort: p.cohort,
      bio: p.bio,
      // Primary (alphabetical) team is the displayed chip; null when
      // the member isn't on any team yet. The full list is mirrored
      // in `school_names` for the team-filter dropdown.
      school_name: teams[0] ?? null,
      school_names: teams,
      // CoP phase 1 enrichments. Pass-through; null-safe.
      linkedin_url: p.linkedin_url,
      twitter_url: p.twitter_url,
      website_url: p.website_url,
      looking_for: p.looking_for,
      willing_to_help: p.willing_to_help,
      years_in_education: p.years_in_education,
      community_role: p.community_role,
      featured_member_from: p.featured_member_from,
      featured_member_until: p.featured_member_until,
    }
  })

  return (
    <>
      <div className="flex flex-col">
        <SectionHeader
          section={section}
          canPost={false}
        />

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Users className="size-[18px]" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            No fellows or faculty are listed yet.
          </p>
        </div>
      ) : (
        <BiosDirectory
          profiles={profiles}
          showCohort={user.role === 'admin'}
        />
      )}
    </div>
    </>
  )
}
