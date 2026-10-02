'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { deriveCoverFromUrl } from '@/lib/library/derive-cover'
import { isStoredFileUrl } from '@/lib/stored-files'

/**
 * Result envelope used by every Library mutation. Returning a plain
 * object (instead of throwing) lets the client form surface the
 * error inline without crashing the page.
 */
export type LibraryActionResult =
  | { ok: true }
  | { ok: false; message: string }

/** Allowed values must mirror the CHECK constraint on the column. */
const VALID_TYPES = new Set(['document', 'video', 'link', 'reading'])
/** Canonical cohort labels accepted by the visibility multi-select. */
const VALID_COHORTS = new Set(['A', 'B', 'C'])

/** Absolute URL, or an in-app link to a file in our own bucket. */
function isValidResourceUrl(url: string): boolean {
  if (isStoredFileUrl(url)) return true
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

const MAX_TITLE_LEN = 200
const MAX_DESC_LEN = 1_000
const MAX_TAGS = 8
const MAX_TAG_LEN = 32
/** Author attribution. Generous upper bound so a multi-author byline
 *  ("Smith, Jones & Wagner") still fits without truncation. */
const MAX_AUTHOR_LEN = 200
/** Cover image guard rails. 5 MB is plenty for a card hero. */
const MAX_COVER_BYTES = 5 * 1024 * 1024
const COVER_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

/**
 * Add a resource to the shared Library. Admin / facilitator only.
 *
 * Visibility model:
 *  - `isUniversal=true` -> rendered on the "Recommended Resources" tab,
 *    visible to every authenticated user. Cohort labels are still
 *    accepted on the wire (for future filtering), but stored as the
 *    full A/B/C set so RLS / non-cumulative consumers don't accidentally
 *    hide the row.
 *  - `isUniversal=false` -> "My Resources" tab, cohort-gated using
 *    strict assignment (fellowCanAccess): a fellow only sees resources
 *    explicitly assigned to their cohort.
 *
 * URL-only for the first cut. File upload via Vercel Blob is the
 * natural follow-up; when wired, it'll PUT the blob and pass the
 * resulting URL into this action - no schema changes required.
 */
export async function addLibraryResource(
  input: {
    title: string
    /**
     * Display attribution (book author, video creator, etc.). Required
     * by the admin form; surfaced on every resource card and list row
     * so fellows know whose work they're about to read/watch.
     */
    author: string
    description?: string | null
    url: string
    resourceType: string
    tags?: string[]
    isUniversal?: boolean
    cohorts?: string[]
    /**
     * Optional cover image. Sent from the client as a File via
     * FormData. Validated for type + size, then uploaded to the
     * `resource-covers` bucket and the public URL is persisted on
     * the new row's `cover_url` column.
     */
    coverFile?: File | null
  },
): Promise<LibraryActionResult> {
  try {
    const user = await requireUser()
    if (user.role !== 'admin' && user.role !== 'facilitator') {
      return { ok: false, message: 'You do not have permission to add resources.' }
    }

    const title = (input.title ?? '').trim()
    const author = (input.author ?? '').trim()
    const description = (input.description ?? '').trim() || null
    const url = (input.url ?? '').trim()
    const resourceType = (input.resourceType ?? '').trim()

    if (!title) return { ok: false, message: 'Title is required.' }
    if (title.length > MAX_TITLE_LEN) {
      return { ok: false, message: `Title must be ${MAX_TITLE_LEN} characters or fewer.` }
    }
    // Author is required at the app layer. The DB column is nullable
    // (legacy rows) but every new/edited row must carry attribution.
    if (!author) return { ok: false, message: 'Author is required.' }
    if (author.length > MAX_AUTHOR_LEN) {
      return { ok: false, message: `Author must be ${MAX_AUTHOR_LEN} characters or fewer.` }
    }
    if (description && description.length > MAX_DESC_LEN) {
      return { ok: false, message: `Description must be ${MAX_DESC_LEN} characters or fewer.` }
    }
    if (!url) return { ok: false, message: 'URL is required.' }
    // Lightweight URL sanity check. We don't require http/https here
    // because facilitators may legitimately link to internal LMS
    // schemes - but we do reject obvious garbage.
    if (!isValidResourceUrl(url)) {
      return { ok: false, message: 'URL must be a valid web address.' }
    }
    if (!VALID_TYPES.has(resourceType)) {
      return { ok: false, message: 'Resource type is invalid.' }
    }

    // Tag hygiene: trim, dedupe (case-insensitive), drop empties,
    // cap length and count. Stored verbatim (no lowercasing) so the
    // facilitator's casing is preserved on display.
    const seen = new Set<string>()
    const tags: string[] = []
    for (const raw of input.tags ?? []) {
      const t = (raw ?? '').trim()
      if (!t) continue
      if (t.length > MAX_TAG_LEN) {
        return { ok: false, message: `Tag "${t.slice(0, 16)}..." is too long.` }
      }
      const key = t.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      tags.push(t)
      if (tags.length >= MAX_TAGS) break
    }

    const isUniversal = input.isUniversal === true

    // Cohort assignment: universal rows always store the full A/B/C
    // set so any consumer that bypasses the `is_universal` flag (e.g.
    // RLS policies) still allows them through. Cohort-gated rows
    // require at least one valid label; we dedupe and clamp to the
    // canonical A/B/C set.
    let cohorts: string[]
    if (isUniversal) {
      cohorts = ['A', 'B', 'C']
    } else {
      const seenC = new Set<string>()
      const cleaned: string[] = []
      for (const raw of input.cohorts ?? []) {
        const label = (raw ?? '').trim().toUpperCase()
        if (!VALID_COHORTS.has(label)) continue
        if (seenC.has(label)) continue
        seenC.add(label)
        cleaned.push(label)
      }
      if (cleaned.length === 0) {
        return {
          ok: false,
          message: 'Select at least one cohort or mark this as Recommended Resources.',
        }
      }
      cohorts = cleaned
    }

    const supabase = await createClient()

    // Optional cover image. Validate, upload to the `resource-covers`
    // bucket, then persist the resulting public URL alongside the
    // row. We upload BEFORE insert so a failed upload surfaces a
    // user-visible error instead of leaving an orphan row pointing
    // at nothing.
    let coverUrl: string | null = null
    const cover = input.coverFile
    if (cover && typeof cover === 'object' && cover.size > 0) {
      if (!COVER_MIME_TYPES.has(cover.type)) {
        return {
          ok: false,
          message: 'Cover image must be a PNG, JPEG, WebP, or GIF.',
        }
      }
      if (cover.size > MAX_COVER_BYTES) {
        return {
          ok: false,
          message: 'Cover image must be 5 MB or smaller.',
        }
      }
      // Filename: <userId>/<timestamp>-<random>.<ext>. Folder is the
      // uploader's auth uid so the storage RLS policy (which scopes
      // writes to the caller's own folder) is satisfied. The
      // timestamp + random suffix stops two simultaneous uploads
      // from clobbering each other.
      const ext =
        cover.type === 'image/png'
          ? 'png'
          : cover.type === 'image/webp'
            ? 'webp'
            : cover.type === 'image/gif'
              ? 'gif'
              : 'jpg'
      const path = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}.${ext}`

      const upload = await supabase.storage
        .from('resource-covers')
        .upload(path, cover, {
          contentType: cover.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (upload.error) {
        return {
          ok: false,
          message: `Cover upload failed: ${upload.error.message}`,
        }
      }
      const { data: publicData } = supabase.storage
        .from('resource-covers')
        .getPublicUrl(upload.data.path)
      coverUrl = publicData.publicUrl
    } else {
      // No manual upload - try to derive a cover from the resource
      // URL itself (YouTube thumbnail or og:image). This is purely
      // opportunistic: a null result just means "no cover", which
      // the card handles by falling back to a type icon. We never
      // surface a derivation error to the admin because they have
      // already filled in the form correctly; auto-cover is a
      // courtesy, not a requirement.
      console.log('[v0] addLibraryResource: deriving cover', { url })
      coverUrl = await deriveCoverFromUrl(url)
      console.log('[v0] addLibraryResource: derived', { url, coverUrl })
    }

    const { error } = await supabase.from('community_resources').insert({
      title,
      author,
      description,
      url,
      resource_type: resourceType,
      tags,
      cohorts,
      is_universal: isUniversal,
      cover_url: coverUrl,
    })
    if (error) {
      // Best-effort cleanup: if we uploaded a cover but the row
      // insert failed, drop the orphan blob so the bucket doesn't
      // accumulate dead images.
      if (coverUrl) {
        const path = coverUrl.split('/resource-covers/')[1]
        if (path) {
          await supabase.storage.from('resource-covers').remove([path])
        }
      }
      return { ok: false, message: error.message }
    }

    revalidatePath('/resources')
    revalidatePath('/admin/library')
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}

/**
 * Internal helper: derive the storage object path that belongs to a
 * cover-image public URL so we can clean it up on replace / delete.
 *
 * Public URLs from Supabase Storage end in
 * `.../object/public/resource-covers/<userId>/<filename>` -
 * everything after `/resource-covers/` is the bucket-relative key.
 * Returns null when the URL doesn't look like one of ours so callers
 * never accidentally delete an unrelated object.
 */
function coverPathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = '/resource-covers/'
  const i = url.indexOf(marker)
  if (i === -1) return null
  const path = url.slice(i + marker.length).split('?')[0]
  return path.length > 0 ? path : null
}

/**
 * Edit an existing Library resource. Admin / facilitator only.
 *
 * Mirrors `addLibraryResource` for validation + visibility rules and
 * adds a small cover-image state machine so the editor can:
 *   - keep the existing cover (no file picked, removeCover=false),
 *   - replace it with a new upload (file picked) - the previous blob
 *     is deleted on success,
 *   - clear it back to no cover (removeCover=true) - the previous
 *     blob is deleted, `cover_url` becomes NULL.
 *
 * The DB row is loaded once up front so we know the prior cover path
 * (for cleanup) and so the action stays a single round trip on the
 * happy path even when the cover hasn't changed.
 */
export async function updateLibraryResource(
  id: string,
  input: {
    title: string
    /**
     * Display attribution. Required by the admin form (mirrors
     * `addLibraryResource`); the column is nullable in the DB only
     * to keep legacy rows valid.
     */
    author: string
    description?: string | null
    url: string
    resourceType: string
    tags?: string[]
    isUniversal?: boolean
    cohorts?: string[]
    coverFile?: File | null
    /** If true, drop the existing cover image (overrides coverFile). */
    removeCover?: boolean
  },
): Promise<LibraryActionResult> {
  try {
    const user = await requireUser()
    if (user.role !== 'admin' && user.role !== 'facilitator') {
      return { ok: false, message: 'You do not have permission to edit resources.' }
    }
    if (!id || typeof id !== 'string') {
      return { ok: false, message: 'Resource id is required.' }
    }

    const title = (input.title ?? '').trim()
    const author = (input.author ?? '').trim()
    const description = (input.description ?? '').trim() || null
    const url = (input.url ?? '').trim()
    const resourceType = (input.resourceType ?? '').trim()

    if (!title) return { ok: false, message: 'Title is required.' }
    if (title.length > MAX_TITLE_LEN) {
      return { ok: false, message: `Title must be ${MAX_TITLE_LEN} characters or fewer.` }
    }
    if (!author) return { ok: false, message: 'Author is required.' }
    if (author.length > MAX_AUTHOR_LEN) {
      return { ok: false, message: `Author must be ${MAX_AUTHOR_LEN} characters or fewer.` }
    }
    if (description && description.length > MAX_DESC_LEN) {
      return { ok: false, message: `Description must be ${MAX_DESC_LEN} characters or fewer.` }
    }
    if (!url) return { ok: false, message: 'URL is required.' }
    if (!isValidResourceUrl(url)) {
      return { ok: false, message: 'URL must be a valid web address.' }
    }
    if (!VALID_TYPES.has(resourceType)) {
      return { ok: false, message: 'Resource type is invalid.' }
    }

    const seen = new Set<string>()
    const tags: string[] = []
    for (const raw of input.tags ?? []) {
      const t = (raw ?? '').trim()
      if (!t) continue
      if (t.length > MAX_TAG_LEN) {
        return { ok: false, message: `Tag "${t.slice(0, 16)}..." is too long.` }
      }
      const key = t.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      tags.push(t)
      if (tags.length >= MAX_TAGS) break
    }

    const isUniversal = input.isUniversal === true
    let cohorts: string[]
    if (isUniversal) {
      cohorts = ['A', 'B', 'C']
    } else {
      const seenC = new Set<string>()
      const cleaned: string[] = []
      for (const raw of input.cohorts ?? []) {
        const label = (raw ?? '').trim().toUpperCase()
        if (!VALID_COHORTS.has(label)) continue
        if (seenC.has(label)) continue
        seenC.add(label)
        cleaned.push(label)
      }
      if (cleaned.length === 0) {
        return {
          ok: false,
          message: 'Select at least one cohort or mark this as Recommended Resources.',
        }
      }
      cohorts = cleaned
    }

    const supabase = await createClient()

    // Load the prior row so we know the existing cover path. We
    // also use this read as an existence check - bail with a clean
    // message if the row was already deleted in a parallel session.
    const { data: prior, error: priorErr } = await supabase
      .from('community_resources')
      .select('id, cover_url')
      .eq('id', id)
      .maybeSingle<{ id: string; cover_url: string | null }>()
    if (priorErr) return { ok: false, message: priorErr.message }
    if (!prior) {
      return { ok: false, message: 'This resource no longer exists.' }
    }

    // Cover-image state machine. Four paths:
    //   1. New file uploaded -> upload, set cover_url to the new
    //      public URL, schedule the prior blob for cleanup.
    //   2. removeCover -> set cover_url to NULL, schedule prior
    //      blob for cleanup.
    //   3. No upload, no removal, no current cover -> opportunistic
    //      auto-derivation from the resource URL. Lets edits "fill
    //      in" a cover for legacy rows or rows whose original
    //      derivation failed (e.g. URL has since been corrected).
    //   4. Otherwise -> leave cover_url untouched. Manually picked
    //      covers are sacred; we never silently overwrite them.
    let nextCoverUrl: string | null | undefined
    let priorCoverPathToDelete: string | null = null

    const cover = input.coverFile
    if (cover && typeof cover === 'object' && cover.size > 0) {
      if (!COVER_MIME_TYPES.has(cover.type)) {
        return {
          ok: false,
          message: 'Cover image must be a PNG, JPEG, WebP, or GIF.',
        }
      }
      if (cover.size > MAX_COVER_BYTES) {
        return {
          ok: false,
          message: 'Cover image must be 5 MB or smaller.',
        }
      }
      const ext =
        cover.type === 'image/png'
          ? 'png'
          : cover.type === 'image/webp'
            ? 'webp'
            : cover.type === 'image/gif'
              ? 'gif'
              : 'jpg'
      const path = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}.${ext}`
      const upload = await supabase.storage
        .from('resource-covers')
        .upload(path, cover, {
          contentType: cover.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (upload.error) {
        return {
          ok: false,
          message: `Cover upload failed: ${upload.error.message}`,
        }
      }
      const { data: publicData } = supabase.storage
        .from('resource-covers')
        .getPublicUrl(upload.data.path)
      nextCoverUrl = publicData.publicUrl
      priorCoverPathToDelete = coverPathFromUrl(prior.cover_url)
    } else if (input.removeCover === true) {
      nextCoverUrl = null
      priorCoverPathToDelete = coverPathFromUrl(prior.cover_url)
    } else if (!prior.cover_url) {
      // Path 3: row has no cover today. Try to derive one from the
      // current URL on save. If the URL hasn't changed and the
      // last derivation already failed we'll just get null again,
      // which is harmless; if the URL has been fixed up since the
      // first save, this is where the auto-cover finally lands.
      console.log('[v0] updateLibraryResource: deriving cover', { id, url })
      const derived = await deriveCoverFromUrl(url)
      console.log('[v0] updateLibraryResource: derived', { id, url, derived })
      if (derived) nextCoverUrl = derived
    }

    const updatePayload: Record<string, unknown> = {
      title,
      author,
      description,
      url,
      resource_type: resourceType,
      tags,
      cohorts,
      is_universal: isUniversal,
    }
    if (nextCoverUrl !== undefined) {
      updatePayload.cover_url = nextCoverUrl
    }

    const { error } = await supabase
      .from('community_resources')
      .update(updatePayload)
      .eq('id', id)

    if (error) {
      // Clean up the just-uploaded blob if the update failed - we
      // never want orphan blobs left in the bucket.
      if (nextCoverUrl) {
        const newPath = coverPathFromUrl(nextCoverUrl)
        if (newPath) {
          await supabase.storage.from('resource-covers').remove([newPath])
        }
      }
      return { ok: false, message: error.message }
    }

    // Best-effort cleanup of the prior cover. We don't surface a
    // cleanup failure to the user - the row is already updated and
    // a leftover blob is recoverable.
    if (priorCoverPathToDelete) {
      await supabase.storage.from('resource-covers').remove([priorCoverPathToDelete])
    }

    revalidatePath('/resources')
    revalidatePath('/admin/library')
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}

/**
 * Permanently delete a Library resource. Admin / facilitator only.
 *
 * Cleans up the cover blob in storage too so we don't leak files
 * into `resource-covers`. Storage cleanup is best-effort - the row
 * deletion is the source of truth and a leftover blob is recoverable.
 */
export async function deleteLibraryResource(
  id: string,
): Promise<LibraryActionResult> {
  try {
    const user = await requireUser()
    if (user.role !== 'admin' && user.role !== 'facilitator') {
      return { ok: false, message: 'You do not have permission to delete resources.' }
    }
    if (!id || typeof id !== 'string') {
      return { ok: false, message: 'Resource id is required.' }
    }

    const supabase = await createClient()

    // Read the cover URL up front so we can drop the blob after the
    // row delete succeeds. We don't bail when this read fails - the
    // delete is the important part.
    const { data: prior } = await supabase
      .from('community_resources')
      .select('cover_url')
      .eq('id', id)
      .maybeSingle<{ cover_url: string | null }>()

    const { error } = await supabase
      .from('community_resources')
      .delete()
      .eq('id', id)

    if (error) return { ok: false, message: error.message }

    const path = coverPathFromUrl(prior?.cover_url ?? null)
    if (path) {
      await supabase.storage.from('resource-covers').remove([path])
    }

    revalidatePath('/resources')
    revalidatePath('/admin/library')
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}
