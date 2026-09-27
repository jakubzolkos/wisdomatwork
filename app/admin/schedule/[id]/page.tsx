'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeletePollModal } from '@/components/schedule/delete-poll-modal'

export default async function AdminScheduleDetailPage({
  params,
}: {
  params: { id: string }
}) {
  await requireAdmin()
  const supabase = await createClient()

  async function deletePoll(scheduleId: string) {
    'use server'
    const supabase = await createClient()
    const admin = await requireAdmin()

    // Verify the poll belongs to this admin
    const { data: schedule } = await supabase
      .from('schedules')
      .select('id, created_by_admin')
      .eq('id', scheduleId)
      .single()

    if (!schedule || schedule.created_by_admin !== admin.id) {
      throw new Error('Unauthorized to delete this poll')
    }

    // Delete the schedule - cascading deletes will remove options and votes
    const { error } = await supabase.from('schedules').delete().eq('id', scheduleId)

    if (error) throw error

    redirect('/admin/schedule')
  }

  try {
    // Fetch schedule with options and vote counts
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(
        `
        id,
        title,
        description,
        location,
        meeting_link,
        status,
        is_poll,
        voting_closes_at,
        event_date,
        selected_option_id,
        created_at,
        schedule_options (
          id,
          start_time,
          end_time,
          order_number
        )
      `
      )
      .eq('id', params.id)
      .single()

    if (scheduleError || !schedule) {
      // Re-throw redirect so it's not caught by catch block
      return redirect('/admin/schedule')
    }

    // Fetch vote counts for each option
    const { data: votes } = await supabase
      .from('schedule_votes')
      .select('preferred_option_id')
      .eq('schedule_id', params.id)

    // Count votes per option
    const votesByOption: { [key: string]: number } = {}
    votes?.forEach((vote) => {
      votesByOption[vote.preferred_option_id] = (votesByOption[vote.preferred_option_id] || 0) + 1
    })

    const totalVotes = votes?.length || 0
    const options = (schedule.schedule_options || []).sort((a: any, b: any) => a.order_number - b.order_number)

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="font-serif text-3xl font-bold text-foreground">
              {schedule.title}
            </h1>
            {schedule.description && (
              <p className="mt-2 text-muted-foreground max-w-2xl">
                {schedule.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant={
                schedule.status === 'polling' ? 'default' : 'secondary'
              }
            >
              {schedule.status === 'polling'
                ? 'Voting Open'
                : schedule.status === 'scheduled'
                ? 'Scheduled'
                : 'Completed'}
            </Badge>
            <DeletePollModal
              scheduleId={schedule.id}
              scheduleTitle={schedule.title}
              deletePoll={deletePoll}
              variant="button"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalVotes}</div>
              <p className="text-xs text-muted-foreground">
                Responses received
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Voting Closes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {schedule.voting_closes_at
                  ? format(new Date(schedule.voting_closes_at), 'MMM d, h:mm a')
                  : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {schedule.voting_closes_at && new Date(schedule.voting_closes_at) < new Date()
                  ? 'Closed'
                  : 'Still open'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Selected Option
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {schedule.selected_option_id
                  ? format(new Date(options.find((o: any) => o.id === schedule.selected_option_id)?.start_time || new Date()), 'MMM d')
                  : 'Not yet decided'}
              </div>
              <p className="text-xs text-muted-foreground">
                Winning time slot
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Meeting Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedule.location && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p className="text-foreground">{schedule.location}</p>
              </div>
            )}
            {schedule.meeting_link && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Meeting Link</p>
                <a
                  href={schedule.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {schedule.meeting_link}
                </a>
              </div>
            )}
            {schedule.event_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Event Date</p>
                <p className="text-foreground">
                  {format(new Date(schedule.event_date), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Polling Results</CardTitle>
            <CardDescription>
              Votes per time option
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">No options available</p>
            ) : (
              options.map((option: any) => {
                const voteCount = votesByOption[option.id] || 0
                const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0

                return (
                  <div key={option.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {format(new Date(option.start_time), 'MMM d, h:mm a')} - {format(new Date(option.end_time), 'h:mm a')}
                      </span>
                      <span className="text-muted-foreground">
                        {voteCount} vote{voteCount !== 1 ? 's' : ''} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    console.error('[v0] Error loading schedule details:', error)
    // Re-throw if it's a redirect
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error
    }
    redirect('/admin/schedule')
  }
}
