import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import { NextResponse } from 'next/server'
import { canAdmin } from '@/lib/admin-access'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const supabase = await createClient()
    const scheduleId = id

    // Get schedule details
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Get options if it's a poll
    let options = null
    if (schedule.is_poll) {
      const { data: optionsData, error: optionsError } = await supabase
        .from('schedule_options')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('order_number', { ascending: true })

      if (!optionsError) {
        options = optionsData
      }
    }

    // Get votes (only show all votes if user is admin)
    let votes = null
    if (canAdmin(user, 'comms', 'read') || schedule.created_by_admin === user.id) {
      const { data: votesData, error: votesError } = await supabase
        .from('schedule_votes')
        .select(
          `
          id,
          user_id,
          preferred_option_id,
          created_at,
          users:user_id (full_name, email)
        `
        )
        .eq('schedule_id', scheduleId)

      if (!votesError) {
        votes = votesData
      }
    } else {
      // Show only user's own vote
      const { data: userVote, error: voteError } = await supabase
        .from('schedule_votes')
        .select('*')
        .eq('schedule_id', scheduleId)
        .eq('user_id', user.id)
        .single()

      if (!voteError) {
        votes = [userVote]
      }
    }

    return NextResponse.json({
      schedule,
      options,
      votes,
    })
  } catch (error) {
    console.error('[v0] Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
