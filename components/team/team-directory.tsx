'use client'

import { useMemo, useState } from 'react'
import { MemberCard } from '@/components/profile/member-card'
import { ProfileModal } from '@/components/profile/profile-view'
import { Button } from '@/components/ui/button'
import type { DirectoryProfile } from '@/lib/types/profile'
import { cn } from '@/lib/utils'

interface Props {
  members: DirectoryProfile[]
  /**
   * Whether to expose the cohort filter pills and the cohort chip
   * on cards / modal. Admin-only; fellows don't see staging labels.
   */
  showCohort?: boolean
}

/**
 * Team grid + cohort filter + profile modal. Server passes the
 * already-filtered list of schoolmates; this island handles client-
 * side interactivity (filter pills, modal selection) without an
 * extra round-trip. The modal trigger lives on the cards via the
 * `onSelect` callback, so parent state stays a single nullable
 * profile id (rather than a Set + open boolean).
 *
 * Cohort filter only renders when the team has mixed cohorts, per
 * spec - it would be noise on a single-cohort team.
 */
export function TeamDirectory({ members, showCohort = false }: Props) {
  const [selected, setSelected] = useState<DirectoryProfile | null>(null)
  const [cohortFilter, setCohortFilter] = useState<string | null>(null)

  // Distinct cohorts present in this team. Sorted alphabetically so
  // the filter pills render A, B, C in a stable order regardless of
  // the underlying member sort. Empty for non-admins so the filter
  // chrome below collapses entirely.
  const distinctCohorts = useMemo(() => {
    if (!showCohort) return []
    const set = new Set<string>()
    for (const m of members) if (m.cohort) set.add(m.cohort)
    return [...set].sort()
  }, [members, showCohort])

  const showCohortFilter = distinctCohorts.length > 1
  const filtered = useMemo(() => {
    if (!cohortFilter) return members
    return members.filter((m) => m.cohort === cohortFilter)
  }, [members, cohortFilter])

  return (
    <div className="flex flex-col gap-4">
      {showCohortFilter && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter team by cohort"
        >
          <span className="eyebrow mr-1">
            Cohort
          </span>
          <FilterPill
            active={cohortFilter === null}
            onClick={() => setCohortFilter(null)}
          >
            All
            <span className="ml-1 text-[11px] tabular-nums opacity-70">
              {members.length}
            </span>
          </FilterPill>
          {distinctCohorts.map((c) => {
            const count = members.filter((m) => m.cohort === c).length
            return (
              <FilterPill
                key={c}
                active={cohortFilter === c}
                onClick={() => setCohortFilter(c)}
              >
                Cohort {c}
                <span className="ml-1 text-[11px] tabular-nums opacity-70">
                  {count}
                </span>
              </FilterPill>
            )
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-10 text-center text-sm text-muted-foreground">
          No teammates match this filter.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <MemberCard
              key={m.id}
              profile={m}
              variant="compact"
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

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      className={cn(
        'h-8 rounded-full px-3.5 text-sm font-medium shadow-none',
        active
          ? 'border-primary/25 bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary'
          : 'text-muted-foreground hover:border-border-strong hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {children}
    </Button>
  )
}
