import { describe, expect, test } from 'bun:test'
import { buildSessionIcs } from '@/lib/email/ics'

/** Calendar invite attached to session reminder emails. */

const NOW = new Date('2026-12-02T12:00:00Z')
const invite = {
  uid: 'abc-123',
  title: 'Wisdom Coaching Module Three (Wisdom at Work)',
  start: new Date('2026-12-02T19:00:00Z'), // 2:00 PM EST
  minutes: 90,
  url: 'https://zoom.us/j/123456789?pwd=abc',
}

describe('buildSessionIcs', () => {
  const ics = buildSessionIcs(invite, NOW)
  const lines = ics.split('\r\n')

  test('is a well-formed calendar with CRLF line endings', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('BEGIN:VEVENT')
    expect(lines).toContain('END:VEVENT')
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR')
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n')
  })

  test('start and end are in UTC, and the length is applied', () => {
    expect(lines).toContain('DTSTART:20261202T190000Z')
    expect(lines).toContain('DTEND:20261202T203000Z') // 90 minutes later
  })

  test('has a stable UID so re-adding updates rather than duplicates', () => {
    expect(lines).toContain('UID:abc-123@wisdomatwork-portal')
  })

  test('carries the Zoom link as location and in the description', () => {
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('LOCATION:https://zoom.us/j/123456789?pwd=abc')
    expect(unfolded).toContain('Join on Zoom: https://zoom.us/j/123456789?pwd=abc')
  })

  test('adds a 30 minute reminder', () => {
    expect(lines).toContain('TRIGGER:-PT30M')
  })

  test('escapes commas, semicolons and newlines in text', () => {
    const out = buildSessionIcs({ ...invite, title: 'Lab, one; part\ntwo' }, NOW)
    expect(out).toContain('SUMMARY:Lab\\, one\\; part\\ntwo')
  })

  test('folds long lines to 75 octets or fewer', () => {
    const long = buildSessionIcs({ ...invite, description: 'x'.repeat(300) }, NOW)
    for (const line of long.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  test('omits location when there is no Zoom link', () => {
    const out = buildSessionIcs({ ...invite, url: null }, NOW)
    expect(out).not.toContain('LOCATION:')
    expect(out).not.toContain('URL:')
  })
})
