import { describe, expect, test } from 'bun:test'
import type { CurriculumRows } from '@/lib/curriculum-tree'
import { morningOf, planProgramReminders } from '@/lib/notifications/program-reminders'
import { firstNameOf } from '@/lib/email/templates/notification'

/**
 * Session-day reminders: 7:00 AM Eastern on the day of the session, with
 * the Zoom link as the button. And first-name greetings.
 */

describe('morningOf', () => {
  test('winter session: 7 AM EST is 12:00 UTC', () => {
    // Wed Dec 2, 2026, 2:00 PM EST
    expect(new Date(morningOf(new Date('2026-12-02T19:00:00Z'))).toISOString()).toBe('2026-12-02T12:00:00.000Z')
  })

  test('summer session: 7 AM EDT is 11:00 UTC', () => {
    // Wed Oct 7, 2026, 2:00 PM EDT
    expect(new Date(morningOf(new Date('2026-10-07T18:00:00Z'))).toISOString()).toBe('2026-10-07T11:00:00.000Z')
  })

  test('uses the Eastern day, not the UTC day, for a late-evening session', () => {
    // 9:30 PM EST on Dec 2 is already Dec 3 in UTC.
    expect(new Date(morningOf(new Date('2026-12-03T02:30:00Z'))).toISOString()).toBe('2026-12-02T12:00:00.000Z')
  })
})

function rows(url: string | null): CurriculumRows {
  return {
    phases: [{ id: 'p', title: 'Wisdom Coaching', description: null, order_index: 1, cohorts: ['A'] }],
    modules: [
      { id: 'm', phase_id: 'p', title: 'Wisdom Coaching Module Three', description: null, cohorts: null, order_index: 1, is_sequential: false, opens_at: null },
    ],
    items: [
      {
        id: 'i', year_id: 'p', module_id: 'm', title: 'Live Wisdom Coaching', category: 'during_lab', cohorts: null,
        duration_minutes: 90, order_index: 1, resource_type: 'live_session', scheduled_at: '2026-12-02T19:00:00Z',
        reflection_enabled: false, url, description: null,
      },
    ],
  } as unknown as CurriculumRows
}

describe('session-day reminder', () => {
  const now = new Date('2026-11-16T12:00:00Z').getTime()

  test('is sent at 7 AM ET on the day, with the Zoom link as the button', () => {
    const [r] = planProgramReminders(rows('https://zoom.us/j/123'), now).filter((x) => x.key.content_id === 'i')
    expect(r.sendAt).toBe('2026-12-02T12:00:00.000Z')
    expect(r.title).toStartWith('Today: ')
    expect(r.ctaLabel).toBe('Join on Zoom')
    expect(r.ctaPath).toBe('https://zoom.us/j/123')
  })

  test('without a Zoom link it points at the session page instead', () => {
    const [r] = planProgramReminders(rows(null), now).filter((x) => x.key.content_id === 'i')
    expect(r.ctaLabel).toBe('Open the session')
    expect(r.ctaPath).toBe('/phases/p/modules/m/items/i')
  })

  test('nothing is planned once that morning has passed', () => {
    const late = new Date('2026-12-02T13:00:00Z').getTime()
    expect(planProgramReminders(rows('https://zoom.us/j/123'), late).filter((x) => x.key.content_id === 'i')).toHaveLength(0)
  })
})

describe('firstNameOf', () => {
  test('takes the first name', () => expect(firstNameOf('Jane Doe')).toBe('Jane'))
  test('skips a leading title', () => {
    expect(firstNameOf('Dr. Mark Pacheco')).toBe('Mark')
    expect(firstNameOf('Sr. Mary Ann Smith')).toBe('Mary')
  })
  test('copes with empty and single names', () => {
    expect(firstNameOf('')).toBeNull()
    expect(firstNameOf(null)).toBeNull()
    expect(firstNameOf('Cher')).toBe('Cher')
    expect(firstNameOf('Dr.')).toBe('Dr.')
  })
})
