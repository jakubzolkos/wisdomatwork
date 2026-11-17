import { describe, expect, test } from 'bun:test'
import {
  hasMergeFields,
  isAllowedCtaTemplate,
  mergeProblems,
  safeCtaUrl,
  renderMerge,
  sampleData,
  writesOwnGreeting,
} from '@/lib/notifications/merge-fields'

/** Per-recipient fields in notification emails. */

describe('renderMerge', () => {
  const data = { first_name: 'Jane', zoom_link: 'https://zoom.us/j/1' }

  test('fills known fields', () => {
    expect(renderMerge('Hi {{first_name}}, join: {{zoom_link}}', data)).toBe('Hi Jane, join: https://zoom.us/j/1')
  })

  test('allows spaces and any letter case inside the braces', () => {
    expect(renderMerge('{{ First_Name }}', data)).toBe('Jane')
  })

  test('a known field with no value becomes empty', () => {
    expect(renderMerge('Zoom: {{session_time}}.', data)).toBe('Zoom: .')
    expect(renderMerge('x{{full_name}}y', { full_name: null })).toBe('xy')
  })

  test('an unknown field is left as written so a typo is noticed', () => {
    expect(renderMerge('Hi {{firstname}}', data)).toBe('Hi {{firstname}}')
  })

  test('fills every occurrence', () => {
    expect(renderMerge('{{first_name}} / {{first_name}}', data)).toBe('Jane / Jane')
  })

  test('text without fields is unchanged', () => {
    expect(renderMerge('Nothing to fill.', data)).toBe('Nothing to fill.')
  })
})

describe('mergeProblems', () => {
  test('flags unknown fields', () => {
    expect(mergeProblems(['Hi {{firstname}}'], true).unknown).toEqual(['firstname'])
  })

  test('flags session fields when no session is pinned', () => {
    const p = mergeProblems(['{{zoom_link}} at {{session_time}}', 'Hi {{first_name}}'], false)
    expect(p.needsSession.sort()).toEqual(['session_time', 'zoom_link'])
    expect(p.unknown).toEqual([])
  })

  test('is fine when the session is pinned', () => {
    expect(mergeProblems(['{{zoom_link}}'], true)).toEqual({ unknown: [], needsSession: [] })
  })

  test('ignores empty and missing text', () => {
    expect(mergeProblems([null, undefined, ''], false)).toEqual({ unknown: [], needsSession: [] })
  })
})

describe('button links cannot be turned into harmful links', () => {
  test('a saved link may be a web address, a site path, or exactly one link field', () => {
    expect(isAllowedCtaTemplate('https://zoom.us/j/1')).toBe(true)
    expect(isAllowedCtaTemplate('/phases/a/modules/b/items/c')).toBe(true)
    expect(isAllowedCtaTemplate('{{zoom_link}}')).toBe(true)
    expect(isAllowedCtaTemplate('{{ portal_link }}')).toBe(true)
  })

  test('name fields, mixed text, other schemes and protocol-relative links are refused', () => {
    expect(isAllowedCtaTemplate('{{full_name}}')).toBe(false)
    expect(isAllowedCtaTemplate('{{first_name}}:alert(1)')).toBe(false)
    expect(isAllowedCtaTemplate('{{zoom_link}}x')).toBe(false)
    expect(isAllowedCtaTemplate('javascript:alert(1)')).toBe(false)
    expect(isAllowedCtaTemplate('//evil.example/x')).toBe(false)
  })

  test('after filling, only a web address or site path survives', () => {
    expect(safeCtaUrl('https://zoom.us/j/1')).toBe('https://zoom.us/j/1')
    expect(safeCtaUrl('/dashboard')).toBe('/dashboard')
    expect(safeCtaUrl('javascript:alert(1)')).toBeNull()
    expect(safeCtaUrl('data:text/html,x')).toBeNull()
    expect(safeCtaUrl('//evil.example/x')).toBeNull()
    expect(safeCtaUrl('')).toBeNull()
    expect(safeCtaUrl(null)).toBeNull()
  })
})

describe('helpers', () => {
  test('hasMergeFields', () => {
    expect(hasMergeFields('a', 'Hi {{first_name}}')).toBe(true)
    expect(hasMergeFields('a', null, undefined)).toBe(false)
  })

  test('sampleData fills every field for the preview', () => {
    const out = renderMerge('{{first_name}} {{program}} {{session_date}} {{zoom_link}}', sampleData())
    expect(out).not.toContain('{{')
    expect(out).toContain('Jane')
  })

  test('writesOwnGreeting only when a name field is used', () => {
    expect(writesOwnGreeting('Hi {{first_name}},\n\nSee you soon.')).toBe(true)
    expect(writesOwnGreeting('Join here: {{zoom_link}}')).toBe(false)
  })
})
