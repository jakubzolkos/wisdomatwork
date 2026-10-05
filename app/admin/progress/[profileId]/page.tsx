import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, Circle, Clock, Eye, History, Lock } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { startPreviewAsFellow } from '@/app/admin/preview/actions'
import { formatOpensAt } from '@/lib/module-locks'
import type { CurriculumItem, CurriculumModule } from '@/lib/curriculum-tree'
import {
  currentPhaseId,
  formatProgressDate,
  itemStatus,
  loadFellowProgress,
  type FellowDetail,
  type ItemStatus,
} from '@/lib/fellow-progress'

const STATUS_ICONS: Record<ItemStatus['kind'], typeof Check> = {
  'finished-year': History,
  completed: Check,
  'session-ended': Check,
  'survey-pending': Clock,
  'not-open': Lock,
  'session-ahead': Clock,
  'not-done': Circle,
}

export default async function AdminFellowProgressPage({
  params,
}: {
  params: Promise<{ profileId: string }>
}) {
  const { profileId } = await params
  const detail = await loadFellowProgress(profileId)
  if (!detail) notFound()
  const { fellow, curriculum, reflections } = detail
  const current = currentPhaseId(curriculum.phases)
  const phases = curriculum.phases.filter((p) => !p.isLocked)

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/progress"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All fellows
      </Link>

      <PageHeader
        className="mb-0"
        eyebrow={fellow.cohort ? `Cohort ${fellow.cohort}` : 'No cohort'}
        title={fellow.fullName}
        description={fellow.schoolName ?? undefined}
        actions={
          !fellow.deactivated && (
            <form action={startPreviewAsFellow}>
              <input type="hidden" name="fellowId" value={fellow.id} />
              <input type="hidden" name="referrer" value={`/admin/progress/${fellow.id}`} />
              <Button type="submit" variant="outline" className="gap-2">
                <Eye className="size-4" aria-hidden="true" />
                Preview as {fellow.fullName.split(' ')[0]}
              </Button>
            </form>
          )
        }
      />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-4">
        <Fact label="Email" value={fellow.email ?? '—'} />
        <Fact label="Unique ID" value={detail.researchId ?? '—'} mono />
        <Fact label="Last sign-in" value={detail.lastSignIn ? formatProgressDate(detail.lastSignIn) : 'Never'} />
        <Fact label="Reflections" value={String(reflections.size)} />
      </dl>
      {fellow.deactivated && (
        <p className="text-sm text-muted-foreground">This account is deactivated.</p>
      )}

      {phases.length === 0 && (
        <p className="text-sm text-muted-foreground">No curriculum is assigned to this fellow&rsquo;s cohort.</p>
      )}

      {phases.map((phase) => {
        const isCurrent = phase.id === current
        const isFinished = phase.modules.some((m) => m.items.some((i) => i.isPast))
        return (
          <section key={phase.id} aria-labelledby={`phase-${phase.id}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`phase-${phase.id}`} className="font-serif text-xl">
                {phase.title}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isCurrent && <Badge>Current</Badge>}
                {isFinished && <Badge variant="secondary">Finished year</Badge>}
                <span className="tabular-nums">
                  {phase.completedCount}/{phase.itemCount}
                </span>
              </div>
            </div>
            <Card className="gap-0 py-0">
              <CardContent className="divide-y divide-border p-0">
                {phase.modules.map((module) => (
                  <ModuleProgress key={module.id} module={module} detail={detail} />
                ))}
              </CardContent>
            </Card>
          </section>
        )
      })}

      <p className="text-xs text-muted-foreground">
        Survey answers live in Google Forms; here a survey shows as done once the fellow opened and ticked it.
        Sessions count as done when they end.
      </p>
    </div>
  )
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? 'truncate font-mono text-foreground' : 'truncate text-foreground'}>{value}</dd>
    </div>
  )
}

function ModuleProgress({ module, detail }: { module: CurriculumModule; detail: FellowDetail }) {
  const counted = module.items.filter((i) => !i.isPending)
  const done = counted.filter((i) => i.isCompleted).length
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{module.title}</h3>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {module.isLocked ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden="true" />
              {module.opensAt ? `Opens ${formatOpensAt(module.opensAt)}` : 'Not open yet'}
            </span>
          ) : (
            `${done}/${counted.length}`
          )}
        </span>
      </div>
      {module.items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {module.items.map((item) => (
            <ItemProgress key={item.id} item={item} locked={module.isLocked} detail={detail} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ItemProgress({
  item,
  locked,
  detail,
}: {
  item: CurriculumItem
  locked: boolean
  detail: FellowDetail
}) {
  const reflection = detail.reflections.get(item.id)
  const completedAt = detail.completedAt.get(item.id)
  const status = itemStatus(item, locked, completedAt)
  const Icon = STATUS_ICONS[status.kind]

  return (
    <li className="rounded-md py-1.5">
      <div className="flex items-start gap-3">
        <span
          className={
            status.done
              ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'
              : 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'
          }
        >
          <Icon className="size-3" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm text-foreground">{item.title}</span>
          <span className="text-xs text-muted-foreground">{status.label}</span>
        </div>
      </div>
      {reflection && (
        <figure className="ml-8 mt-2 rounded-md border-l-2 border-primary/40 bg-muted/40 px-4 py-3">
          <blockquote className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {reflection.response}
          </blockquote>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            Reflection · {formatProgressDate(reflection.submittedAt)}
          </figcaption>
        </figure>
      )}
    </li>
  )
}
