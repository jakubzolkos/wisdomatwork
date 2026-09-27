'use client'

import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react'
import { DeletePollModal } from './delete-poll-modal'

interface Schedule {
  id: string
  title: string
  description: string | null
  location: string | null
  status: 'polling' | 'scheduled' | 'completed'
  is_poll: boolean
  voting_closes_at: string | null
  event_date: string
  start_time: string | null
  created_at: string
}

interface AdminPollListProps {
  schedules: Schedule[]
  onDeletePoll?: (scheduleId: string) => Promise<void>
}

export function AdminPollList({ schedules, onDeletePoll }: AdminPollListProps) {
  const pollCount = schedules.filter((s) => s.is_poll).length
  const activePollCount = schedules.filter((s) => s.status === 'polling').length
  const scheduledCount = schedules.filter((s) => s.status === 'scheduled').length

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="py-5 shadow-xs">
          <CardContent className="px-4 sm:px-5">
            <div className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{activePollCount}</div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Active Polls</p>
          </CardContent>
        </Card>

        <Card className="py-5 shadow-xs">
          <CardContent className="px-4 sm:px-5">
            <div className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{scheduledCount}</div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Confirmed Events</p>
          </CardContent>
        </Card>

        <Card className="py-5 shadow-xs">
          <CardContent className="px-4 sm:px-5">
            <div className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{pollCount}</div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Total Created</p>
          </CardContent>
        </Card>
      </div>

      {/* Poll List */}
      <div>
        <h3 className="mb-4">Your Polls</h3>
        {schedules.length === 0 ? (
          <Card className="border-dashed border-border-strong bg-transparent py-10 shadow-none">
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                No polls yet. Create one to get started with scheduling.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <Card
                key={schedule.id}
                className="group py-4 shadow-xs transition hover:border-border-strong hover:shadow-md"
              >
                <CardContent className="px-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    {/* Left Content */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/admin/schedule/${schedule.id}`}>
                        <h4 className="text-sm font-semibold text-foreground truncate transition-colors group-hover:text-primary">
                          {schedule.title}
                        </h4>
                      </Link>

                      {schedule.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {schedule.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-3 mt-3">
                        {schedule.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{schedule.location}</span>
                          </div>
                        )}

                        {schedule.voting_closes_at && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Closes {format(new Date(schedule.voting_closes_at), 'MMM d')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          schedule.status === 'polling'
                            ? 'whitespace-nowrap bg-success-soft text-success'
                            : 'whitespace-nowrap'
                        }
                      >
                        {schedule.status === 'polling' ? 'Voting Open' : 'Scheduled'}
                      </Badge>

                      <Link href={`/admin/schedule/${schedule.id}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5"
                        >
                          View Results
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>

                      <DeletePollModal
                        scheduleId={schedule.id}
                        scheduleTitle={schedule.title}
                        deletePoll={onDeletePoll || (async () => {})}
                        variant="icon"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
