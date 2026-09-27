'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Search, Sparkles, X } from 'lucide-react'
import { MemberCard } from '@/components/profile/member-card'
import { ProfileModal } from '@/components/profile/profile-view'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type DirectoryProfile,
  initialsFor,
  roleLabelFor,
} from '@/lib/types/profile'

interface Props {
  profiles: DirectoryProfile[]
  /**
   * Whether to expose the cohort filter and the cohort chip on the
   * cards / modal. Cohort labels are program-internal staging data,
   * so the server only sets this true for admins.
   */
  showCohort?: boolean
}

const ALL = '__all__'

/**
 * People-type filter values. "Faculty" is the user-facing label for
 * program staff and covers both the `facilitator` and `admin` roles
 * in the database, so fellows can find program staff bios without
 * needing to know our internal role taxonomy.
 */
type PeopleType = typeof ALL | 'fellow' | 'faculty'

const FACULTY_ROLES = new Set(['facilitator', 'admin'])

/**
 * Fellow Bios grid for the Community page.
 *
 * Filters:
 *  - Free text search by name (deferred to keep typing smooth on
 *    larger lists; we re-render the filtered grid when the search
 *    settles).
 *  - Cohort dropdown - only the cohorts present in the data.
 *  - Team / school dropdown - same rule.
 *
 * Click a card -> opens the shared ProfileModal. The detailed
 * card variant is used here so each tile teases the bio - the
 * modal is reserved for the full view.
 */
/**
 * "Help orientation" filter values:
 *  - 'looking' shows members who filled in `looking_for`
 *  - 'offering' shows members who filled in `willing_to_help`
 *  - ALL skips the filter
 */
type HelpFilter = typeof ALL | 'looking' | 'offering'

