'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

type CohortSummary = { id: string; name: string }
type SchoolTeam = { id: string; name: string }

export function UsersSearch({
  cohorts,
  schoolTeams,
}: {
  cohorts: CohortSummary[]
  schoolTeams: SchoolTeam[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.get('search') || ''
  const role = searchParams.get('role') || ''
  const schoolTeam = searchParams.get('school_team') || ''
  const cohort = searchParams.get('cohort') || ''

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set('search', value)
    } else {
      params.delete('search')
    }
    params.set('page', '1')
    router.push(`/admin/users?${params.toString()}`)
  }

  const handleRoleFilter = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set('role', value)
    } else {
      params.delete('role')
    }
    params.set('page', '1')
    router.push(`/admin/users?${params.toString()}`)
  }

  const handleSchoolTeamFilter = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set('school_team', value)
    } else {
      params.delete('school_team')
    }
    params.set('page', '1')
    router.push(`/admin/users?${params.toString()}`)
  }

  const handleCohortFilter = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set('cohort', value)
    } else {
      params.delete('cohort')
    }
    params.set('page', '1')
    router.push(`/admin/users?${params.toString()}`)
  }

  const handleClearFilters = () => {
    router.push('/admin/users')
  }

  const hasFilters = search || role || schoolTeam || cohort

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Search Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or title..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm shadow-xs transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleFilter(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">All roles</option>
              <option value="fellow">Fellow</option>
              <option value="facilitator">Facilitator</option>
              <option value="admin">Admin</option>
              <option value="team_lead">Team Lead</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">
              School Team
            </label>
            <select
              value={schoolTeam}
              onChange={(e) => handleSchoolTeamFilter(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">All teams</option>
              {schoolTeams.map((team) => (
                <option key={team.id} value={team.name}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">
              Cohort
            </label>
            <select
              value={cohort}
              onChange={(e) => handleCohortFilter(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">All cohorts</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
