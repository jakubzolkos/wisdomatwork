import { cookies } from 'next/headers'
import type { CurrentUser } from '@/lib/user-context'

/**
 * Completions made while an admin previews the fellow experience.
 *
 * Preview never writes to user_content_completions (the cohort-preview
 * user isn't real, and a by-fellow preview mustn't touch the fellow's
 * data). To still let the admin walk the module sequence and watch
 * modules unlock, toggles are kept in this cookie and overlaid on the
 * real completion set. setPreviewCookie / clearPreviewCookie wipe it,
 * so every preview starts from the previewed fellow's real state.
 *
 * Payload: { t: <preview tag>, d: { <contentId>: true | false } }
 */

export const PREVIEW_COMPLETIONS_COOKIE = 'wfp_preview_done'

const MAX_ENTRIES = 150

interface Payload {
  t: string
  d: Record<string, boolean>
}

function previewTag(user: CurrentUser): string | null {
  if (!user.preview) return null
  return `${user.preview.mode}:${user.id}`
}

function parse(raw: string | undefined): Payload | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<Payload>
    if (typeof p.t !== 'string' || !p.d || typeof p.d !== 'object') return null
    const d: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(p.d)) if (typeof v === 'boolean') d[k] = v
    return { t: p.t, d }
  } catch {
    return null
  }
}

/** Preview overrides for `user`: contentId -> completed. Empty outside preview. */
export async function readPreviewCompletions(
  user: CurrentUser,
): Promise<Map<string, boolean>> {
  const tag = previewTag(user)
  if (!tag) return new Map()
  const payload = parse((await cookies()).get(PREVIEW_COMPLETIONS_COOKIE)?.value)
  if (!payload || payload.t !== tag) return new Map()
  return new Map(Object.entries(payload.d))
}

/** Record a preview toggle. Server Actions / Route Handlers only. */
export async function setPreviewCompletion(
  user: CurrentUser,
  contentId: string,
  completed: boolean,
): Promise<void> {
  const tag = previewTag(user)
  if (!tag || !contentId) return
  const jar = await cookies()
  const existing = parse(jar.get(PREVIEW_COMPLETIONS_COOKIE)?.value)
  const entries = existing && existing.t === tag ? Object.entries(existing.d) : []
  const d = new Map(entries)
  d.delete(contentId) // re-insert at the end so trimming keeps recent ones
  d.set(contentId, completed)
  const trimmed = Array.from(d).slice(-MAX_ENTRIES)
  jar.set(PREVIEW_COMPLETIONS_COOKIE, JSON.stringify({ t: tag, d: Object.fromEntries(trimmed) }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // matches the preview cookie
  })
}
