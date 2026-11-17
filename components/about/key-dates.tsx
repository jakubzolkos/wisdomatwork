import { loadFullCurriculum } from '@/lib/curriculum-tree'

/**
 * "Key Dates" on the About page: the scheduled live sessions the signed-in
 * user can see, grouped by program, in date order. It reads the same
 * curriculum the sidebar does, so a Fellow only sees their own pathway and
 * dates the team changes in Admin -> Curriculum show up here with no extra
 * step. Staff see every pathway.
 *
 * Only items with a scheduled start count as key dates. Surveys and
 * deadlines that live in a description are not listed.
 */

const DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

/** 150 -> "2.5 hours", 90 -> "90 minutes". */
function lengthLabel(minutes: number | null): string | null {
  if (!minutes) return null
  if (minutes >= 120) return `${minutes / 60} hours`
  return `${minutes} minutes`
}

export async function KeyDates() {
  const curriculum = await loadFullCurriculum()
  const now = Date.now()

  const groups = curriculum.phases
    .filter((phase) => !phase.isLocked)
    .map((phase) => ({
      id: phase.id,
      title: phase.title,
      sessions: phase.modules
        .flatMap((module) =>
          module.items
            // A finished year (or the other cohort's items) is not a date
            // to plan around.
            .filter((i) => i.resourceType === 'live_session' && i.scheduledAt && !i.isPast && !i.isReference)
            .map((i) => ({
              id: i.id,
              name: module.title,
              start: new Date(i.scheduledAt as string),
              minutes: i.durationMinutes,
            })),
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    }))
    .filter((group) => group.sessions.length > 0)

  if (groups.length === 0) return null

  return (
    <section aria-labelledby="key-dates-heading" className="space-y-6">
      <div className="space-y-1">
        <h2 id="key-dates-heading" className="text-2xl">
          Key Dates
        </h2>
        <p className="text-sm text-muted-foreground">
          Your live sessions. All times are Eastern. The Zoom link is on each session&apos;s page.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.id} className="space-y-3">
          {groups.length > 1 && (
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {group.title}
            </h3>
          )}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {group.sessions.map((s) => {
              const ended = s.start.getTime() + (s.minutes ?? 60) * 60_000 < now
              const length = lengthLabel(s.minutes)
              return (
                <li
                  key={s.id}
                  className={`flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 ${
                    ended ? 'text-muted-foreground' : ''
                  }`}
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-sm tabular-nums">
                    {DATE.format(s.start)} · {TIME.format(s.start)}
                    {length ? ` · ${length}` : ''}
                    {ended ? ' · done' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
