import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-server'
import type { ContentCategory, ResourceType } from '@/lib/curriculum'
import { effectiveModuleCohorts } from '@/lib/curriculum'
import { ModuleDetailsForm } from './module-details-form'
import { ContentList } from './content-list'

export const dynamic = 'force-dynamic'

type PhaseRow = {
  id: string
  title: string
  cohorts: string[] | null
}

type ModuleDetailRow = {
  id: string
  phase_id: string
  title: string
  description: string | null
  cohorts: string[] | null
  is_sequential: boolean
  opens_at: string | null
}

export type ContentRow = {
  id: string
  module_id: string
  title: string
  description: string | null
  body: string | null
  url: string | null
  /** Key of an uploaded PDF in the course-files bucket; null for links. */
  file_path: string | null
  category: ContentCategory
  resource_type: ResourceType
  cohorts: string[] | null
  duration_minutes: number | null
  /**
   * When true, fellows must submit a reflection (using
   * `reflection_prompt`) before they can mark this item complete.
   */
  reflection_enabled: boolean
  reflection_prompt: string | null
  /**
   * UTC ISO start time for live-session items; NULL for any other
   * resource type or for live items that haven't been scheduled.
   * Edited via the datetime-local input on `ContentItemForm`.
   */
  scheduled_at: string | null
  order_index: number
}

export default async function AdminModuleDetailPage({
  params,
}: {
  params: Promise<{ phaseId: string; moduleId: string }>
}) {
  await requireAdmin()
  const { phaseId, moduleId } = await params
  const supabase = await createClient()

  const [{ data: phase }, { data: module }, { data: items }] = await Promise.all([
    supabase
      .from('years')
      .select('id, title, cohorts')
      .eq('id', phaseId)
      .maybeSingle<PhaseRow>(),
    supabase
      .from('modules')
      .select('id, phase_id, title, description, cohorts, is_sequential, opens_at')
      .eq('id', moduleId)
      .eq('phase_id', phaseId)
      .maybeSingle<ModuleDetailRow>(),
    supabase
      .from('labs')
      .select(
        'id, module_id, title, description, body, url, file_path, category, resource_type, cohorts, duration_minutes, reflection_enabled, reflection_prompt, scheduled_at, order_index',
      )
      .eq('module_id', moduleId)
      .order('order_index', { ascending: true })
      .returns<ContentRow[]>(),
  ])

  if (!phase || !module) notFound()

  const phaseCohorts = phase.cohorts ?? []
  // The module's effective cohort list is what content items inherit
  // when their own override is NULL. Computed once on the server.
  const moduleEffectiveCohorts = effectiveModuleCohorts(
    module.cohorts,
    phaseCohorts,
  )

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/admin/curriculum/${phaseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {phase.title}
        </Link>
      </div>

      <PageHeader className="-mt-4 mb-0" eyebrow={phase.title} title={module.title} />

      <ModuleDetailsForm
        phaseId={phaseId}
        phaseCohorts={phaseCohorts}
        module={{
          id: module.id,
          title: module.title,
          description: module.description ?? '',
          cohorts: module.cohorts,
          isSequential: module.is_sequential,
          opensAt: module.opens_at,
        }}
      />

      <ContentList
        phaseId={phaseId}
        moduleId={moduleId}
        moduleCohorts={module.cohorts}
        moduleEffectiveCohorts={[...moduleEffectiveCohorts]}
        items={items ?? []}
      />
    </div>
  )
}
