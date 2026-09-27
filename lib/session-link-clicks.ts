import { cookies } from 'next/headers'
import { getSessionUser } from '@/lib/auth-server'

/**
 * Per-login link-click ledger.
 *
 * The completion gate "the fellow must open the linked resource
 * before they can mark the lesson complete" is meant to be a fresh
 * action *every login session*, not a permanent flag on the user.
 *
 * Persisting clicks in `user_content_link_clicks` (Postgres) means
 * a fellow who opened the link last week sees the gate already
 * cleared on every future visit forever - which lets them skip the
 * link and go straight to "Mark complete" on a return visit. We
 * still write that table for audit/analytics, but the *gate*
 * itself reads from this short-lived ledger instead.
 *
 * Implementation: a single HttpOnly cookie carrying a JSON payload
 *
 *   {
 *     t: <Supabase auth.users.last_sign_in_at ISO timestamp>,
 *     i: [contentId, ...]
 *   }
 *
 * `last_sign_in_at` advances on every successful login, so a stale
 * payload from a previous session is detected by tag mismatch and
 * treated as empty. The cookie is purged-on-logout-style without
 * any explicit logout hook: the next login simply rewrites it.
 *
 * The list is capped at ~200 entries to stay safely under the 4KB
 * cookie limit even in worst-case URL-stuffing scenarios.
 */

const COOKIE_NAME = 'lc_clicks'
const MAX_CLICKS = 200
// Soft max-age: 12h. The tag check is the real gate, but a TTL
// keeps the cookie from sticking around forever on shared
// machines. 12h covers a typical workday session.
const COOKIE_MAX_AGE = 60 * 60 * 12

interface ClickPayload {
  t: string
  i: string[]
}

function parseCookie(value: string | undefined): ClickPayload | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      't' in parsed &&
      'i' in parsed &&
      typeof (parsed as ClickPayload).t === 'string' &&
      Array.isArray((parsed as ClickPayload).i)
    ) {
      const p = parsed as ClickPayload
      return {
        t: p.t,
        // Filter to strings + dedupe defensively.
        i: Array.from(new Set(p.i.filter((x) => typeof x === 'string'))),
      }
    }
  } catch {
    // fall through
  }
  return null
}

/**
 * Returns the current login session's signature - the JWT's
 * `session_id`, which Supabase issues fresh on every sign-in. Used to
 * tag the click cookie so a logout/login round-trip auto-invalidates
 * the previous session's ledger. Read from verified claims, so it
 * costs no Auth round-trip.
 *
 * Returns null when there is no signed-in user.
 */
async function getSessionTag(): Promise<string | null> {
  const user = await getSessionUser()
  if (!user) return null
  // Fall back to the user id so the tag is at least stable per-user.
  return user.sessionId ?? user.id
}

/**
 * Read the session-scoped click ledger. Returns an empty set when
 * the cookie is missing, malformed, or tagged for a previous login
 * session.
 */
export async function readSessionLinkClicks(): Promise<Set<string>> {
  const tag = await getSessionTag()
  if (!tag) return new Set()
  const jar = await cookies()
  const payload = parseCookie(jar.get(COOKIE_NAME)?.value)
  if (!payload || payload.t !== tag) return new Set()
  return new Set(payload.i)
}

/** Convenience: was this contentId clicked in the current session? */
export async function hasSessionLinkClick(contentId: string): Promise<boolean> {
  const ids = await readSessionLinkClicks()
  return ids.has(contentId)
}

/**
 * Append `contentId` to the current session's click ledger. Safe to
 * call multiple times. Must be invoked from a Server Action or
 * Route Handler (mutating cookies is forbidden in plain Server
 * Components).
 */
export async function recordSessionLinkClick(contentId: string): Promise<void> {
  const tag = await getSessionTag()
  if (!tag || !contentId) return
  const jar = await cookies()
  const existing = parseCookie(jar.get(COOKIE_NAME)?.value)
  // Re-tag (and drop the old payload) when the session has rotated.
  const ids =
    existing && existing.t === tag ? new Set(existing.i) : new Set<string>()
  ids.add(contentId)

  // Cap the list so the cookie stays well under 4KB. We keep the
  // most-recent entries by inserting at the tail of an array.
  let ordered = Array.from(ids)
  if (ordered.length > MAX_CLICKS) {
    ordered = ordered.slice(ordered.length - MAX_CLICKS)
  }

  const payload: ClickPayload = { t: tag, i: ordered }
  jar.set({
    name: COOKIE_NAME,
    value: JSON.stringify(payload),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}
