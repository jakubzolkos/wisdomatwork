import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeader } from '@/components/page-header'
import { Building2, Users, Plus } from 'lucide-react'
import { AddSchoolForm } from './add-school-form'
import { AddTeamForm } from './add-team-form'
import { AddMemberForm } from './add-member-form'
import { RemoveMemberButton } from './remove-member-button'
import { TeamMenu } from './team-menu'
import { SchoolMenu } from './school-menu'

type SchoolRow = { id: string; name: string }
type SchoolTeamRow = {
  id: string
  school_id: string
  cohort_id: string
  name: string
}
type CohortRow = {
  id: string
  school_id: string
  name: string
  current_year: number
}
type MemberRow = {
  cohort_id: string
  profile_id: string
  profiles: { id: string; full_name: string | null; title: string | null }[] | null
}
type FellowRow = {
  id: string
  full_name: string | null
  title: string | null
  school_team_id: string | null
}

function initialsFor(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function cohortLabel(year: number): string {
  const labels: { [key: number]: string } = { 1: 'A', 2: 'B', 3: 'C' }
  return `Cohort ${labels[year] || '?'}`
}

export default async function AdminSchoolsPage() {
  const supabase = await createClient()

  const [{ data: schools }, { data: schoolTeams }, { data: members }, { data: fellows }] =
    await Promise.all([
      supabase.from('schools').select('id, name').order('name'),
      supabase.from('school_teams').select('id, school_id, cohort_id, name').order('name'),
      supabase
        .from('cohort_members')
        .select('cohort_id, profile_id, profiles:profiles(id, full_name, title)'),
      supabase
        .from('profiles')
        .select('id, full_name, title, school_team_id')
        .eq('role', 'fellow')
        .is('deactivated_at', null)
        .order('full_name', { ascending: true, nullsFirst: false }),
    ])

  const schoolList = (schools ?? []) as SchoolRow[]
  const schoolTeamList = (schoolTeams ?? []) as SchoolTeamRow[]
  const memberList = (members ?? []) as MemberRow[]
  const fellowList = (fellows ?? []) as FellowRow[]

  // Index structures - now based on school_teams instead of cohorts
  const teamsBySchool = new Map<string, SchoolTeamRow[]>()
  for (const st of schoolTeamList) {
    const arr = teamsBySchool.get(st.school_id) ?? []
    arr.push(st)
    teamsBySchool.set(st.school_id, arr)
  }

  const membersByCohort = new Map<string, MemberRow[]>()
  const assignedProfileIds = new Set<string>()
  for (const m of memberList) {
    const arr = membersByCohort.get(m.cohort_id) ?? []
    arr.push(m)
    membersByCohort.set(m.cohort_id, arr)
    assignedProfileIds.add(m.profile_id)
  }

  const membersBySchool = new Map<string, number>()
  for (const st of schoolTeamList) {
    const count = (membersByCohort.get(st.cohort_id) ?? []).length
    membersBySchool.set(st.school_id, (membersBySchool.get(st.school_id) ?? 0) + count)
  }

  // Fellows available to add to a team: anyone not already assigned to a school team
  const unassignedFellows = fellowList
    .filter((f) => !f.school_team_id)
    .map((f) => ({
      id: f.id,
      label: f.full_name
        ? f.title
          ? `${f.full_name} · ${f.title}`
          : f.full_name
        : '(unnamed)',
    }))

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <PageHeader
        className="mb-0"
        eyebrow="Admin console"
        title="Schools & Teams"
        description="Organize fellows into leadership teams by school. Each school can have multiple teams progressing through different years of the program."
      />

      {/* Summary Stats */}
      {schoolList.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="py-0">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Schools
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{schoolList.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Teams
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{schoolTeamList.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Total Members
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{memberList.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add School Button */}
      {schoolList.length > 0 && (
        <div>
          <AddSchoolForm />
        </div>
      )}

      {/* Schools List */}
      {schoolList.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card p-10 text-center">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Building2 className="size-[18px]" />
          </div>
          <div className="space-y-1">
            <h3>No schools yet</h3>
            <p className="text-sm text-muted-foreground">
              Add your first school to start organizing fellows into leadership teams.
            </p>
          </div>
          <AddSchoolForm />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {schoolList.map((school) => {
            const teamsForSchool = teamsBySchool.get(school.id) ?? []
            const totalMembers = membersBySchool.get(school.id) ?? 0

            return (
              <Card key={school.id} className="gap-0 overflow-hidden py-0">
                {/* School Header */}
                <CardHeader className="border-b border-border py-5 [.border-b]:pb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Building2 className="size-[18px]" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{school.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {teamsForSchool.length} team{teamsForSchool.length === 1 ? '' : 's'} ·{' '}
                          {totalMembers} member{totalMembers === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <SchoolMenu
                      schoolId={school.id}
                      initialName={school.name}
                      memberCount={totalMembers}
                    />
                  </div>
                </CardHeader>

                {/* Teams Section */}
                <CardContent className="p-0">
                  {teamsForSchool.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        No teams yet. Create your first team to get started.
                      </p>
                      <AddTeamForm
                        schoolId={school.id}
                        defaultName={`${school.name} Leadership Team`}
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {teamsForSchool.map((team) => {
                        const teamMembers = membersByCohort.get(team.cohort_id) ?? []

                        return (
                          <div key={team.id} className="p-5 sm:p-6">
                            {/* Team Header */}
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-semibold text-foreground">{team.name}</h3>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {teamMembers.length} member{teamMembers.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              <TeamMenu
                                cohortId={team.cohort_id}
                                initialName={team.name}
                                initialYear={1}
                                memberCount={teamMembers.length}
                              />
                            </div>

                            {/* Team Members */}
                            {teamMembers.length === 0 ? (
                              <div className="text-center py-6 text-sm text-muted-foreground">
                                <p className="mb-3">No members yet</p>
                                <AddMemberForm
                                  cohortId={team.cohort_id}
                                  fellows={unassignedFellows}
                                />
                              </div>
                            ) : (
                              <div className="space-y-2 mb-4">
                                {teamMembers.map((m) => {
                                  const fullName = m.profiles?.[0]?.full_name ?? '(Unnamed fellow)'
                                  const isUnnamed = !m.profiles?.[0]?.full_name
                                  return (
                                    <div
                                      key={m.profile_id}
                                      className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 transition-colors hover:bg-muted"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Avatar className="h-7 w-7 flex-shrink-0">
                                          <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
                                            {initialsFor(fullName)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                          <p className={`text-sm font-medium truncate ${isUnnamed ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                                            {fullName}
                                          </p>
                                          {m.profiles?.[0]?.title && (
                                            <p className="text-xs text-muted-foreground truncate">
                                              {m.profiles[0].title}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <RemoveMemberButton
                                        cohortId={team.cohort_id}
                                        profileId={m.profile_id}
                                        label={fullName}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Add Member */}
                            {unassignedFellows.length > 0 && (
                              <div className="mt-3">
                                <AddMemberForm
                                  cohortId={team.cohort_id}
                                  fellows={unassignedFellows}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add Team Button */}
                  <div className="border-t border-border px-6 py-4">
                    <AddTeamForm
                      schoolId={school.id}
                      defaultName={`${school.name} Leadership Team`}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
