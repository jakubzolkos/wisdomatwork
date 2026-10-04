'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-server'
import { COHORTS } from '@/lib/cohorts'
import { STORED_FILES_BUCKET, isStoredFileUrl, storedFileUrl } from '@/lib/stored-files'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isContentCategory,
  isResourceType,
  type ContentCategory,
  type ResourceType,
} from '@/lib/curriculum'

// ============================================================================
// Helpers
// ============================================================================

export type ActionResult = { ok: true; message: string } | { ok: false; message: string }

const ok = (message: string): ActionResult => ({ ok: true, message })
const fail = (message: string): ActionResult => ({ ok: false, message })

const trim = (v: FormDataEntryValue | null) =>
  typeof v === 'string' ? v.trim() : ''

const nullable = (v: FormDataEntryValue | null) => {
  const s = trim(v)
  return s.length === 0 ? null : s
}

/**
 * Read explicit cohort selections from a form. The CohortAccessField
 * component submits one entry per ticked cohort, so an empty array
 * means "no cohorts ticked" (= explicitly locked).
 */
function readCohortSelections(formData: FormData, name = 'cohorts'): string[] {
  const raw = formData.getAll(name)
  const allowed = new Set(COHORTS as readonly string[])
  const out = new Set<string>()
  for (const v of raw) if (typeof v === 'string' && allowed.has(v)) out.add(v)
  return Array.from(out)
}

/**
 * Read cohort access for a child entity (module or content) that
 * supports inheriting from its parent. The form must include a
 * `cohorts_inherit` checkbox:
 *
 *   inherit=on        -> NULL (entity inherits from parent)
 *   inherit absent    -> array of ticked cohorts (may be [] = locked)
 */
function readInheritableCohorts(formData: FormData): string[] | null {
  if (trim(formData.get('cohorts_inherit')) === 'on') return null
  return readCohortSelections(formData)
}

// ============================================================================
// Phases (table: years)
// ============================================================================

export async function createPhase(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const title = trim(formData.get('title'))
    const description = nullable(formData.get('description'))
    const cohorts = readCohortSelections(formData)
    if (!title) return fail('Phase title is required')

    const supabase = await createClient()

    const { data: maxRow } = await supabase
      .from('years')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle<{ order_index: number }>()
    const nextIndex = (maxRow?.order_index ?? 0) + 1

    const { error } = await supabase
      .from('years')
      .insert({ title, description, cohorts, order_index: nextIndex })
    if (error) return fail(error.message)

    revalidatePath('/admin/curriculum')
    revalidatePath('/dashboard')
    return ok('Phase created')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function updatePhase(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = trim(formData.get('id'))
    const title = trim(formData.get('title'))
    const description = nullable(formData.get('description'))
    const cohorts = readCohortSelections(formData)
    if (!id) return fail('Missing phase id')
    if (!title) return fail('Phase title is required')

    const supabase = await createClient()
    const { error } = await supabase
      .from('years')
      .update({ title, description, cohorts })
      .eq('id', id)
    if (error) return fail(error.message)

    revalidatePath('/admin/curriculum')
    revalidatePath(`/admin/curriculum/${id}`)
    revalidatePath('/dashboard')
    revalidatePath(`/phases/${id}`)
    return ok('Phase updated')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function deletePhase(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = trim(formData.get('id'))
    if (!id) return fail('Missing phase id')

    const supabase = await createClient()
    // Cascade is set on modules.phase_id and labs.module_id, so deleting
    // the phase deletes every descendant module and content item.
    const { error } = await supabase.from('years').delete().eq('id', id)
    if (error) return fail(error.message)

    revalidatePath('/admin/curriculum')
    revalidatePath('/dashboard')
    return ok('Phase deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function reorderPhases(orderedIds: string[]): Promise<ActionResult> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from('years')
          .update({ order_index: 1000 + i })
          .eq('id', id),
      ),
    )
    const errors = await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from('years')
          .update({ order_index: i + 1 })
          .eq('id', id)
          .then((r) => r.error),
      ),
    )
    const firstError = errors.find(Boolean)
    if (firstError) return fail(firstError.message)

    revalidatePath('/admin/curriculum')
    revalidatePath('/dashboard')
    return ok('Phases reordered')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

// ============================================================================
// Modules (table: modules)
// ============================================================================

