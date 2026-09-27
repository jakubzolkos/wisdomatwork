'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ExternalLink, MapPin, Plus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildIcs, downloadIcs } from '@/lib/ics'
import { initialsFor } from '@/lib/types/profile'
import { cn } from '@/lib/utils'

export interface CommunityEvent {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  join_url: string | null
  event_type: string | null
  host: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

const EVENT_TYPE_FILTERS: { value: string; label: string }[] = [
  { value: 'workshop', label: 'Workshops' },
  { value: 'lab_session', label: 'Lab sessions' },
  { value: 'meet_up', label: 'Meet-ups' },
  { value: 'webinar', label: 'Webinars' },
]

const EVENT_TYPE_LABEL: Record<string, string> = {
  workshop: 'Workshop',
  lab_session: 'Lab session',
  meet_up: 'Meet-up',
  webinar: 'Webinar',
}

interface Props {
  events: CommunityEvent[]
}

/**
 * Upcoming events list for the Community page Events tab. Sorted
 * by date by the server; this island only adds the type filter and
 * the per-event "Add to calendar" handler. We keep the filter as
 * a single-select pill row - easier to read than a multi-select
 * and matches the mental model ("what kind of event?").
 */
export function EventsList({ events }: Props) {
  const [filter, setFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!filter) return events
    return events.filter((e) => e.event_type === filter)
  }, [events, filter])

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter events by type"
      >
        <FilterPill active={filter === null} onClick={() => setFilter(null)}>
          All
          <Badge variant="secondary" className="ml-1 px-1.5">
            {events.length}
          </Badge>
        </FilterPill>
        {EVENT_TYPE_FILTERS.map((opt) => {
          const count = events.filter((e) => e.event_type === opt.value).length
          if (count === 0) return null
          return (
            <FilterPill
              key={opt.value}
              active={filter === opt.value}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              <Badge variant="secondary" className="ml-1 px-1.5">
                {count}
              </Badge>
            </FilterPill>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <CalendarDays className="size-[18px]" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            No upcoming events match this filter.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
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
        'h-8 rounded-full px-3 text-xs',
        active
          ? 'border-primary/20 bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary'
          : 'text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {children}
    </Button>
  )
}

function EventCard({ event }: { event: CommunityEvent }) {
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null
  const dateLabel = start.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  const endTimeLabel = end?.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  const hostName =
    event.host?.full_name?.trim() || event.host?.email || 'Fellowship team'
  const hostInitials = initialsFor(event.host?.full_name, event.host?.email)
  const typeLabel = event.event_type
    ? EVENT_TYPE_LABEL[event.event_type] ?? 'Event'
    : 'Event'

  function handleAddToCalendar() {
    const ics = buildIcs({
      uid: `${event.id}@leadership-fellowship`,
      title: event.title,
      description: event.description,
      location: event.location ?? event.join_url,
      url: event.join_url,
      start,
      end,
    })
    downloadIcs(`${event.title}.ics`, ics)
  }

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">
              {typeLabel}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {dateLabel}
              {' · '}
              {timeLabel}
              {endTimeLabel ? ` – ${endTimeLabel}` : ''}
            </span>
          </div>
          <h3 className="mt-2 text-balance">
            {event.title}
          </h3>
          {event.description && (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Avatar className="size-5">
            {event.host?.avatar_url ? (
              <AvatarImage src={event.host.avatar_url} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary-soft text-[10px] text-primary">{hostInitials}</AvatarFallback>
          </Avatar>
          Host: {hostName}
        </span>
        {event.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {event.location}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {event.join_url && (
          <Button asChild size="sm" className="inline-flex items-center gap-1.5">
            <a href={event.join_url} target="_blank" rel="noreferrer">
              Join
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddToCalendar}
          className="inline-flex items-center gap-1.5"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add to calendar
        </Button>
      </div>
    </article>
  )
}
