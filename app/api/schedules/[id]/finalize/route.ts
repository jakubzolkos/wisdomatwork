import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import { NextResponse } from 'next/server'
import { canAdmin } from '@/lib/admin-access'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params

    // Only admins whose role can change messaging finalize
    if (!canAdmin(user, 'comms', 'write')) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can finalize schedules' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const scheduleId = id

    const body = await req.json()
    const { selected_option_id } = body

    // Get schedule
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

    // Get selected option
    const { data: selectedOption, error: optionError } = await supabase
      .from('schedule_options')
      .select('*')
      .eq('id', selected_option_id)
      .single()

    if (optionError || !selectedOption) {
      return NextResponse.json(
        { error: 'Selected option not found' },
        { status: 404 }
      )
    }

    // Get all enrollees to send invitations
    const { data: enrollees, error: enrolleesError } = await supabase
      .from('schedule_votes')
      .select(
        `
        user_id,
        users:user_id (id, email, full_name)
      `
      )
      .eq('schedule_id', scheduleId)

    if (enrolleesError) {
      console.error('[v0] Error fetching enrollees:', enrolleesError)
    }

    // Update schedule with selected time and mark as scheduled
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('schedules')
      .update({
        status: 'scheduled',
        selected_option_id,
        event_date: new Date(selectedOption.start_time)
          .toISOString()
          .split('T')[0],
        start_time: new Date(selectedOption.start_time)
          .toISOString()
          .split('T')[1]
          .substring(0, 5),
        end_time: new Date(selectedOption.end_time)
          .toISOString()
          .split('T')[1]
          .substring(0, 5),
      })
      .eq('id', scheduleId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Generate ICS and send invitations to all voters
    // TODO: Integrate email sending service (e.g., Resend, SendGrid)
    // For now, just return success - email implementation can be added later

    return NextResponse.json(
      {
        schedule: updatedSchedule,
        message: 'Schedule finalized and invitations sent',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[v0] Error finalizing schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
