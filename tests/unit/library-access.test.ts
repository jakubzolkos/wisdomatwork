import { describe, expect, test } from 'bun:test'
import { canUserSeeLibraryResource } from '@/lib/content-access'

/**
 * Who may open a library resource. The Staff Library (staff_only) is for
 * admins and facilitators only; it must never reach a fellow, whatever
 * its cohorts or universal flag say.
 */

const fellowA = { role: 'fellow', cohort: 'A' } as const
const fellowNoCohort = { role: 'fellow', cohort: null } as const
const facilitator = { role: 'facilitator', cohort: null } as const
const admin = { role: 'admin', cohort: null } as const

describe('staff-only library resources', () => {
  const staffOnly = { cohorts: [] as string[], is_universal: false, staff_only: true }

  test('admins and facilitators can see them', () => {
    expect(canUserSeeLibraryResource(admin, staffOnly)).toBe(true)
    expect(canUserSeeLibraryResource(facilitator, staffOnly)).toBe(true)
  })

  test('fellows cannot see them', () => {
    expect(canUserSeeLibraryResource(fellowA, staffOnly)).toBe(false)
    expect(canUserSeeLibraryResource(fellowNoCohort, staffOnly)).toBe(false)
  })

  test('staff-only wins even if the row is also marked universal or has cohorts', () => {
    const sneaky = { cohorts: ['A', 'B', 'C'], is_universal: true, staff_only: true }
    expect(canUserSeeLibraryResource(fellowA, sneaky)).toBe(false)
    expect(canUserSeeLibraryResource(facilitator, sneaky)).toBe(true)
  })
})

describe('other library resources are unchanged', () => {
  test('recommended (universal) rows are open to every fellow', () => {
    const row = { cohorts: ['A', 'B', 'C'], is_universal: true, staff_only: false }
    expect(canUserSeeLibraryResource(fellowA, row)).toBe(true)
    expect(canUserSeeLibraryResource(fellowNoCohort, row)).toBe(true)
  })

  test('cohort-gated rows need the fellow to be assigned', () => {
    const row = { cohorts: ['A'], is_universal: false, staff_only: false }
    expect(canUserSeeLibraryResource(fellowA, row)).toBe(true)
    expect(canUserSeeLibraryResource({ role: 'fellow', cohort: 'B' }, row)).toBe(false)
  })

  test('a row from before the column existed (staff_only missing) behaves as before', () => {
    expect(canUserSeeLibraryResource(fellowA, { cohorts: ['A'], is_universal: false })).toBe(true)
  })
})
