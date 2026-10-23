'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { COHORTS } from '@/lib/cohorts'
import { assertAdminArea } from '@/lib/admin-access-server'

/**
 * Pull the cohort selections out of a form. Mirrors the helper in
 * curriculum/actions.ts: empty array == open to every fellow.
 */
function readCohorts(formData: FormData, name = 'cohorts'): string[] {
  const raw = formData.getAll(name)
  const allowed = new Set(COHORTS as readonly string[])
  const out = new Set<string>()
  for (const v of raw) {
    if (typeof v === 'string' && allowed.has(v)) out.add(v)
  }
  return Array.from(out)
}

export type ActionResult = { ok: true; message: string } | { ok: false; message: string }
const ok = (message: string): ActionResult => ({ ok: true, message })
const fail = (message: string): ActionResult => ({ ok: false, message })

/**
 * All three write paths (events / posts / resources) revalidate both the
 * admin console and the public Community page so the new content shows
 * up the moment the dialog closes.
 */
function bust() {
  revalidatePath('/admin/community')
  revalidatePath('/community')
}

// ---------------------------------------------------------------------------
// EVENTS
// ---------------------------------------------------------------------------
export async function createEvent(formData: FormData): Promise<ActionResult> {
  try {
    const me = await assertAdminArea('comms')
    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    const startsAtRaw = String(formData.get('starts_at') ?? '').trim()
    const endsAtRaw = String(formData.get('ends_at') ?? '').trim()
    const location = String(formData.get('location') ?? '').trim() || null
    const joinUrl = String(formData.get('join_url') ?? '').trim() || null

    if (!title) return fail('Title is required')
    if (!startsAtRaw) return fail('Start date/time is required')

    const supabase = await createClient()
    const { error } = await supabase.from('community_events').insert({
      title,
      description,
      starts_at: new Date(startsAtRaw).toISOString(),
      ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
      location,
      join_url: joinUrl,
      created_by: me.id,
    })
    if (error) return fail(error.message)

    bust()
    return ok('Event created')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function deleteEvent(formData: FormData): Promise<ActionResult> {
  try {
    await assertAdminArea('comms')
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return fail('Missing event id')

    const supabase = await createClient()
    const { error } = await supabase.from('community_events').delete().eq('id', id)
    if (error) return fail(error.message)

    bust()
    return ok('Event deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

// ---------------------------------------------------------------------------
// POSTS (blog / podcast)
// ---------------------------------------------------------------------------
// The four section kinds users can post into from the admin console.
// Mirrors the public Community sidebar: announcement (What's New?),
// reflection (Fellow Reflections), win (Wins & Progress), question
// (Ask the Community). The DB CHECK constraint also accepts legacy
// `post` and `story` for backwards compatibility, but new admin
// creations always pick one of the four canonical kinds.
const ADMIN_POST_KINDS = new Set([
  'announcement',
  'reflection',
  'win',
  'question',
])

export async function createPost(formData: FormData): Promise<ActionResult> {
  try {
    const me = await assertAdminArea('comms')
    const kindRaw = String(formData.get('kind') ?? 'announcement')
    const kind = ADMIN_POST_KINDS.has(kindRaw) ? kindRaw : 'announcement'
    const title = String(formData.get('title') ?? '').trim()
    const excerpt = String(formData.get('excerpt') ?? '').trim() || null
    const body = String(formData.get('body') ?? '').trim() || null
    const mediaUrl = String(formData.get('media_url') ?? '').trim() || null
    const coverUrl = String(formData.get('cover_url') ?? '').trim() || null
    const publish = formData.get('publish') === 'on'

    if (!title) return fail('Title is required')

    const supabase = await createClient()
    const { error } = await supabase.from('community_posts').insert({
      kind,
      title,
      excerpt,
      body,
      media_url: mediaUrl,
      cover_url: coverUrl,
      published_at: publish ? new Date().toISOString() : null,
      created_by: me.id,
    })
    if (error) return fail(error.message)

    bust()
    return ok(publish ? 'Post published' : 'Draft saved')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function togglePostPublished(formData: FormData): Promise<ActionResult> {
  try {
    await assertAdminArea('comms')
    const id = String(formData.get('id') ?? '').trim()
    const publish = formData.get('publish') === 'true'
    if (!id) return fail('Missing post id')

    const supabase = await createClient()
    const { error } = await supabase
      .from('community_posts')
      .update({ published_at: publish ? new Date().toISOString() : null })
      .eq('id', id)
    if (error) return fail(error.message)

    bust()
    return ok(publish ? 'Published' : 'Unpublished')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function deletePost(formData: FormData): Promise<ActionResult> {
  try {
    await assertAdminArea('comms')
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return fail('Missing post id')

    const supabase = await createClient()
    const { error } = await supabase.from('community_posts').delete().eq('id', id)
    if (error) return fail(error.message)

    bust()
    return ok('Post deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

// ---------------------------------------------------------------------------
// RESOURCES (library links)
// ---------------------------------------------------------------------------
export async function createResource(formData: FormData): Promise<ActionResult> {
  try {
    const me = await assertAdminArea('comms')
    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    const url = String(formData.get('url') ?? '').trim()
    const category = String(formData.get('category') ?? '').trim() || null
    const cohorts = readCohorts(formData)

    if (!title) return fail('Title is required')
    if (!url) return fail('URL is required')
    try {
      new URL(url)
    } catch {
      return fail('URL must be a valid http(s) link')
    }

    const supabase = await createClient()
    const { error } = await supabase.from('community_resources').insert({
      title,
      description,
      url,
      category,
      cohorts,
      created_by: me.id,
    })
    if (error) return fail(error.message)

    bust()
    return ok('Resource added')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function deleteResource(formData: FormData): Promise<ActionResult> {
  try {
    await assertAdminArea('comms')
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return fail('Missing resource id')

    const supabase = await createClient()
    const { error } = await supabase.from('community_resources').delete().eq('id', id)
    if (error) return fail(error.message)

    bust()
    return ok('Resource deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
