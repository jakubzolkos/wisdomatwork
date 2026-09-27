'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import type { DashboardSession } from '@/lib/dashboard-data'

function formatSessionTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/**
 * Live-updating clock that ticks every 30s. Returns null on the first
 * render so SSR and the first client render match.
 */
function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function LiveSessionCard({ session }: { session: DashboardSession }) {
  const now = useNow()
  const startMs = new Date(session.startTime).getTime()
  const endMs = new Date(session.endTime).getTime()
  // Pre-hydration assume not joinable so SSR markup is stable.
  const effectiveNow = now ?? startMs - 60 * 60 * 1000
  const tenMinBefore = startMs - 10 * 60 * 1000
  const isLive = effectiveNow >= startMs && effectiveNow < endMs
  const canJoin = effectiveNow >= tenMinBefore && effectiveNow < endMs

  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            {isLive ? (
              <div
                className="mt-1.5 flex shrink-0 items-center gap-2 rounded-full bg-highlight-soft px-2.5 py-1"
                aria-label="Live now"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-highlight opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-highlight" />
                </span>
                <span className="text-xs font-medium text-highlight">
                  Live now
                </span>
              </div>
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Calendar className="size-[18px]" aria-hidden="true" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="eyebrow">Live session</p>
              <h3 className="mt-1 text-pretty">{session.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatSessionTime(new Date(session.startTime))}
              </p>
            </div>
          </div>

          {session.joinUrl ? (
            <a
              href={canJoin ? session.joinUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!canJoin}
              tabIndex={canJoin ? 0 : -1}
            >
              <Button
                disabled={!canJoin}
                variant={canJoin ? 'default' : 'outline'}
                size="sm"
              >
                Join
              </Button>
            </a>
          ) : (
            <Button disabled variant="outline" size="sm">
              Join
            </Button>
          )}
        </div>

        {session.facilitators.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border pt-4">
            <div className="flex -space-x-2">
              {session.facilitators.map((fac) => (
                <Avatar key={fac.id} className="size-7 border-2 border-card">
                  <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
                    {fac.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {session.facilitators.map((f) => f.name).join(', ')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
