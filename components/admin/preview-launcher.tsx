'use client'

import { usePathname } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Eye, Search, User2, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { COHORTS, type Cohort } from '@/lib/cohorts'
import { startPreviewAsCohort, startPreviewAsFellow } from '@/app/admin/preview/actions'

export type PreviewFellow = {
  id: string
  fullName: string
  email: string | null
  cohort: Cohort | null
  schoolName: string | null
}

type Tab = 'by_fellow' | 'by_cohort'

/**
 * Two-tab launcher for the admin's "Preview as fellow" feature. The
 * admin can either pick a specific fellow (gets that fellow's exact
 * cohort, school, and progress state) or pick a cohort letter (gets a
 * synthetic fellow with no progress, useful for verifying gating).
 */
export function PreviewLauncher({ fellows }: { fellows: PreviewFellow[] }) {
  const pathname = usePathname()
  const [tab, setTab] = useState<Tab>('by_fellow')
  const [query, setQuery] = useState('')
  const [selectedFellowId, setSelectedFellowId] = useState<string | null>(
    fellows[0]?.id ?? null,
  )
  const [selectedCohort, setSelectedCohort] = useState<Cohort>('A')
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return fellows
    return fellows.filter((f) => {
      return (
        f.fullName.toLowerCase().includes(q) ||
        (f.email ?? '').toLowerCase().includes(q) ||
        (f.schoolName ?? '').toLowerCase().includes(q)
      )
    })
  }, [fellows, query])

  function handleStartFellowPreview() {
    if (!selectedFellowId) return
    const fd = new FormData()
    fd.set('fellowId', selectedFellowId)
    fd.set('referrer', pathname)
    startTransition(() => startPreviewAsFellow(fd))
  }

  function handleStartCohortPreview() {
    const fd = new FormData()
    fd.set('cohort', selectedCohort)
    fd.set('referrer', pathname)
    startTransition(() => startPreviewAsCohort(fd))
  }

  return (
    <Card className="gap-5 border-0 bg-transparent py-0 shadow-none">
      <CardHeader className="gap-1.5 px-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Preview as fellow</CardTitle>
        </div>
        <CardDescription>
          See exactly what a fellow sees. Pick an individual fellow to inherit their
          cohort, school team, and progress, or pick a cohort to inspect what a brand-new
          fellow in that cohort would see.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0">
        <div
          role="tablist"
          aria-label="Preview mode"
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
        >
          <TabButton
            active={tab === 'by_fellow'}
            onClick={() => setTab('by_fellow')}
            icon={<User2 className="h-3.5 w-3.5" />}
            label="By fellow"
            count={fellows.length}
          />
          <TabButton
            active={tab === 'by_cohort'}
            onClick={() => setTab('by_cohort')}
            icon={<Users className="h-3.5 w-3.5" />}
            label="By cohort"
            count={COHORTS.length}
          />
        </div>

        {tab === 'by_fellow' ? (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fellows by name, email, or school"
                aria-label="Search fellows"
                className="pl-9"
              />
            </div>

            <ul
              role="listbox"
              aria-label="Fellows"
              className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-background"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No fellows match that search.
                </li>
              ) : (
                filtered.map((f) => {
                  const selected = f.id === selectedFellowId
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedFellowId(f.id)}
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                          'hover:bg-accent/60 focus:bg-accent focus:outline-none',
                          selected && 'bg-primary-soft',
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {f.fullName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {f.email ?? 'No email'}
                            {f.schoolName ? ` · ${f.schoolName}` : ''}
                          </p>
                        </div>
                        <CohortPill cohort={f.cohort} />
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            <Button
              type="button"
              onClick={handleStartFellowPreview}
              disabled={pending || !selectedFellowId}
              className="self-start"
            >
              {pending && <Spinner className="h-4 w-4" />}
              <Eye className="h-4 w-4" aria-hidden="true" />
              Preview as selected fellow
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              role="radiogroup"
              aria-label="Cohort"
              className="grid grid-cols-3 gap-2"
            >
              {COHORTS.map((c) => {
                const active = c === selectedCohort
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelectedCohort(c)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground',
                    )}
                  >
                    <span>Cohort {c}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              You&apos;ll see the platform as a generic fellow in cohort{' '}
              <span className="font-medium text-foreground">{selectedCohort}</span> -
              every gated phase, item, and library resource assigned to that cohort,
              with no personal progress.
            </p>
            <Button
              type="button"
              onClick={handleStartCohortPreview}
              disabled={pending}
              className="self-start"
            >
              {pending && <Spinner className="h-4 w-4" />}
              <Eye className="h-4 w-4" aria-hidden="true" />
              Preview as Cohort {selectedCohort}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-card text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          'rounded-full px-1.5 text-[10px] font-semibold',
          active ? 'bg-primary-soft text-primary' : 'bg-background/70 text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function CohortPill({ cohort }: { cohort: Cohort | null }) {
  if (!cohort) {
    return (
      <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
        Unassigned
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
      Cohort {cohort}
    </span>
  )
}
