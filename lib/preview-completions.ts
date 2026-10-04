import { cookies } from 'next/headers'
import type { CurrentUser } from '@/lib/user-context'

/**
 * Completions and reflections made while an admin previews the fellow
 * experience.
 *
 * Preview never writes to user_content_completions or
 * user_content_reflections (the cohort-preview user isn't real, and a
 * by-fellow preview mustn't touch the fellow's data). To still let the
 * admin walk the module sequence through the same completion gates a
 * fellow meets, toggles and accepted reflections are kept in this
 * cookie and overlaid on the real state. setPreviewCookie /
 * clearPreviewCookie wipe it, so every preview starts from the
 * previewed fellow's real state.
 *
 * Payload: { t: <preview tag>, d: { <contentId>: true | false }, r: [<contentId>] }
 * `r` lists items whose reflection passed validation in preview. Only
 * ids are kept (reflection text would blow the 4KB cookie limit).
 */

export const PREVIEW_COMPLETIONS_COOKIE = 'wfp_preview_done'

const MAX_ENTRIES = 150

interface Payload {
  t: string
  d: Record<string, boolean>
  r: string[]
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
    const r = Array.isArray(p.r) ? p.r.filter((x): x is string => typeof x === 'string') : []
    return { t: p.t, d, r }
  } catch {
    return null
  }
}

/** The current preview's payload, or null outside preview / for another preview. */
async function readPayload(user: CurrentUser): Promise<Payload | null> {
  const tag = previewTag(user)
  if (!tag) return null
  const payload = parse((await cookies()).get(PREVIEW_COMPLETIONS_COOKIE)?.value)
  return payload && payload.t === tag ? payload : null
}

/** Rewrite the payload for `user`'s preview. Server Actions / Route Handlers only. */
async function updatePayload(user: CurrentUser, change: (p: Payload) => void): Promise<void> {
  const tag = previewTag(user)
  if (!tag) return
  const p = (await readPayload(user)) ?? { t: tag, d: {}, r: [] }
  change(p)
  // Trimming keeps the most recent entries (insertion order).
  p.d = Object.fromEntries(Object.entries(p.d).slice(-MAX_ENTRIES))
  p.r = p.r.slice(-MAX_ENTRIES)
  ;(await cookies()).set(PREVIEW_COMPLETIONS_COOKIE, JSON.stringify(p), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // matches the preview cookie
  })
}

/** Preview overrides for `user`: contentId -> completed. Empty outside preview. */
export async function readPreviewCompletions(
  user: CurrentUser,
): Promise<Map<string, boolean>> {
  return new Map(Object.entries((await readPayload(user))?.d ?? {}))
}

/** Items whose reflection was accepted (not saved) in this preview. Empty outside preview. */
export async function readPreviewReflections(user: CurrentUser): Promise<Set<string>> {
  return new Set((await readPayload(user))?.r ?? [])
}

/** Record a preview toggle. Server Actions / Route Handlers only. */
export async function setPreviewCompletion(
  user: CurrentUser,
  contentId: string,
  completed: boolean,
): Promise<void> {
  if (!contentId) return
  await updatePayload(user, (p) => {
    delete p.d[contentId] // re-insert at the end so trimming keeps recent ones
    p.d[contentId] = completed
  })
}

/** Record (or drop) an accepted preview reflection. Server Actions / Route Handlers only. */
export async function setPreviewReflection(
  user: CurrentUser,
  contentId: string,
  accepted: boolean,
): Promise<void> {
  if (!contentId) return
  await updatePayload(user, (p) => {
    p.r = p.r.filter((id) => id !== contentId)
    if (accepted) p.r.push(contentId)
  })
}
