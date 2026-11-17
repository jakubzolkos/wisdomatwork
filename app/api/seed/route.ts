import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()

  try {
    // Create seed programs
    const programsData = [
      {
        title: 'Year One: Deep Learning',
        description:
          'One listening session with each school team (October). Five 2-hour interactive, synchronous, practice-based modules (November, January, February, March, and April). Ongoing field work where leaders apply tools within their context.',
        year: 'year_one',
        start_date: '2024-10-01',
        end_date: '2025-04-30',
      },
      {
        title: 'Year Two: Wisdom Coaching',
        description:
          'Five 90-minute interactive team coaching sessions across Fall and Spring. Real-time collaborative problem-solving and team-based implementation.',
        year: 'year_two',
        start_date: '2025-09-01',
        end_date: '2026-05-31',
      },
      {
        title: 'Year Three: WaW Fellows Networked Community of Practice (CoP)',
        description:
          'Quarterly convenings to stay connected, problem-solve, and mentor others. Ongoing learning through CoP, podcast, and subscription library. Optional licensure track to facilitate and scale WaW beyond their own schools.',
        year: 'year_three',
        start_date: '2026-09-01',
        end_date: '2027-08-31',
      },
    ]

    // Insert programs
    const { data: insertedPrograms, error: programError } = await supabase
      .from('programs')
      .insert(programsData)
      .select()

    if (programError) {
      return NextResponse.json(
        { error: 'Failed to create programs', details: programError },
        { status: 400 }
      )
    }

    // Create modules for each program
    const modulesData = [
      // Year One Modules
      {
        program_id: insertedPrograms[0].id,
        title: 'Listening Session: Understanding School Context',
        description: 'One listening session with your school team to understand context and priorities.',
        order_number: 1,
        start_date: '2024-10-01',
        end_date: '2024-10-31',
        duration_hours: 2,
        module_type: 'listening_session',
      },
      {
        program_id: insertedPrograms[0].id,
        title: 'Module 1: Leadership Foundations',
        description: 'Interactive module exploring core leadership competencies and practices.',
        order_number: 2,
        start_date: '2024-11-01',
        end_date: '2024-11-30',
        duration_hours: 2,
        module_type: 'interactive_module',
      },
      {
        program_id: insertedPrograms[0].id,
        title: 'Module 2: Building Trust and Collaboration',
        description: 'Interactive practice-based module on fostering trust within school communities.',
        order_number: 3,
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        duration_hours: 2,
        module_type: 'interactive_module',
      },
      {
        program_id: insertedPrograms[0].id,
        title: 'Module 3: Data-Informed Decision Making',
        description: 'Using data to inform strategic decisions and improvements.',
        order_number: 4,
        start_date: '2025-02-01',
        end_date: '2025-02-28',
        duration_hours: 2,
        module_type: 'interactive_module',
      },
      {
        program_id: insertedPrograms[0].id,
        title: 'Module 4: Change Management and Innovation',
        description: 'Leading change initiatives and fostering innovation in schools.',
        order_number: 5,
        start_date: '2025-03-01',
        end_date: '2025-03-31',
        duration_hours: 2,
        module_type: 'interactive_module',
      },
      {
        program_id: insertedPrograms[0].id,
        title: 'Module 5: Sustaining Improvement',
        description: 'Strategies for sustaining and scaling improvements over time.',
        order_number: 6,
        start_date: '2025-04-01',
        end_date: '2025-04-30',
        duration_hours: 2,
        module_type: 'interactive_module',
      },
      {
        program_id: insertedPrograms[0].id,
        title: 'Field Work: Applying Learning',
        description: 'Ongoing field work where you apply tools and practices within your school context.',
        order_number: 7,
        start_date: '2024-10-01',
        end_date: '2025-04-30',
        duration_hours: null,
        module_type: 'field_work',
      },
      // Year Two Modules
      {
        program_id: insertedPrograms[1].id,
        title: 'Coaching Session 1: Strategy Alignment',
        description: 'Team coaching on aligning implementation strategies with school goals.',
        order_number: 1,
        start_date: '2025-09-01',
        end_date: '2025-10-01',
        duration_hours: 1,
        module_type: 'coaching',
      },
      {
        program_id: insertedPrograms[1].id,
        title: 'Coaching Session 2: Building Team Capacity',
        description: 'Developing team capabilities and distributing leadership.',
        order_number: 2,
        start_date: '2025-11-01',
        end_date: '2025-12-01',
        duration_hours: 1,
        module_type: 'coaching',
      },
      {
        program_id: insertedPrograms[1].id,
        title: 'Implementation: Translating Vision to Action',
        description: 'Real-time collaborative problem-solving for implementation challenges.',
        order_number: 3,
        start_date: '2025-09-01',
        end_date: '2026-05-31',
        duration_hours: null,
        module_type: 'implementation',
      },
      // Year Three Modules
      {
        program_id: insertedPrograms[2].id,
        title: 'Q1 Convening: Connecting and Problem-Solving',
        description: 'First quarterly gathering to stay connected and address emerging challenges.',
        order_number: 1,
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        duration_hours: 3,
        module_type: 'coaching',
      },
      {
        program_id: insertedPrograms[2].id,
        title: 'Podcast Series: Leadership Insights',
        description: 'Ongoing learning through curated podcast content on leadership topics.',
        order_number: 2,
        start_date: '2026-09-01',
        end_date: '2027-08-31',
        duration_hours: null,
        module_type: 'field_work',
      },
    ]

    const { error: moduleError } = await supabase.from('modules').insert(modulesData)

    if (moduleError) {
      return NextResponse.json(
        { error: 'Failed to create modules', details: moduleError },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        message: 'Database seeded successfully',
        programs: insertedPrograms.length,
        modules: modulesData.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Seed failed', details: error }, { status: 500 })
  }
}
