/**
 * Merge fields for notifications and their emails: the author writes
 * `Hi {{first_name}}, ... join here: {{zoom_link}}` once, and each
 * recipient gets their own values filled in when it sends. Drafts keep the
 * `{{...}}` text, so they stay editable until they go out.
 *
 * Pure: no database or framework imports, so the admin dialog (client) and
 * the sender (server) share the same rules.
 */

export const MERGE_FIELDS = [
  { key: 'first_name', label: 'First name', sample: 'Jane', needsSession: false },
  { key: 'full_name', label: 'Full name', sample: 'Jane Doe', needsSession: false },
  { key: 'program', label: 'Program', sample: 'Wisdom Coaching', needsSession: false },
  { key: 'portal_link', label: 'Portal link', sample: 'https://your-portal/dashboard', needsSession: false },
  { key: 'session_name', label: 'Session name', sample: 'Wisdom Coaching Module Three', needsSession: true },
  { key: 'session_date', label: 'Session date', sample: 'Wednesday, December 2', needsSession: true },
  { key: 'session_time', label: 'Session time', sample: '2:00 PM ET', needsSession: true },
  { key: 'zoom_link', label: 'Zoom link', sample: 'https://zoom.us/j/123456789', needsSession: true },
] as const

export type MergeKey = (typeof MERGE_FIELDS)[number]['key']
export type MergeData = Partial<Record<MergeKey, string | null>>

const KEYS: ReadonlySet<string> = new Set(MERGE_FIELDS.map((f) => f.key))
const NEEDS_SESSION: ReadonlySet<string> = new Set(MERGE_FIELDS.filter((f) => f.needsSession).map((f) => f.key))

/** `{{ first_name }}`, case-insensitive, spaces allowed. */
const FIELD_RE = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g

/** Whether the text contains any `{{...}}` at all (cheap check before doing work). */
export function hasMergeFields(...texts: Array<string | null | undefined>): boolean {
  return texts.some((t) => !!t && t.includes('{{'))
}

/**
 * Fill the known fields. A known field with no value becomes empty; an
 * unknown one (a typo like `{{firstname}}`) is left as written so it is
 * noticed rather than silently dropped.
 */
export function renderMerge(text: string, data: MergeData): string {
  return text.replace(FIELD_RE, (whole, raw: string) => {
    const key = raw.toLowerCase()
    if (!KEYS.has(key)) return whole
    return data[key as MergeKey] ?? ''
  })
}

/** Sample values, for the admin preview. */
export function sampleData(): MergeData {
  return Object.fromEntries(MERGE_FIELDS.map((f) => [f.key, f.sample])) as MergeData
}

export type MergeProblems = {
  /** Field names that are not real fields (typos). */
  unknown: string[]
  /** Session fields used with no curriculum item pinned, so they would be blank. */
  needsSession: string[]
}

export function mergeProblems(texts: Array<string | null | undefined>, hasSession: boolean): MergeProblems {
  const unknown = new Set<string>()
  const needsSession = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const m of text.matchAll(FIELD_RE)) {
      const key = m[1].toLowerCase()
      if (!KEYS.has(key)) unknown.add(m[1])
      else if (NEEDS_SESSION.has(key) && !hasSession) needsSession.add(key)
    }
  }
  return { unknown: [...unknown], needsSession: [...needsSession] }
}

/** A button link that is exactly one link field and nothing else (the only merge use allowed in a URL). */
export const LINK_FIELD_ONLY = /^\{\{\s*(zoom_link|portal_link)\s*\}\}$/i

/** What a button link may be before filling: a web address, a site path, or exactly one link field. */
export function isAllowedCtaTemplate(url: string): boolean {
  return /^(https?:\/\/|\/(?!\/))/i.test(url) || LINK_FIELD_ONLY.test(url.trim())
}

/**
 * A button link after filling merge fields: kept only if it is a real web
 * address or a site path (not `//host`, `javascript:` or anything else),
 * so a name or other field can never turn it into a harmful link.
 */
export function safeCtaUrl(url: string | null | undefined): string | null {
  const u = (url ?? '').trim()
  return /^(https?:\/\/|\/(?!\/))/i.test(u) ? u : null
}

/** True when the author wrote their own greeting with a name field, so none should be added. */
export function writesOwnGreeting(body: string): boolean {
  return /\{\{\s*(first_name|full_name)\s*\}\}/i.test(body)
}