export function BiosDirectory({ profiles, showCohort = false }: Props) {
  const [query, setQuery] = useState('')
  const [cohort, setCohort] = useState<string>(ALL)
  const [team, setTeam] = useState<string>(ALL)
  const [peopleType, setPeopleType] = useState<PeopleType>(ALL)
  const [help, setHelp] = useState<HelpFilter>(ALL)
  const [selected, setSelected] = useState<DirectoryProfile | null>(null)
  const deferredQuery = useDeferredValue(query)

  // Member of the Week: at most one profile is currently in window.
  // We compute it client-side because the data is already fetched
  // and there's no need to round-trip for what amounts to a date
  // comparison. If multiple profiles overlap (admin oversight),
  // we surface the first by name to stay deterministic.
  const featuredMember = useMemo(() => {
    const now = Date.now()
    return (
      profiles.find((p) => {
        const from = p.featured_member_from
          ? Date.parse(p.featured_member_from)
          : null
        const until = p.featured_member_until
          ? Date.parse(p.featured_member_until)
          : null
        if (from === null || until === null) return false
        return from <= now && now <= until
      }) ?? null
    )
  }, [profiles])

  // Surface the people-type tabs only when the directory contains
  // both fellows and faculty - no need to show a single-option
  // toggle on a homogeneous list.
  const hasFellows = useMemo(
    () => profiles.some((p) => p.role === 'fellow'),
    [profiles],
  )
  const hasFaculty = useMemo(
    () => profiles.some((p) => p.role && FACULTY_ROLES.has(p.role)),
    [profiles],
  )
  const showPeopleType = hasFellows && hasFaculty

  // Cohort filter is admin-only (matches the cohort chip rule).
  const cohortOptions = useMemo(() => {
    if (!showCohort) return []
    const set = new Set<string>()
    for (const p of profiles) if (p.cohort) set.add(p.cohort)
    return [...set].sort()
  }, [profiles, showCohort])

  // Team dropdown is sourced from the union of every member's
  // `school_names` (falling back to the legacy single `school_name`
  // when callers haven't populated the array). This way a member
  // who's on multiple leadership teams contributes to each option,
  // and the filter still works for callers that only set
  // `school_name`.
  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of profiles) {
      if (p.school_names && p.school_names.length > 0) {
        for (const name of p.school_names) if (name) set.add(name)
      } else if (p.school_name) {
        set.add(p.school_name)
      }
    }
    return [...set].sort()
  }, [profiles])

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return profiles.filter((p) => {
      // People-type: "fellow" matches role === 'fellow', "faculty"
      // matches the FACULTY_ROLES set (facilitator + admin).
      if (peopleType === 'fellow' && p.role !== 'fellow') return false
      if (
        peopleType === 'faculty' &&
        !(p.role && FACULTY_ROLES.has(p.role))
      ) {
        return false
      }
      // Help-orientation filter. "Looking" = members who described
      // what they want; "offering" = members who described how
      // they can help. Empty strings (whitespace-only) don't count.
      if (help === 'looking' && !p.looking_for?.trim()) return false
      if (help === 'offering' && !p.willing_to_help?.trim()) return false
      if (cohort !== ALL && p.cohort !== cohort) return false
      if (team !== ALL) {
        // A member matches the team filter when the selected team
        // is in their full membership list, OR (legacy fallback)
        // matches the single `school_name` field.
        const teams =
          p.school_names && p.school_names.length > 0
            ? p.school_names
            : p.school_name
              ? [p.school_name]
              : []
        if (!teams.includes(team)) return false
      }
      if (q.length > 0) {
        // School-team names are part of the haystack so typing
        // "Lincoln" surfaces every member on the Lincoln team.
        // Role label ("Admin" / "Facilitator" / "Fellow") is too,
        // so users can search for "admin" and pull the program
        // staff in one go without touching the role tabs.
        const teams =
          p.school_names && p.school_names.length > 0
            ? p.school_names
            : p.school_name
              ? [p.school_name]
              : []
        const haystack = [
          p.full_name,
          p.email,
          p.title,
          roleLabelFor(p.role),
          ...teams,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [profiles, deferredQuery, cohort, team, peopleType, help])

  const showReset =
    cohort !== ALL ||
    team !== ALL ||
    peopleType !== ALL ||
    help !== ALL ||
    query.trim().length > 0

  function reset() {
    setQuery('')
    setCohort(ALL)
    setTeam(ALL)
    setPeopleType(ALL)
    setHelp(ALL)
  }

  const peopleTabs: Array<{
    value: PeopleType
    label: string
    count: number
  }> = [
    { value: ALL, label: 'All', count: profiles.length },
    {
      value: 'fellow',
      label: 'Fellows',
      count: profiles.filter((p) => p.role === 'fellow').length,
    },
    {
      value: 'faculty',
      label: 'Faculty',
      count: profiles.filter((p) => p.role && FACULTY_ROLES.has(p.role))
        .length,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/*
        Member of the Week banner. Renders only when an admin has
        scheduled someone via featured_member_{from,until}; quietly
        absent otherwise so the page never shows an empty hero.
        Clicking the banner opens the same modal the directory cards
        use, so visitors can read the full bio without scrolling.
      */}
      {featuredMember && (
        <button
          type="button"
          onClick={() => setSelected(featuredMember)}
          className="group flex flex-col gap-4 rounded-xl border bg-card p-5 text-left shadow-xs transition hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-row sm:items-center"
          aria-label={`Open profile for ${featuredMember.full_name ?? 'featured member'}`}
        >
          <Avatar className="size-16 shrink-0 ring-2 ring-primary-soft ring-offset-2 ring-offset-card">
            {featuredMember.avatar_url ? (
              <AvatarImage src={featuredMember.avatar_url} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary-soft text-lg font-medium text-primary">
              {initialsFor(featuredMember.full_name, featuredMember.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="eyebrow inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-highlight" aria-hidden="true" />
              Member of the Week
            </p>
            <p className="mt-1.5 truncate text-base font-semibold text-foreground">
              {featuredMember.full_name ?? 'Featured member'}
            </p>
            {featuredMember.title && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {featuredMember.title}
                {featuredMember.school_name
                  ? ` · ${featuredMember.school_name}`
                  : ''}
              </p>
            )}
            {featuredMember.bio?.trim() && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {featuredMember.bio}
              </p>
            )}
          </div>
          <span className="hidden shrink-0 text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary sm:inline">
            Open profile →
          </span>
        </button>
      )}

      {/* People-type tabs. Rendered only when the list contains both
          fellows and faculty so we don't show a one-option toggle. */}
      {showPeopleType && (
        <div
          role="tablist"
          aria-label="Filter by role"
          className="inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1 shadow-xs"
        >
          {peopleTabs.map((tab) => {
            const active = peopleType === tab.value
            return (
              <button
                key={tab.value}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setPeopleType(tab.value)}
                className={
                  active
                    ? 'inline-flex items-center gap-2 rounded-md bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary'
                    : 'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
                }
              >
                <span>{tab.label}</span>
                <span
                  className={
                    active
                      ? 'rounded bg-card px-1.5 text-xs tabular-nums text-primary'
                      : 'rounded bg-muted px-1.5 text-xs tabular-nums text-muted-foreground'
                  }
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, school, or role (e.g. admin)..."
            aria-label="Search Fellow Bios"
            className="bg-card pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cohortOptions.length > 0 && (
            <Select value={cohort} onValueChange={setCohort}>
              <SelectTrigger className="h-9 min-w-[10rem] bg-card" aria-label="Filter by cohort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All cohorts</SelectItem>
                {cohortOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    Cohort {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {teamOptions.length > 0 && (
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger className="h-9 min-w-[12rem] bg-card" aria-label="Filter by team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All teams</SelectItem>
                {teamOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/*
            Help orientation: "Looking for help" / "Offering help".
            We only render the dropdown when at least one member in
            the dataset has populated either field, otherwise the
            options return an empty list and create a confusing
            dead-end filter.
          */}
          {profiles.some(
            (p) => p.looking_for?.trim() || p.willing_to_help?.trim(),
          ) && (
            <Select
              value={help}
              onValueChange={(v) => setHelp(v as HelpFilter)}
            >
              <SelectTrigger
                className="h-9 min-w-[12rem] bg-card"
                aria-label="Filter by help orientation"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Anyone</SelectItem>
                <SelectItem value="looking">Looking for help</SelectItem>
                <SelectItem value="offering">Offering help</SelectItem>
              </SelectContent>
            </Select>
          )}

          {showReset && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs"
            >
              <X aria-hidden="true" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {profiles.length}
        {filtered.length !== profiles.length && (
          <Badge variant="secondary" className="ml-2">
            Filtered
          </Badge>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Search className="size-[18px]" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            No one matches your search and filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <MemberCard
              key={p.id}
              profile={p}
              variant="detailed"
              showCohort={showCohort}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      <ProfileModal
        profile={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        showCohort={showCohort}
      />
    </div>
  )
}