export async function createModule(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const phaseId = trim(formData.get('phase_id'))
    const title = trim(formData.get('title'))
    const description = nullable(formData.get('description'))
    const cohorts = readInheritableCohorts(formData)
    if (!phaseId) return fail('Missing phase id')
    if (!title) return fail('Module title is required')

    const supabase = await createClient()

    const { data: maxRow } = await supabase
      .from('modules')
      .select('order_index')
      .eq('phase_id', phaseId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle<{ order_index: number }>()
    const nextIndex = (maxRow?.order_index ?? 0) + 1

    const { error } = await supabase.from('modules').insert({
      phase_id: phaseId,
      title,
      description,
      cohorts,
      order_index: nextIndex,
    })
    if (error) return fail(error.message)

    revalidatePath(`/admin/curriculum/${phaseId}`)
    revalidatePath(`/phases/${phaseId}`)
    revalidatePath('/dashboard')
    return ok('Module created')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function updateModule(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = trim(formData.get('id'))
    const phaseId = trim(formData.get('phase_id'))
    const title = trim(formData.get('title'))
    const description = nullable(formData.get('description'))
    const cohorts = readInheritableCohorts(formData)
    const isSequential = formData.get('is_sequential') === 'on'
    const opensRaw = nullable(formData.get('opens_at'))
    const opensAt = opensRaw ? new Date(opensRaw) : null
    if (opensAt && Number.isNaN(opensAt.getTime())) return fail('Opening date is not a valid date')
    if (!id) return fail('Missing module id')
    if (!phaseId) return fail('Missing phase id')
    if (!title) return fail('Module title is required')

    const supabase = await createClient()
    const { error } = await supabase
      .from('modules')
      .update({
        title,
        description,
        cohorts,
        is_sequential: isSequential,
        opens_at: opensAt ? opensAt.toISOString() : null,
      })
      .eq('id', id)
    if (error) return fail(error.message)

    revalidatePath(`/admin/curriculum/${phaseId}`)
    revalidatePath(`/admin/curriculum/${phaseId}/modules/${id}`)
    revalidatePath(`/phases/${phaseId}`)
    revalidatePath(`/phases/${phaseId}/modules/${id}`)
    revalidatePath('/dashboard')
    return ok('Module updated')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function deleteModule(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = trim(formData.get('id'))
    const phaseId = trim(formData.get('phase_id'))
    if (!id) return fail('Missing module id')

    const supabase = await createClient()
    // Cascade on labs.module_id removes every content item under this module.
    const { error } = await supabase.from('modules').delete().eq('id', id)
    if (error) return fail(error.message)

    if (phaseId) {
      revalidatePath(`/admin/curriculum/${phaseId}`)
      revalidatePath(`/phases/${phaseId}`)
    }
    revalidatePath('/dashboard')
    return ok('Module deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function reorderModules(
  phaseId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    await requireAdmin()
    if (!phaseId) return fail('Missing phase id')
    const supabase = await createClient()

    await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from('modules')
          .update({ order_index: 10000 + i })
          .eq('id', id)
          .eq('phase_id', phaseId),
      ),
    )
    const errors = await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from('modules')
          .update({ order_index: i + 1 })
          .eq('id', id)
          .eq('phase_id', phaseId)
          .then((r) => r.error),
      ),
    )
    const firstError = errors.find(Boolean)
    if (firstError) return fail(firstError.message)

    revalidatePath(`/admin/curriculum/${phaseId}`)
    revalidatePath(`/phases/${phaseId}`)
    return ok('Modules reordered')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

// ============================================================================
// Content items (table: labs)
// ============================================================================

function assertCategory(v: string): asserts v is ContentCategory {
  if (!isContentCategory(v)) throw new Error(`Invalid category: ${v}`)
}
function assertResourceType(v: string): asserts v is ResourceType {
  if (!isResourceType(v)) throw new Error(`Invalid resource type: ${v}`)
}

interface ContentInputs {
  phaseId: string
  moduleId: string
  category: ContentCategory
  resourceType: ResourceType
  title: string
  description: string | null
  body: string | null
  url: string | null
  /**
   * Key of an uploaded PDF in the course-files bucket (uploaded by the
   * admin's browser). When set, `url` is ignored and the row's link is
   * the in-app viewer for the row's own id.
   */
  filePath: string | null
  durationMinutes: number | null
  reflectionEnabled: boolean
  reflectionPrompt: string | null
  /**
   * Wall-clock start time for live-session items, ISO 8601 (UTC).
   * NULL when the resource isn't a live session, or when the admin
   * hasn't scheduled it yet. Always NULL for non-live resource
   * types - the form clears it automatically when the type changes.
   */
  scheduledAt: string | null
  cohorts: string[] | null
}

function readContentInputs(formData: FormData): ContentInputs | string {
  const phaseId = trim(formData.get('phase_id'))
  const moduleId = trim(formData.get('module_id'))
  const category = trim(formData.get('category'))
  const resourceType = trim(formData.get('resource_type'))
  const title = trim(formData.get('title'))
  const description = nullable(formData.get('description'))
  const body = nullable(formData.get('body'))
  const url = nullable(formData.get('url'))
  const filePath =
    trim(formData.get('resource_type')) === 'live_session' ? null : nullable(formData.get('file_path'))
  const durationRaw = nullable(formData.get('duration_minutes'))
  const cohorts = readInheritableCohorts(formData)

  if (!phaseId) return 'Missing phase id'
  if (!moduleId) return 'Missing module id'
  if (!title) return 'Title is required'
  if (!category) return 'Pick a category'
  if (!resourceType) return 'Pick a resource type'
  try {
    assertCategory(category)
    assertResourceType(resourceType)
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid selection'
  }
  // Stored-file links are in-app paths; leave them alone so saving an
  // item that serves a bucket file doesn't fail validation.
  // Uploads land under labs/ (see StoredFileField); anything else isn't ours.
  if (filePath && (!/^labs\/[A-Za-z0-9._/-]+\.pdf$/.test(filePath) || filePath.includes('..'))) {
    return 'Invalid file. Upload the PDF again.'
  }
  if (!filePath && url && !/^https?:\/\//i.test(url) && !isStoredFileUrl(url)) {
    return 'URL must start with http:// or https://'
  }
  // Live sessions need somewhere to join - require the URL up-front so
  // fellows never land on a session page with nothing actionable.
  if (resourceType === 'live_session' && !url) {
    return 'Add a join link (Zoom, Google Meet, etc.) for live sessions'
  }

  let durationMinutes: number | null = null
  if (durationRaw !== null) {
    const n = Number(durationRaw)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return 'Duration must be a whole number of minutes (0 or more)'
    }
    durationMinutes = n
  }

  // Reflection gate. The toggle is a checkbox - "on" means required.
  // When required we MUST have a non-empty prompt or the fellow has
  // nothing to respond to.
  const reflectionEnabled = trim(formData.get('reflection_enabled')) === 'on'
  const reflectionPromptRaw = nullable(formData.get('reflection_prompt'))
  if (reflectionEnabled && !reflectionPromptRaw) {
    return 'Add a reflection prompt before requiring a reflection'
  }
  const reflectionPrompt = reflectionEnabled ? reflectionPromptRaw : null

  // Live-session schedule. The form converts the admin's local
  // datetime to a UTC ISO string client-side and submits it here.
  // We only persist it when the row is actually a live session; for
  // any other resource type we force NULL so a leftover schedule
  // can't survive a type change. Empty/blank means "not scheduled
  // yet" and the fellow UI falls back to the legacy Join button.
  let scheduledAt: string | null = null
  if (resourceType === 'live_session') {
    const raw = nullable(formData.get('scheduled_at'))
    if (raw !== null) {
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) {
        return 'Session date & time is not a valid datetime'
      }
      scheduledAt = d.toISOString()
    }
  }

  return {
    phaseId,
    moduleId,
    category: category as ContentCategory,
    resourceType: resourceType as ResourceType,
    title,
    description,
    body,
    url: filePath ? null : url,
    filePath,
    durationMinutes,
    reflectionEnabled,
    reflectionPrompt,
    scheduledAt,
    cohorts,
  }
}

