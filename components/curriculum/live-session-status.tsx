'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { recordLinkClick } from '@/app/(curriculum)/phases/actions'

interface Props {
  contentId: string
  /** Join URL (Zoom / Meet / etc.). Required by the admin form. */
  url: string
  /**
   * UTC ISO start time stored on the lab row. The component owns
   * the conversion to local time.
   */
  scheduledAt: string
  /**
   * Session length in minutes. We treat NULL as 60 minutes - the
   * admin form already prompts for a duration but legacy rows might
   * not have one.
   */
  durationMinutes: number | null
  /**
   * Server-rendered: has the user already been marked complete?
   * The component still re-renders the "ended/completed" pill even
   * when this is true so the page reads consistently after a
   * refresh; it just skips the auto-complete refresh trigger.
   */
  isCompleted: boolean
  /**
   * Epoch-ms server timestamp captured at render time. Used as the
   * SSR/initial-client "now" so the first paint already reflects
   * the correct phase (upcoming / soon / live / ended) instead of
   * a placeholder. The client re-anchors to its own wall clock in
   * the mount effect; the difference is at most a few hundred ms,
   * far below any phase boundary.
   */
  serverNow: number
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Window before the start time during which the join button is
 * already enabled. 15 minutes mirrors the typical "you can join 15
 * min early" affordance Zoom and Google Meet expose.
 */
const JOIN_OPEN_BEFORE = 15 * MINUTE

type Phase = 'upcoming' | 'soon' | 'live' | 'ended'

interface PhaseInfo {
  phase: Phase
  /** ms relative to now: positive = in the future, 0 / negative = passed. */
  untilStart: number
  untilEnd: number
}

function computePhase(now: number, startMs: number, endMs: number): PhaseInfo {
  const untilStart = startMs - now
  const untilEnd = endMs - now
  let phase: Phase
  if (untilEnd <= 0) phase = 'ended'
  else if (untilStart <= 0) phase = 'live'
  else if (untilStart <= JOIN_OPEN_BEFORE) phase = 'soon'
  else phase = 'upcoming'
  return { phase, untilStart, untilEnd }
}

/**
 * Format a positive `ms` as a coarse "Nd Nh Nm" string. We deliberately
 * skip seconds when more than a minute remains so the countdown
 * doesn't visually jitter every second when the session is days away;
 * once we cross under a minute we switch to "30s" granularity for
 * the final approach.
 */
function formatRemaining(ms: number): string {
  if (ms <= 0) return ''
  const days = Math.floor(ms / DAY)
  const hours = Math.floor((ms % DAY) / HOUR)
  const minutes = Math.floor((ms % HOUR) / MINUTE)
  const seconds = Math.floor((ms % MINUTE) / SECOND)

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${seconds}s`
}

/**
 * Format the absolute start time using the viewer's locale + tz.
 * Server-rendered first paint uses UTC to avoid hydration mismatch;
 * we swap in the local-formatted version once mounted.
 */
function formatStart(d: Date, locale: 'utc' | 'local'): string {
  if (locale === 'utc') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d)
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
}

/**
 * Smart status block for a scheduled live session.
 *
 * Phases:
 *   upcoming  ->  Calendar icon, full date+time, live countdown,
 *                 disabled join button.
 *   soon      ->  Pulsing "Starting soon" pill, enabled Join button.
 *   live      ->  Animated dot, "Live now", primary Join button,
 *                 secondary text "Ends in Xm".
 *   ended     ->  Check icon, "Session ended" line. The page-level
 *                 auto-complete handles flipping the completion gate
 *                 so the lesson footer renders the success state.
 *
 * Edge cases:
 *  - When we cross from `live` -> `ended` we trigger a single
 *    `router.refresh()` so the server component re-runs and writes
 *    the auto-complete row. After that no more refreshes fire even
 *    if the user lingers on the page.
 *  - We stagger the tick interval (1m far away, 1s when imminent)
 *    so the countdown animates smoothly without burning a render
 *    every second when the session is days out.
 *  - Initial server paint formats in UTC to avoid a hydration
 *    mismatch with the client's local timezone; we swap to local
 *    formatting once mounted.
 */
export function LiveSessionStatus({
  contentId,
  url,
  scheduledAt,
  durationMinutes,
  isCompleted,
  serverNow,
}: Props) {
  const router = useRouter()
  const startMs = useMemo(() => new Date(scheduledAt).getTime(), [scheduledAt])
  const durationMs = (durationMinutes ?? 60) * MINUTE
  const endMs = startMs + durationMs

  // Initial "now" mirrors the server. Both SSR and the first client
  // render use this exact value, so hydration matches. The client
  // re-anchors to its own wall clock in the mount effect below -
  // the gap is sub-second and well below any phase boundary.
  const [now, setNow] = useState<number>(serverNow)
  const [mounted, setMounted] = useState(false)
  const [autoCompletePending, startAutoComplete] = useTransition()

  useEffect(() => {
    setMounted(true)
    setNow(Date.now())
  }, [])

  // Adaptive tick. Far away (> 1h) we tick once a minute; getting
  // close (< 1h to start, or while live) we tick every second so the
  // countdown reads smoothly. We re-evaluate the interval whenever
  // `now` changes - cheap because setInterval/clearInterval on a
  // remount is sub-microsecond.
  useEffect(() => {
    if (!mounted) return
    const remaining = Math.min(
      Math.abs(startMs - now),
      Math.abs(endMs - now),
    )
    let interval: number
    if (remaining < 2 * MINUTE) interval = SECOND
    else if (remaining < HOUR) interval = 5 * SECOND
    else if (remaining < DAY) interval = 30 * SECOND
    else interval = MINUTE

    const timer = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(timer)
  }, [mounted, now, startMs, endMs])

  const { phase, untilStart, untilEnd } = computePhase(now, startMs, endMs)

  // Auto-complete handoff: as soon as we cross into the `ended`
  // phase we ask the server to re-render so the page-level
  // auto-completion upsert runs. We track this with a one-shot
  // flag so the refresh doesn't fire repeatedly while the user
  // sits on the page.
  const [didTriggerRefresh, setDidTriggerRefresh] = useState(false)
  useEffect(() => {
    if (phase !== 'ended' || isCompleted || didTriggerRefresh || !mounted) {
      return
    }
    setDidTriggerRefresh(true)
    startAutoComplete(() => {
      router.refresh()
    })
  }, [phase, isCompleted, didTriggerRefresh, mounted, router])

  function handleJoin() {
    // Open first so the popup blocker treats it as a user gesture.
    window.open(url, '_blank', 'noopener,noreferrer')
    // Record the click so the server-side click history is accurate
    // (even though the live-session completion gate doesn't require
    // it). Failures are silent - the user has already left for Zoom.
    void recordLinkClick(contentId)
  }

  const startDate = new Date(startMs)
  const formattedStart = formatStart(startDate, mounted ? 'local' : 'utc')

  // The four phase variants share the same outer shell so the size
  // of the block doesn't lurch as we cross thresholds. Inner copy
  // and the CTA change only.
  return (
    <section
      aria-label="Live session schedule"
      className="rounded-lg bg-muted/60 p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <PhaseIcon phase={phase} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              <PhaseLabel phase={phase} />
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {phase === 'upcoming' && (
                <>
                  Starts{' '}
                  <span className="font-medium text-foreground">
                    in {formatRemaining(untilStart)}
                  </span>
                  {' - '}
                  <time dateTime={scheduledAt}>{formattedStart}</time>
                </>
              )}
              {phase === 'soon' && (
                <>
                  Starts in{' '}
                  <span className="font-medium text-foreground">
                    {formatRemaining(untilStart)}
                  </span>
                  {' - '}
                  <time dateTime={scheduledAt}>{formattedStart}</time>
                </>
              )}
              {phase === 'live' && (
                <>
                  Ends in{' '}
                  <span className="font-medium text-foreground">
                    {formatRemaining(untilEnd)}
                  </span>
                </>
              )}
              {phase === 'ended' && (
                <>
                  Session ended{' - '}
                  <time dateTime={scheduledAt}>{formattedStart}</time>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Phase-specific CTA. Upcoming = disabled placeholder so the
            layout doesn't shift, Soon/Live = primary join, Ended =
            secondary "Open recording" if the URL still works (admins
            often re-use the join URL as the recording link). */}
        <div className="shrink-0">
          {phase === 'upcoming' && (
            <Button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5"
              title="The join button unlocks 15 minutes before the session starts."
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              Join opens soon
            </Button>
          )}
          {(phase === 'soon' || phase === 'live') && (
            <Button
              type="button"
              onClick={handleJoin}
              className="inline-flex items-center gap-1.5"
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              Join now
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
          {phase === 'ended' && (
            <Button
              type="button"
              variant="outline"
              onClick={handleJoin}
              className="inline-flex items-center gap-1.5"
              disabled={autoCompletePending}
            >
              Open link
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

function PhaseIcon({ phase }: { phase: Phase }) {
  const className = 'h-5 w-5 shrink-0'
  if (phase === 'upcoming') {
    return (
      <Calendar
        className={`${className} text-muted-foreground`}
        aria-hidden="true"
      />
    )
  }
  if (phase === 'soon') {
    return (
      <Calendar
        className={`${className} text-foreground`}
        aria-hidden="true"
      />
    )
  }
  if (phase === 'live') {
    // Pulsing dot communicates "happening right now" without using
    // a green that would clash with the rest of the design.
    return (
      <span
        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-highlight/50" />
        <CircleDot className="relative h-5 w-5 text-highlight" />
      </span>
    )
  }
  return (
    <CheckCircle2
      className={`${className} text-muted-foreground`}
      aria-hidden="true"
    />
  )
}

function PhaseLabel({ phase }: { phase: Phase }) {
  if (phase === 'upcoming') return <>Upcoming live session</>
  if (phase === 'soon') {
    return (
      <>
        Starting soon
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
          Open
        </span>
      </>
    )
  }
  if (phase === 'live') {
    return (
      <>
        Live now
        <span className="rounded-full bg-highlight-soft px-2 py-0.5 text-xs font-medium text-highlight">
          Live
        </span>
      </>
    )
  }
  return <>Session ended</>
}
