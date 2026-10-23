'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { scheduleProgramReminders } from './reminder-actions'

export interface ReminderPreview {
  title: string
  sendAt: string
  cohorts: string[]
}

const WHEN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/**
 * Lists the program reminders worked out from the curriculum
 * (lib/notifications/program-reminders.ts) and schedules them in one
 * click. Once scheduled they're ordinary notifications: edit or cancel
 * each in the Scheduled tab before it sends.
 */
export function ProgramRemindersCard({ reminders }: { reminders: ReminderPreview[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function schedule() {
    setMessage(null)
    startTransition(async () => {
      const res = await scheduleProgramReminders()
      if (!res.ok) {
        setMessage(res.message)
        return
      }
      setMessage(`Scheduled ${res.created} reminder${res.created === 1 ? '' : 's'}. Review them in the Scheduled tab.`)
      router.refresh()
    })
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <BellRing className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {reminders.length} program reminder{reminders.length === 1 ? '' : 's'} ready to schedule
              </p>
              <p className="text-sm text-muted-foreground">
                An email + notification the day before each session, and when each module opens, to that
                module&rsquo;s cohort. Once scheduled, edit or cancel any of them in the Scheduled tab before it
                sends.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide list' : 'Show list'}
            </Button>
            <Button type="button" size="sm" onClick={schedule} disabled={pending}>
              {pending ? 'Scheduling…' : 'Schedule reminders'}
            </Button>
          </div>
        </div>

        {open && (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {reminders.map((r) => (
              <li key={`${r.sendAt}-${r.title}`} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-3 py-2">
                <span className="text-foreground">{r.title}</span>
                <span className="text-xs text-muted-foreground">
                  {WHEN.format(new Date(r.sendAt))} ET &middot; Cohort {r.cohorts.join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}

        {message && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