/** Whether an uploaded object really exists before a row points at it. */
async function storedFileExists(filePath: string): Promise<boolean> {
  const slash = filePath.lastIndexOf('/')
  const { data } = await createAdminClient()
    .storage.from(STORED_FILES_BUCKET)
    .list(filePath.slice(0, slash), { search: filePath.slice(slash + 1), limit: 5 })
  return !!data?.some((o) => o.name === filePath.slice(slash + 1))
}

export async function createContent(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const parsed = readContentInputs(formData)
    if (typeof parsed === 'string') return fail(parsed)
    const supabase = await createClient()

    // Append within the (module, category) bucket. We keep `category`
    // in the ordering key so admins can reason about ordering even
    // though the fellow UI no longer surfaces categories.
    const { data: maxRow } = await supabase
      .from('labs')
      .select('order_index')
      .eq('module_id', parsed.moduleId)
      .eq('category', parsed.category)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle<{ order_index: number }>()
    const nextIndex = (maxRow?.order_index ?? 0) + 1

    if (parsed.filePath && !(await storedFileExists(parsed.filePath))) {
      return fail('The uploaded file was not found. Upload it again.')
    }
    // A file item links to the viewer for its own id, so pick the id now.
    const id = crypto.randomUUID()

    const { error } = await supabase.from('labs').insert({
      id,
      // year_id is kept as a denormalized convenience FK so phase-level
      // queries don't have to join through modules every time.
      year_id: parsed.phaseId,
      module_id: parsed.moduleId,
      category: parsed.category,
      resource_type: parsed.resourceType,
      title: parsed.title,
      description: parsed.description,
      body: parsed.body,
      url: parsed.filePath ? storedFileUrl('labs', id) : parsed.url,
      file_path: parsed.filePath,
      duration_minutes: parsed.durationMinutes,
      reflection_enabled: parsed.reflectionEnabled,
      reflection_prompt: parsed.reflectionPrompt,
      scheduled_at: parsed.scheduledAt,
      cohorts: parsed.cohorts,
      order_index: nextIndex,
    })
    if (error) return fail(error.message)

    revalidatePath(`/admin/curriculum/${parsed.phaseId}/modules/${parsed.moduleId}`)
    revalidatePath(`/admin/curriculum/${parsed.phaseId}`)
    revalidatePath(`/phases/${parsed.phaseId}/modules/${parsed.moduleId}`)
    revalidatePath(`/phases/${parsed.phaseId}`)
    return ok('Content added')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function updateContent(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = trim(formData.get('id'))
    if (!id) return fail('Missing content id')
    const parsed = readContentInputs(formData)
    if (typeof parsed === 'string') return fail(parsed)

    const supabase = await createClient()

    // If the admin changed the category, move the item to the tail
    // of the destination (module, category) bucket. order_index is
    // unique-by-bucket - reusing the old index would collide with an
    // existing item in the new bucket and produce ambiguous order.
    const { data: existing, error: fetchError } = await supabase
      .from('labs')
      .select('category')
      .eq('id', id)
      .maybeSingle<{ category: ContentCategory }>()
    if (fetchError) return fail(fetchError.message)
    if (!existing) return fail('Content not found')

    if (parsed.filePath && !(await storedFileExists(parsed.filePath))) {
      return fail('The uploaded file was not found. Upload it again.')
    }

    let nextOrderIndex: number | undefined
    if (existing.category !== parsed.category) {
      const { data: maxRow } = await supabase
        .from('labs')
        .select('order_index')
        .eq('module_id', parsed.moduleId)
        .eq('category', parsed.category)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle<{ order_index: number }>()
      nextOrderIndex = (maxRow?.order_index ?? 0) + 1
    }

    const { error } = await supabase
      .from('labs')
      .update({
        category: parsed.category,
        resource_type: parsed.resourceType,
        title: parsed.title,
        description: parsed.description,
        body: parsed.body,
        url: parsed.filePath ? storedFileUrl('labs', id) : parsed.url,
        file_path: parsed.filePath,
        duration_minutes: parsed.durationMinutes,
        reflection_enabled: parsed.reflectionEnabled,
        reflection_prompt: parsed.reflectionPrompt,
        scheduled_at: parsed.scheduledAt,
        cohorts: parsed.cohorts,
        ...(nextOrderIndex !== undefined
          ? { order_index: nextOrderIndex }
          : {}),
      })
      .eq('id', id)
    if (error) return fail(error.message)

    revalidatePath(`/admin/curriculum/${parsed.phaseId}/modules/${parsed.moduleId}`)
    revalidatePath(`/phases/${parsed.phaseId}/modules/${parsed.moduleId}`)
    revalidatePath(`/phases/${parsed.phaseId}/modules/${parsed.moduleId}/items/${id}`)
    return ok('Content updated')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function deleteContent(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const id = trim(formData.get('id'))
    const phaseId = trim(formData.get('phase_id'))
    const moduleId = trim(formData.get('module_id'))
    if (!id) return fail('Missing content id')

    const supabase = await createClient()
    const { error } = await supabase.from('labs').delete().eq('id', id)
    if (error) return fail(error.message)

    if (phaseId && moduleId) {
      revalidatePath(`/admin/curriculum/${phaseId}/modules/${moduleId}`)
      revalidatePath(`/admin/curriculum/${phaseId}`)
      revalidatePath(`/phases/${phaseId}/modules/${moduleId}`)
      revalidatePath(`/phases/${phaseId}`)
    }
    return ok('Content deleted')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}

export async function reorderContent(
  phaseId: string,
  moduleId: string,
  category: ContentCategory,
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    await requireAdmin()
    if (!isContentCategory(category)) return fail('Invalid category')
    const supabase = await createClient()

    await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from('labs')
          .update({ order_index: 100000 + i })
          .eq('id', id)
          .eq('module_id', moduleId)
          .eq('category', category),
      ),
    )
    const errors = await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from('labs')
          .update({ order_index: i + 1 })
          .eq('id', id)
          .eq('module_id', moduleId)
          .eq('category', category)
          .then((r) => r.error),
      ),
    )
    const firstError = errors.find(Boolean)
    if (firstError) return fail(firstError.message)

    revalidatePath(`/admin/curriculum/${phaseId}/modules/${moduleId}`)
    revalidatePath(`/phases/${phaseId}/modules/${moduleId}`)
    return ok('Content reordered')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unknown error')
  }
}
