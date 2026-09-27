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
      <div className="min-h-screen bg-canvas flex flex-col">
        <main className="w-full flex-1 flex flex-col">
          {/* Header Section */}
          <section className="border-b border-border bg-card">
            <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 text-center">
              <h1 className="font-serif text-4xl font-bold text-foreground mb-3">
                {schedule.title}
              </h1>
              {schedule.description && (
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  {schedule.description}
                </p>
              )}
            </div>
          </section>

          {/* Content Section */}
          <section className="flex-1 bg-background">
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
              {/* Meeting Details */}
              <Card className="border border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Meeting Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {schedule.location && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                      <p className="text-foreground font-medium">{schedule.location}</p>
                    </div>
                  )}
                  {schedule.meeting_link && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Meeting Link</p>
                      <a
                        href={schedule.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all font-medium"
                      >
                        {schedule.meeting_link}
                      </a>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Voting Closes</p>
                    <p className="text-foreground font-medium">
                      {new Date(schedule.voting_closes_at).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Voting Form */}
              <Card className="border border-border/50 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Your Availability</CardTitle>
                  <CardDescription className="text-base">
                    Select the time slot when you can attend
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScheduleVotingForm
                    scheduleId={schedule.id}
                    options={schedule.schedule_options || []}
                    existingVoteOptionId={existingVote?.option_id}
                    onSubmit={submitVote}
                  />
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    )
  } catch (error) {
    console.error('[v0] Error in schedule page:', error)
    redirect('/dashboard')
  }
}
