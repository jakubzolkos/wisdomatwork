import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-server'
import { PhaseDetailsForm } from './phase-details-form'
import { ModuleList } from './module-list'

export const dynamic = 'force-dynamic'

type PhaseRow = {
  id: string
  title: string
  description: string | null
  cohorts: string[] | null
}

export type ModuleRow = {
  id: string
  phase_id: string
  title: string
  description: string | null
  cohorts: string[] | null
  order_index: number
}

export default async function AdminPhaseDetailPage({
  params,
}: {
  params: Promise<{ phaseId: string }>
}) {
  await requireAdmin()
  const { phaseId } = await params
  const supabase = await createClient()

  const [{ data: phase }, { data: modules }, { data: contentCounts }] =
    await Promise.all([
      supabase
        .from('years')
        .select('id, title, description, cohorts')
        .eq('id', phaseId)
        .maybeSingle<PhaseRow>(),
      supabase
        .from('modules')
        .select('id, phase_id, title, description, cohorts, order_index')
        .eq('phase_id', phaseId)
        .order('order_index', { ascending: true })
        .returns<ModuleRow[]>(),
      // Cheap aggregate: pull module_id only for items in this phase, count
      // them in JS. No need for a SQL function and works under RLS just fine.
      supabase
        .from('labs')
        .select('module_id')
        .eq('year_id', phaseId)
        .returns<{ module_id: string | null }[]>(),
    ])

  if (!phase) notFound()

  const countsByModule = new Map<string, number>()
  for (const row of contentCounts ?? []) {
    if (!row.module_id) continue
    countsByModule.set(row.module_id, (countsByModule.get(row.module_id) ?? 0) + 1)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/curriculum"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All phases
        </Link>
      </div>

      <PageHeader className="-mt-4 mb-0" eyebrow="Curriculum · Phase" title={phase.title} />

      <PhaseDetailsForm
        phase={{
          id: phase.id,
          title: phase.title,
          description: phase.description ?? '',
          cohorts: phase.cohorts ?? [],
        }}
      />

      <ModuleList
        phaseId={phase.id}
        phaseCohorts={phase.cohorts ?? []}
        modules={modules ?? []}
        countsByModule={countsByModule}
      />
    </div>
  )
}
