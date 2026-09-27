import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { ArrowRight, Layers, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-server'
import { CohortBadge } from '@/components/admin/cohort-access-field'
import { CreatePhaseDialog } from './create-phase-dialog'
import { PreviewLauncher, type PreviewFellow } from '@/components/admin/preview-launcher'
import { isCohort, type Cohort } from '@/lib/cohorts'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

type PhaseRow = {
  id: string
  title: string
  description: string | null
  order_index: number
  cohorts: string[] | null
}

type ContentCountRow = {
  year_id: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  cohort: string | null
  schools: { name: string | null } | null
}

export default async function AdminCurriculumPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [{ data: phases }, { data: contents }, { data: fellows }] = await Promise.all([
    supabase
      .from('years')
      .select('id, title, description, order_index, cohorts')
      .order('order_index', { ascending: true })
      .returns<PhaseRow[]>(),
    supabase
      .from('labs')
      .select('year_id')
      .returns<ContentCountRow[]>(),
    supabase
      .from('profiles')
      .select('id, full_name, email, cohort, schools(name)')
      .eq('role', 'fellow')
      .is('deactivated_at', null)
      .order('full_name', { ascending: true, nullsFirst: false })
      .returns<ProfileRow[]>(),
  ])

  // Tally content count per phase. Categories deliberately aren't
  // surfaced anywhere outside the create dialog, so we don't compute a
  // per-category breakdown here.
  const totals = new Map<string, number>()
  for (const row of contents ?? []) {
    if (!row.year_id) continue
    totals.set(row.year_id, (totals.get(row.year_id) ?? 0) + 1)
  }

  const phaseList = phases ?? []

  // Transform fellows data for PreviewLauncher
  const previewFellows: PreviewFellow[] = (fellows ?? []).map((f) => ({
    id: f.id,
    fullName: f.full_name ?? 'Unnamed fellow',
    email: f.email,
    cohort: isCohort(f.cohort) ? f.cohort : null,
    schoolName: f.schools?.name ?? null,
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Main Content */}
      <div className="flex flex-col gap-6">
        {/* Header */}
        <PageHeader
          className="mb-2"
          eyebrow="Admin console"
          title="Curriculum"
          description='Build your program phases and content. A phase is a top-level grouping (e.g. "Year One: Deep Learning"). Click into a phase to add content.'
          actions={<CreatePhaseDialog />}
        />

        {/* Phases List - Primary Task */}
        {phaseList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <span className="mx-auto mb-3 flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Layers className="size-[18px]" aria-hidden="true" />
            </span>
            <h3>No phases yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Click "New phase" above to create the first one. Phases are the top-level scaffolding of the curriculum.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {phaseList.map((phase, idx) => {
              const count = totals.get(phase.id) ?? 0
              return (
                <li key={phase.id}>
                  <Link
                    href={`/admin/curriculum/${phase.id}`}
                    className="group block rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-border-strong hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Phase {idx + 1}
                          </span>
                          <CohortBadge cohorts={phase.cohorts} />
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-foreground">
                          {phase.title}
                        </h3>
                        {phase.description && (
                          <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                            {phase.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-center text-sm text-muted-foreground">
                        <span>
                          {count} {count === 1 ? 'item' : 'items'}
                        </span>
                        <ArrowRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Preview Launcher - Secondary/Utility */}
      {previewFellows.length > 0 && (
        <Card className="py-0">
          <CardContent className="p-5">
            <details className="group/details cursor-pointer">
              <summary className="flex items-center gap-3 text-sm font-medium text-foreground transition-colors hover:text-foreground/80">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Eye className="size-4" />
                </span>
                Preview curriculum as fellow
                <span className="ml-auto text-xs font-normal text-muted-foreground group-open/details:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="-mx-5 -mb-5 mt-5 border-t border-border px-5 pb-5 pt-5">
                <PreviewLauncher fellows={previewFellows} />
              </div>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
