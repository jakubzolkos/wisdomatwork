'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScheduleVotingForm } from '@/components/schedule/voting-form'
import { PageHeader } from '@/components/page-header'

export default async function ScheduleVotingPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await requireUser()
  const supabase = await createClient()

  try {
    // Fetch the schedule
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
        schedule_options (
          id,
          start_time,
          end_time,
          order_number
      )
    `,
    )
    .eq('id', params.id)
    .single()

    if (scheduleError?.code === 'PGRST205') {
      // Table doesn't exist yet
      redirect('/dashboard')
    }

    if (scheduleError || !schedule) {
      redirect('/dashboard')
    }

    // Check if voting is still open
    if (schedule.voting_closes_at) {
      const closesAt = new Date(schedule.voting_closes_at)
      if (closesAt < new Date()) {
        redirect('/dashboard')
      }
    }

    // Fetch user's existing votes (if any)
    const { data: existingVote } = await supabase
      .from('schedule_votes')
      .select('id, option_id')
      .eq('schedule_id', schedule.id)
      .eq('user_id', user.id)
      .maybeSingle()

    async function submitVote(optionId: string) {
      'use server'
      const supabase = await createClient()
      const user = await requireUser()

      // If user already voted, update their vote
      if (existingVote) {
        await supabase
          .from('schedule_votes')
          .update({ option_id: optionId })
          .eq('id', existingVote.id)
      } else {
        // Otherwise, create a new vote
        await supabase.from('schedule_votes').insert({
          schedule_id: schedule!.id,
          user_id: user.id,
          option_id: optionId,
        })
      }

      redirect(`/schedule/${schedule!.id}/thank-you`)
    }

    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
          {/* Header Section */}
          <PageHeader
            eyebrow="Schedule poll"
            title={schedule.title}
            description={schedule.description || undefined}
          />

          {/* Content Section */}
          <div className="space-y-6">
            {/* Meeting Details */}
            <Card className="gap-0 py-0 shadow-xs">
              <CardHeader className="gap-1 border-b border-border px-5 py-4 sm:px-6 [.border-b]:pb-4">
                <CardTitle className="text-base">Meeting Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-5 sm:px-6">
                <dl className="grid gap-5 sm:grid-cols-2">
                  {schedule.location && (
                    <div className="space-y-1">
                      <dt className="text-xs font-medium text-muted-foreground">Location</dt>
                      <dd className="text-sm font-medium text-foreground">{schedule.location}</dd>
                    </div>
                  )}
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground">Voting Closes</dt>
                    <dd className="text-sm font-medium text-foreground">
                      {new Date(schedule.voting_closes_at).toLocaleString()}
                    </dd>
                  </div>
                  {schedule.meeting_link && (
                    <div className="space-y-1 sm:col-span-2">
                      <dt className="text-xs font-medium text-muted-foreground">Meeting Link</dt>
                      <dd>
                        <a
                          href={schedule.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-sm font-medium text-primary underline-offset-[3px] hover:underline"
                        >
                          {schedule.meeting_link}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Voting Form */}
            <Card className="gap-0 py-0 shadow-xs">
              <CardHeader className="gap-1 border-b border-border px-5 py-4 sm:px-6 [.border-b]:pb-4">
                <CardTitle className="text-base">Your Availability</CardTitle>
                <CardDescription>
                  Select the time slot when you can attend
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 py-5 sm:px-6">
                <ScheduleVotingForm
                  scheduleId={schedule.id}
                  options={schedule.schedule_options || []}
                  existingVoteOptionId={existingVote?.option_id}
                  onSubmit={submitVote}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  } catch (error) {
    console.error('[v0] Error in schedule page:', error)
    redirect('/dashboard')
  }
}
