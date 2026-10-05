import Link from 'next/link'
import { ArrowRight, CalendarClock, ClipboardList, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getResourceType, isResourceType } from '@/lib/curriculum'
import { formatOpensAt } from '@/lib/module-locks'
import type { CurriculumItem } from '@/lib/curriculum-tree'
import type { WhereAmI } from '@/lib/where-am-i'

const SESSION_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** "Wisdom Lab One: Formative Leadership" -> "Wisdom Lab One". */
function shortTitle(title: string): string {
  const at = title.indexOf(': ')
  return at > 0 ? title.slice(0, at) : title
}

/**
 * "Where am I" panel at the top of the dashboard: next session, what to
 * do now, open surveys and what opens next (lib/where-am-i.ts).
 */
export function WhereAmICard({ data }: { data: WhereAmI }) {
  const { nextSession, current, upcoming } = data
  const todoIds = new Set(current?.todo.map((i) => i.id))
  const surveys = data.surveys.filter((s) => !todoIds.has(s.item.id))
  const caughtUp = !nextSession && !current && surveys.length === 0

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-xl">Where you are</h2>
          <p className="text-sm text-muted-foreground">
            {data.phaseTitle} · <span className="tabular-nums">{data.done}/{data.total}</span> done
          </p>
        </div>

        {nextSession && (
          <Link
            href={nextSession.item.href}
            className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 transition-colors hover:bg-muted"
          >
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {nextSession.isLive ? 'Live now' : 'Next session'}
              </span>
              <span className="block text-sm font-medium text-foreground">
                {shortTitle(nextSession.moduleTitle)} · {nextSession.item.title}
              </span>
              <span className="block text-sm text-muted-foreground">
                {SESSION_TIME.format(new Date(nextSession.startsAt))} ET
              </span>
            </span>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}

        {current && current.todo.length > 0 && (
          <section aria-labelledby="where-todo" className="space-y-2">
            <h3 id="where-todo" className="text-sm font-semibold text-foreground">
              To do in {shortTitle(current.module.title)}
            </h3>
            <ItemList items={current.todo.map((item) => ({ item }))} />
          </section>
        )}

        {surveys.length > 0 && (
          <section aria-labelledby="where-surveys" className="space-y-2">
            <h3 id="where-surveys" className="text-sm font-semibold text-foreground">
              Surveys to complete
            </h3>
            <ItemList items={surveys.map((s) => ({ item: s.item, context: shortTitle(s.moduleTitle) }))} />
          </section>
        )}

        {caughtUp && (
          <p className="text-sm text-muted-foreground">You&rsquo;re all caught up for now.</p>
        )}

        {upcoming && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            {shortTitle(upcoming.title)} opens {formatOpensAt(upcoming.opensAt)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ItemList({ items }: { items: Array<{ item: CurriculumItem; context?: string }> }) {
  return (
    <ul className="flex flex-col">
      {items.map(({ item, context }) => {
        const type =
          item.resourceType && isResourceType(item.resourceType) ? getResourceType(item.resourceType).label : null
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
            >
              <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm text-foreground">{item.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {[context, type].filter(Boolean).join(' · ')}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
