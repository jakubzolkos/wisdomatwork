import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { InviteUserDialog } from './invite-user-dialog'
import { BulkInviteDialog } from './bulk-invite-dialog'
import { UserRow } from './user-row'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { isCohort, type Cohort } from '@/lib/cohorts'
import { UsersSearch } from './users-search'
import { Users, Building2, BarChart3, CheckCircle2 } from 'lucide-react'

type CohortSummary = { id: string; name: string }

type UserRowData = {
  id: string
  full_name: string | null
  email: string | null
  title: string | null
  role: Role
  cohort: Cohort | null
  deactivated_at: string | null
  cohort_id: string | null
  cohort_name: string | null
  last_sign_in_at: string | null
  invited_at: string | null
  email_confirmed_at: string | null
  /**
   * Status of the most recent invitation row for this user's email,
   * if any. Drives the activation status badge so admins can tell
   * "we sent an invite, they haven't activated yet" apart from
   * "they're a fully active user" without relying solely on
   * `last_sign_in_at`.
   */
  invitation_status:
    | 'pending'
    | 'sent'
    | 'accepted'
    | 'failed'
    | 'expired'
    | 'cancelled'
    | null
  invitation_last_sent_at: string | null
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string; school_team?: string; cohort?: string; page?: string }>
}) {
  const params = await searchParams
  const search = params.search?.toLowerCase() || ''
  const roleFilter = params.role || ''
  const schoolTeamFilter = params.school_team || ''
  const cohortFilter = params.cohort || ''
  const page = parseInt(params.page || '1', 10)
  const perPage = 25

  const supabase = await createClient()
  const admin = createAdminClient()

  // Cohorts for the assignment dropdown.
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, name')
    .order('name', { ascending: true })

  // Profiles (DB is source of truth for name/role/title/cohort).
    const { data: profiles } = await supabase
    .from('profiles')
    .select(
      `
        id, full_name, email, title, role, cohort, deactivated_at, school_team_id,
        cohort_members ( cohort_id, cohorts ( id, name ) ),
        school_teams ( id, cohort_id, cohorts ( id, name ) )
      `,
    )
    .order('full_name', { ascending: true, nullsFirst: false })

  // Auth metadata (invite/last sign-in) via service role.
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authById = new Map(authList?.users.map((u) => [u.id, u]))

  // Pull the most recent invitation per email so the status column
  // can show real activation state (Invited / Activated / etc.)
  // independently of the auth `last_sign_in_at` heuristic. We pick
  // the latest row by `last_sent_at` to handle resends cleanly.
  const { data: invitationRows } = await admin
    .from('invitations')
    .select('email, status, last_sent_at')
    .order('last_sent_at', { ascending: false, nullsFirst: false })
  const invitationByEmail = new Map<
    string,
    { status: UserRowData['invitation_status']; last_sent_at: string | null }
  >()
  for (const row of (invitationRows ?? []) as Array<{
    email: string | null
    status: string | null
    last_sent_at: string | null
  }>) {
    if (!row.email) continue
    const key = row.email.toLowerCase()
    if (invitationByEmail.has(key)) continue // first wins because pre-sorted
    invitationByEmail.set(key, {
      status: (row.status as UserRowData['invitation_status']) ?? null,
      last_sent_at: row.last_sent_at,
    })
  }

  const users: UserRowData[] = (profiles ?? []).map((p: any) => {
    const member = Array.isArray(p.cohort_members) ? p.cohort_members[0] : p.cohort_members
    const cohort = member?.cohorts ?? null
    const authUser = authById.get(p.id)
    const invitation = p.email
      ? invitationByEmail.get(String(p.email).toLowerCase())
      : undefined
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      title: p.title,
      role: p.role as Role,
      cohort: isCohort(p.cohort) ? p.cohort : null,
      deactivated_at: p.deactivated_at,
      cohort_id: cohort?.id ?? null,
      cohort_name: cohort?.name ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      invited_at: authUser?.invited_at ?? null,
      email_confirmed_at: authUser?.email_confirmed_at ?? null,
      invitation_status: invitation?.status ?? null,
      invitation_last_sent_at: invitation?.last_sent_at ?? null,
    }
  })

  // Filter users based on search, role, school team, and cohort
  let filteredUsers = users
  if (search) {
    filteredUsers = filteredUsers.filter(
      (u) =>
        (u.full_name?.toLowerCase().includes(search) ?? false) ||
        (u.email?.toLowerCase().includes(search) ?? false) ||
        (u.title?.toLowerCase().includes(search) ?? false),
    )
  }
  if (roleFilter) {
    filteredUsers = filteredUsers.filter((u) => u.role === roleFilter)
  }
  if (schoolTeamFilter) {
    filteredUsers = filteredUsers.filter((u) => u.cohort_name === schoolTeamFilter)
  }
  if (cohortFilter) {
    filteredUsers = filteredUsers.filter((u) => u.cohort === cohortFilter)
  }

  // Calculate statistics
  const totalFellows = users.filter((u) => u.role === 'fellow').length
  const activeFellows = users.filter(
    (u) => u.role === 'fellow' && !u.deactivated_at && u.email_confirmed_at,
  ).length
  const uniqueSchoolTeams = new Set(
    users
      .map((u) => u.cohort_name)
      .filter((name) => name !== null && name !== undefined),
  ).size
  const uniqueCohorts = new Set(users.map((u) => u.cohort).filter((c) => c !== null)).size

  // Pagination
  const totalFiltered = filteredUsers.length
  const totalPages = Math.ceil(totalFiltered / perPage)
  const start = (page - 1) * perPage
  const end = start + perPage
  const paginatedUsers = filteredUsers.slice(start, end)

  const cohortList: CohortSummary[] = (cohorts ?? []).map((c) => ({ id: c.id, name: c.name }))

  // Get unique school teams (cohort names) for filter dropdown
  const schoolTeamSet = new Set(
    users
      .map((u) => u.cohort_name)
      .filter((name): name is string => name !== null && name !== undefined),
  )
  const schoolTeamList = Array.from(schoolTeamSet)
    .sort()
    .map((name) => ({ id: name, name }))

  // Get unique cohorts (A, B, C) from user data for filter dropdown
  const cohortLetters = new Set(users.map((u) => u.cohort).filter((c): c is Cohort => c !== null))
  const cohortFilterList = Array.from(cohortLetters)
    .sort()
    .map((letter) => ({ id: letter, name: letter }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-2"
        eyebrow="Admin console"
        title="Users"
        description={`${users.length} total · Invite new people, adjust roles, and assign cohorts to fellows.`}
        actions={
          <>
            <BulkInviteDialog cohorts={cohortList} />
            <InviteUserDialog cohorts={cohortList} />
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total Fellows
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{totalFellows}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Active
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{activeFellows}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                School Teams
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{uniqueSchoolTeams}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Cohorts
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{uniqueCohorts}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <UsersSearch cohorts={cohortFilterList} schoolTeams={schoolTeamList} />

      {/* Users List */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="hidden grid-cols-12 gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-3">School Team</div>
            <div className="col-span-1">Cohort</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          <ul className="divide-y divide-border">
            {paginatedUsers.map((u) => (
              <UserRow key={u.id} user={u} cohorts={cohortList} />
            ))}
            {paginatedUsers.length === 0 && (
              <li className="p-10 text-center text-sm text-muted-foreground">
                {filteredUsers.length === 0 && search
                  ? 'No users match your search.'
                  : 'No users found.'}
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {start + 1} to {Math.min(end, totalFiltered)} of {totalFiltered} users
          </p>
          <div className="flex flex-wrap gap-2">
            {page > 1 && (
              <a
                href={`/admin/users?search=${encodeURIComponent(search)}&role=${roleFilter}&school_team=${schoolTeamFilter}&cohort=${cohortFilter}&page=${page - 1}`}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Previous
              </a>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/admin/users?search=${encodeURIComponent(search)}&role=${roleFilter}&school_team=${schoolTeamFilter}&cohort=${cohortFilter}&page=${p}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-foreground hover:bg-accent'
                }`}
              >
                {p}
              </a>
            ))}
            {page < totalPages && (
              <a
                href={`/admin/users?search=${encodeURIComponent(search)}&role=${roleFilter}&school_team=${schoolTeamFilter}&cohort=${cohortFilter}&page=${page + 1}`}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Roles: {Object.values(ROLE_LABELS).join(' · ')}
      </p>
    </div>
  )
}
