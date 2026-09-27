import { cookies } from 'next/headers'
import { isCohort, type Cohort } from '@/lib/cohorts'

/**
 * "Preview as fellow" - a server-side impersonation feature exclusive
 * to admin accounts. The signed-in admin places a small JSON descriptor
 * in an HTTP-only cookie; whenever the auth helpers run, they detect
 * the cookie and substitute a synthesized fellow `CurrentUser` so the
 * rest of the app renders exactly what that fellow would see.
 *
 * Two preview modes:
 *   1. by_fellow  -> impersonate a real fellow profile (their cohort,
 *                    school team, completed labs, journal entries...).
 *   2. by_cohort  -> impersonate a generic, brand-new fellow in a given
 *                    cohort. No real progress, no real school. Useful
 *                    for verifying gating without depending on any one
 *                    fellow's state.
 *
 * Security model: the cookie itself is unsigned, but `getCurrentUser`
 * only honors it when the *real* authenticated user has role 'admin'.
 * If a non-admin somehow forges the cookie it is silently ignored.
 */

export const PREVIEW_COOKIE = 'wfp_preview'

export type PreviewState =
  | { type: 'by_fellow'; fellowId: string; referrer?: string }
  | { type: 'by_cohort'; cohort: Cohort; referrer?: string }

/**
 * Read and parse the preview descriptor from cookies. Returns null when
 * the cookie is absent or malformed. Does NOT verify the caller's role -
 * that check belongs at the call site (only honored for admins).
 */
export async function readPreviewCookie(): Promise<PreviewState | null> {
  const store = await cookies()
  const raw = store.get(PREVIEW_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PreviewState>
    // Only same-origin paths, so exiting preview can't redirect off-site.
    const referrer =
      typeof parsed.referrer === 'string' &&
      parsed.referrer.startsWith('/') &&
      !parsed.referrer.startsWith('//')
        ? parsed.referrer
        : undefined
    if (parsed.type === 'by_fellow' && typeof parsed.fellowId === 'string') {
      return { type: 'by_fellow', fellowId: parsed.fellowId, referrer }
    }
    if (parsed.type === 'by_cohort' && isCohort(parsed.cohort)) {
      return { type: 'by_cohort', cohort: parsed.cohort, referrer }
    }
    return null
  } catch {
    return null
  }
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  // Short-lived: 8 hours. Plenty for a QA session, brief enough that an
  // admin won't accidentally stay impersonated overnight.
  maxAge: 60 * 60 * 8,
} as const

export async function setPreviewCookie(state: PreviewState): Promise<void> {
  const store = await cookies()
  store.set(PREVIEW_COOKIE, JSON.stringify(state), COOKIE_OPTIONS)
}

export async function clearPreviewCookie(): Promise<void> {
  const store = await cookies()
  store.set(PREVIEW_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}
