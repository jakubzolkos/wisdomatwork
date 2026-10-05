import Link from 'next/link'
import { Download, Search } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { formatProgressDate, loadFellowProgressList } from '@/lib/fellow-progress'

const COHORT_FILTERS = [
  { value: '', label: 'All' },
  { value: 'A', label: 'Cohort A' },
  { value: 'B', label: 'Cohort B' },
] as const

export default async function AdminProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; q?: string }>
}) {
  const { cohort = '', q = '' } = await searchParams
  const query = q.trim().toLowerCase()

  const all = await loadFellowProgressList()
  const active = all.filter((f) => !f.deactivated)
  const fellows = active.filter(
    (f) =>
      (!cohort || f.cohort === cohort) &&
      (!query ||
        [f.fullName, f.email, f.schoolName, f.teamName].some((v) => v?.toLowerCase().includes(query))),
  )

  const href = (next: { cohort?: string }) => {
    const params = new URLSearchParams()
    const c = next.cohort ?? cohort
    if (c) params.set('cohort', c)
    if (q) params.set('q', q)
    const s = params.toString()
    return s ? `/admin/progress?${s}` : '/admin/progress'
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-2"
        eyebrow="Admin console"
        title="Progress"
        description="Where each fellow is in the curriculum and what they've written. Open a fellow to see every item and their reflections."
        actions={
          <>
            {/* Plain links: the route answers with a CSV download. */}
            <Button asChild variant="outline" className="gap-2">
              <a href={`/admin/progress/export${cohort ? `?cohort=${cohort}` : ''}`}>
                <Download className="size-4" aria-hidden="true" />
                Summary (CSV)
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href={`/admin/progress/export?format=items${cohort ? `&cohort=${cohort}` : ''}`}>
                <Download className="size-4" aria-hidden="true" />
                Every item (CSV)
              </a>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter by cohort" className="flex flex-wrap gap-1.5">
          {COHORT_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={href({ cohort: f.value })}
              aria-current={cohort === f.value ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                cohort === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-foreground hover:bg-accent',
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/progress" className="relative w-full sm:w-72">
          {cohort && <input type="hidden" name="cohort" value={cohort} />}
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search name, email or school"
            aria-label="Search fellows"
            className="pl-9"
          />
        </form>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="hidden grid-cols-12 gap-4 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <div className="col-span-4">Fellow</div>
            <div className="col-span-1">Cohort</div>
            <div className="col-span-4">Current phase</div>
            <div className="col-span-1 text-right">Reflections</div>
            <div className="col-span-2 text-right">Last activity</div>
          </div>
          <ul className="divide-y divide-border">
            {fellows.map((f) => {
              const current = f.phases.find((p) => p.isCurrent) ?? null
              const pct = current && current.total > 0 ? Math.round((current.done / current.total) * 100) : 0
              return (
                <li key={f.id}>
                  <Link
                    href={`/admin/progress/${f.id}`}
                    className="grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-12 md:items-center md:gap-4"
                  >
                    <div className="min-w-0 md:col-span-4">
                      <p className="truncate text-sm font-medium text-foreground">{f.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.schoolName ?? f.email}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground md:col-span-1">
                      <span className="md:hidden">Cohort </span>
                      {f.cohort ?? '—'}
                    </div>
                    <div className="min-w-0 md:col-span-4">
                      {current ? (
                        <div className="flex items-center gap-3">
                          <Progress value={pct} aria-label={`${current.title} progress`} className="h-1.5" />
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {current.done}/{current.total}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No curriculum</span>
                      )}
                      {current && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{current.title}</p>
                      )}
                    </div>
                    <div className="text-sm tabular-nums text-muted-foreground md:col-span-1 md:text-right">
                      <span className="md:hidden">Reflections </span>
                      {f.reflectionCount}
                    </div>
                    <div className="text-xs text-muted-foreground md:col-span-2 md:text-right">
                      <span className="md:hidden">Last activity </span>
                      {formatProgressDate(f.lastActivity)}
                      {!f.lastSignIn && <span className="block">Never signed in</span>}
                    </div>
                  </Link>
                </li>
              )
            })}
            {fellows.length === 0 && (
              <li className="p-10 text-center text-sm text-muted-foreground">No fellows match.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {fellows.length} of {active.length} active fellows
        {all.length > active.length && ` · ${all.length - active.length} deactivated not shown`}. Survey
        answers live in Google Forms; the portal records when a fellow opened and ticked each survey.
      </p>
    </div>
  )
}
