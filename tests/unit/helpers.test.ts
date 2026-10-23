import { describe, expect, test } from 'bun:test'
import { canAdmin, canAssignRoles, effectiveAdminRole } from '@/lib/admin-access'
import { fillUniqueId } from '@/lib/survey-links'
import { datesInText, formatWhen, itemWhen } from '@/lib/item-dates'

describe('admin roles', () => {
  const admin = (adminRole: string | null) => ({ role: 'admin', adminRole: adminRole as never })

  test('an admin with no role set keeps full access (before 066)', () => {
    expect(effectiveAdminRole(admin(null))).toBe('tech')
    expect(canAdmin(admin(null), 'system', 'write')).toBe(true)
  })

  test('each role sees only what its work requires (Call for Proposals)', () => {
    // Operations: onboarding + content, views progress.
    expect(canAdmin(admin('ops'), 'people', 'write')).toBe(true)
    expect(canAdmin(admin('ops'), 'content', 'write')).toBe(true)
    expect(canAdmin(admin('ops'), 'progress', 'read')).toBe(true)
    expect(canAdmin(admin('ops'), 'progress', 'write')).toBe(false)
    expect(canAdmin(admin('ops'), 'comms', 'read')).toBe(false)
    // Research: progress and exports, views content.
    expect(canAdmin(admin('research'), 'progress', 'write')).toBe(true)
    expect(canAdmin(admin('research'), 'content', 'read')).toBe(true)
    expect(canAdmin(admin('research'), 'content', 'write')).toBe(false)
    expect(canAdmin(admin('research'), 'people', 'read')).toBe(false)
    // Communications: messaging only.
    expect(canAdmin(admin('comms'), 'comms', 'write')).toBe(true)
    for (const area of ['people', 'progress', 'content', 'system'] as const) {
      expect(canAdmin(admin('comms'), area, 'read')).toBe(false)
    }
    // Only tech reaches system pages.
    for (const r of ['ops', 'research', 'comms']) expect(canAdmin(admin(r), 'system', 'read')).toBe(false)
  })

  test('only tech assigns roles; fellows and facilitators get nothing', () => {
    expect(canAssignRoles(admin('tech'))).toBe(true)
    expect(canAssignRoles(admin('ops'))).toBe(false)
    expect(canAdmin({ role: 'fellow' }, 'progress', 'read')).toBe(false)
    expect(canAdmin({ role: 'facilitator' }, 'content', 'read')).toBe(false)
  })
})

describe('survey Unique ID prefill', () => {
  const url = 'https://docs.google.com/forms/d/e/X/viewform?usp=pp_url&entry.2117511694=UNIQUE_ID'

  test("fills in the fellow's own ID", () => {
    expect(fillUniqueId(url, 'WAW2526ABC')).toEndWith('entry.2117511694=WAW2526ABC')
  })

  test('drops the prefill when there is no ID, leaving a working link', () => {
    expect(fillUniqueId(url, null)).toBe('https://docs.google.com/forms/d/e/X/viewform?usp=pp_url')
  })

  test('leaves other links alone', () => {
    expect(fillUniqueId('https://example.org/a?b=1', 'WAW1')).toBe('https://example.org/a?b=1')
  })
})

describe('item dates', () => {
  test('reads choices and deadlines from descriptions', () => {
    expect(datesInText('October 14 or October 21, 2026. Zoom link here.').dates).toEqual(['2026-10-14', '2026-10-21'])
    expect(datesInText('Due March 10, 2027.').isDeadline).toBe(true)
    expect(datesInText('One meeting before May 19, 2027.').isDeadline).toBe(true)
    expect(datesInText('Complete at the close of the session.').dates).toEqual([])
  })

  test('shows one date, sessions with their Eastern time', () => {
    expect(formatWhen(itemWhen({ scheduled_at: null, description: 'October 14 or October 21, 2026.' })!)).toBe('Oct 14')
    expect(formatWhen(itemWhen({ scheduled_at: null, description: 'Due March 10, 2027.' })!)).toBe('Due Mar 10')
    expect(formatWhen(itemWhen({ scheduled_at: '2026-10-07T18:00:00Z', description: null })!)).toBe('Wed, Oct 7, 2:00 PM')
  })
})
