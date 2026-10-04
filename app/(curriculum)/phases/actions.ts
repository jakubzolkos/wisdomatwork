'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import {
  canFellowSeeContent,
  canFellowSeeModule,
  canFellowSeePhase,
  type ResourceType,
} from '@/lib/curriculum'
import {
  MIN_REFLECTION_WORDS,
  countWords,
} from '@/lib/reflections'
import {
  hasSessionLinkClick,
  recordSessionLinkClick,
} from '@/lib/session-link-clicks'
import { findCurriculumItem, loadFullCurriculum } from '@/lib/curriculum-tree'
import {
  readPreviewCompletions,
  readPreviewReflections,
  setPreviewCompletion,
  setPreviewReflection,
} from '@/lib/preview-completions'
import {
  COMPLETION_GATE_MESSAGES,
  UNMARK_NOT_ALLOWED_MESSAGE,
  canUnmarkComplete,
  completionGate,
} from '@/lib/completion-gates'

// ----------------------------------------------------------------------------
// Preview guard
// ----------------------------------------------------------------------------

/**
 * True while an admin is previewing the fellow experience. In cohort
 * preview the user id is the synthetic '__preview__' (not a uuid); in
 * by-fellow preview it is a real fellow's id. Either way nothing may be
 * written on that id's behalf, so the actions below short-circuit to a
 * no-op that still lets the admin click through the flow.
 */
function isPreviewing(user: Awaited<ReturnType<typeof requireUser>>): boolean {
  return !!user.preview
}

// ----------------------------------------------------------------------------
// Visibility helper
// ----------------------------------------------------------------------------

interface ItemWithCascade {
  id: string
  year_id: string
  module_id: string | null
  url: string | null
  resource_type: ResourceType | null
  reflection_enabled: boolean
  scheduled_at: string | null
  duration_minutes: number | null
  cohorts: string[] | null
  modules: { cohorts: string[] | null } | null
  years: { cohorts: string[] | null } | null
}

/**
 * Look up the content row plus its parent module and phase cohort
 * lists in a single round-trip. Returns the row, or `null` plus an
 * error message when the row is missing or the user can't see it.
 *
 * Centralising this check keeps every fellow-side action enforcing
 * the exact same Phase -> Module -> Content cascade.
 */
async function loadVisibleItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentId: string,
  user: Awaited<ReturnType<typeof requireUser>>,
): Promise<
  | { ok: true; item: ItemWithCascade }
  | { ok: false; message: string }
> {
  const { data: item, error } = await supabase
    .from('labs')
    .select(
      'id, year_id, module_id, url, resource_type, reflection_enabled, scheduled_at, duration_minutes, cohorts, modules:module_id (cohorts), years:year_id (cohorts)',
    )
    .eq('id', contentId)
    .maybeSingle<ItemWithCascade>()

  if (error) return { ok: false, message: error.message }
  if (!item || !item.module_id) {
    return { ok: false, message: 'Content not found' }
  }
  if (user.role === 'fellow') {
    const userCohort = user.cohort ?? null
    const phaseCohorts = item.years?.cohorts ?? null
    const moduleCohorts = item.modules?.cohorts ?? null
    if (
      !canFellowSeePhase(phaseCohorts, userCohort) ||
      !canFellowSeeModule(moduleCohorts, phaseCohorts, userCohort) ||
      !canFellowSeeContent(item.cohorts, phaseCohorts, userCohort, moduleCohorts)
    ) {
      return { ok: false, message: 'Not allowed' }
    }
    // Sequence lock: nothing in a module that hasn't opened yet can
    // be completed, clicked through or reflected on.
    const placement = findCurriculumItem(await loadFullCurriculum(), contentId)
    if (!placement || placement.module.isLocked) {
      return { ok: false, message: "This module isn't open yet." }
    }
  }
  return { ok: true, item }
}

// ----------------------------------------------------------------------------
// Completion gate inputs
// ----------------------------------------------------------------------------

/**
 * What still blocks `user` from completing `item`, read from the same
 * sources the tree uses: the session link-click cookie, the saved
 * reflection, and (in preview) reflections accepted but not saved.
 * `reflection` overrides the saved one, for checks right after a save.
 */
async function completionGateFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: Awaited<ReturnType<typeof requireUser>>,
  item: ItemWithCascade,
  contentId: string,
  reflection?: string,
) {
  // Cohort preview runs as a synthetic, non-uuid user with no rows.
  const hasRealId = user.id !== '__preview__'
  const [linkClicked, reflectionRes, previewReflections] = await Promise.all([
    hasSessionLinkClick(contentId),
    item.reflection_enabled && reflection === undefined && hasRealId
      ? supabase
          .from('user_content_reflections')
          .select('response')
          .eq('profile_id', user.id)
          .eq('content_id', contentId)
          .maybeSingle<{ response: string }>()
      : Promise.resolve({ data: null }),
    readPreviewReflections(user),
  ])
  return completionGate(item, {
    linkClicked,
    reflection: reflection ?? reflectionRes.data?.response ?? null,
    reflectionAccepted: previewReflections.has(contentId),
  })
}

// ----------------------------------------------------------------------------
// Mark complete / not-complete
// ----------------------------------------------------------------------------

export type ToggleResult =
  | { ok: true; completed: boolean }
  | { ok: false; message: string }

/**
 * Toggle the current user's completion of a content item.
 *
 * Going from incomplete -> complete enforces lib/completion-gates.ts:
 * a scheduled session must have ended, a linked resource must have
 * been opened this login session, and a required reflection must
 * meet the minimum length.
 *
 * Going the other direction (uncheck) always works.
 */
export async function toggleContentCompletion(
  contentId: string,
  nextCompleted: boolean,
): Promise<ToggleResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    if (!contentId) return { ok: false, message: 'Missing content id' }

    const visible = await loadVisibleItem(supabase, contentId, user)
    if (!visible.ok) return { ok: false, message: visible.message }
    const { item } = visible

    // Completion is final for fellows (and preview, which runs as one).
    if (!nextCompleted && !canUnmarkComplete(user.role)) {
      return { ok: false, message: UNMARK_NOT_ALLOWED_MESSAGE }
    }

    if (nextCompleted) {
      // Same rule the tree and footer use to disable the control
      // (lib/completion-gates.ts): session has ended, link opened in
      // this login session, reflection long enough. Applies in
      // preview too, so the admin meets exactly what a fellow meets.
      const gate = await completionGateFor(supabase, user, item, contentId)
      if (gate) return { ok: false, message: COMPLETION_GATE_MESSAGES[gate] }
    }

    // Preview: nothing is written to the database. The toggle goes to
    // a preview-only cookie so the admin can walk the module sequence
    // and watch later modules unlock.
    if (isPreviewing(user)) {
      await setPreviewCompletion(user, contentId, nextCompleted)
      revalidatePath('/dashboard')
      return { ok: true, completed: nextCompleted }
    }

    if (nextCompleted) {
      const { error: insertError } = await supabase
        .from('user_content_completions')
        .upsert(
          { profile_id: user.id, content_id: contentId },
          { onConflict: 'profile_id,content_id' },
        )
      if (insertError) return { ok: false, message: insertError.message }
    } else {
      const { error: deleteError } = await supabase
        .from('user_content_completions')
        .delete()
        .eq('profile_id', user.id)
        .eq('content_id', contentId)
      if (deleteError) return { ok: false, message: deleteError.message }
    }

    revalidatePath('/dashboard')
    revalidatePath(
      `/phases/${item.year_id}/modules/${item.module_id}/items/${contentId}`,
    )
    return { ok: true, completed: nextCompleted }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}

// ----------------------------------------------------------------------------
// Track that the fellow opened the linked resource
// ----------------------------------------------------------------------------

export type LinkClickResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Record that the current user clicked the external link for a
 * content item. Idempotent - calling twice is a no-op. Fired by the
 * `LinkOpenButton` client component on the viewer page.
 */
export async function recordLinkClick(
  contentId: string,
): Promise<LinkClickResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    if (!contentId) return { ok: false, message: 'Missing content id' }

    const visible = await loadVisibleItem(supabase, contentId, user)
    if (!visible.ok) return { ok: false, message: visible.message }
    const { item } = visible

    if (!item.url) {
      // Nothing to track. Treat as success so the client can no-op.
      return { ok: true }
    }

    // 1) Authoritative gate: append to the per-login session
    //    cookie. This is what `toggleContentCompletion` and the
    //    page reader consult.
    await recordSessionLinkClick(contentId)

    // Preview: the cookie above clears the gate for this browser
    // session only; skip the per-profile audit row.
    if (isPreviewing(user)) return { ok: true }

    // 2) Audit/analytics: keep the legacy DB row so admins can
    //    still see who has *ever* opened a resource. This is best
    //    effort - failure here doesn't block the gate clearing.
    const { error } = await supabase
      .from('user_content_link_clicks')
      .upsert(
        { profile_id: user.id, content_id: contentId },
        { onConflict: 'profile_id,content_id' },
      )
    if (error) return { ok: false, message: error.message }

    revalidatePath(
      `/phases/${item.year_id}/modules/${item.module_id}/items/${contentId}`,
    )
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}

// ----------------------------------------------------------------------------
// Submit / update the fellow's reflection
// ----------------------------------------------------------------------------

export type ReflectionResult =
  | { ok: true; completed?: boolean }
  | { ok: false; message: string }

const MAX_REFLECTION_LENGTH = 5000

/**
 * Save (or update) the current user's reflection for a content item.
 * Only valid when the item has `reflection_enabled = true`.
 *
 * When `opts.markComplete` is true, the action also tries to mark
 * the item completed in the same round-trip - so the fellow only
 * needs ONE click ("Submit reflection") instead of two ("Submit"
 * then "Mark complete"). If a separate gate is still pending
 * (e.g. the link hasn't been opened yet on a non-live-session
 * item), the reflection is still saved but completion is silently
 * skipped; the page footer falls back to the standalone Mark CTA.
 */
export async function submitReflection(
  contentId: string,
  response: string,
  opts?: { markComplete?: boolean },
): Promise<ReflectionResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    if (!contentId) return { ok: false, message: 'Missing content id' }

    const trimmed = response.trim()
    if (!trimmed) return { ok: false, message: 'Reflection cannot be empty' }
    if (trimmed.length > MAX_REFLECTION_LENGTH) {
      return {
        ok: false,
        message: `Reflection is too long (max ${MAX_REFLECTION_LENGTH} characters)`,
      }
    }
    const words = countWords(trimmed)
    if (words < MIN_REFLECTION_WORDS) {
      return {
        ok: false,
        message: `Reflection needs at least ${MIN_REFLECTION_WORDS} words (you have ${words}).`,
      }
    }

    const visible = await loadVisibleItem(supabase, contentId, user)
    if (!visible.ok) return { ok: false, message: visible.message }
    const { item } = visible

    if (!item.reflection_enabled) {
      return {
        ok: false,
        message: 'This content does not require a reflection.',
      }
    }

    // Preview: validated exactly like a fellow's, but not saved. The
    // item is remembered as "reflection accepted" in the preview
    // cookie so the completion gate clears the same way.
    if (isPreviewing(user)) {
      await setPreviewReflection(user, contentId, true)
      let completed = false
      if (opts?.markComplete && !(await completionGateFor(supabase, user, item, contentId, trimmed))) {
        await setPreviewCompletion(user, contentId, true)
        completed = true
      }
      revalidatePath('/dashboard')
      return { ok: true, completed }
    }

    const { error } = await supabase
      .from('user_content_reflections')
      .upsert(
        {
          profile_id: user.id,
          content_id: contentId,
          response: trimmed,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,content_id' },
      )
    if (error) return { ok: false, message: error.message }

    // One-step "submit & complete" flow: only when the caller asks
    // for it AND every other gate (lib/completion-gates.ts) is clear,
    // checked against the reflection just saved.
    let completed = false
    if (opts?.markComplete) {
      if (!(await completionGateFor(supabase, user, item, contentId, trimmed))) {
        const { error: completeErr } = await supabase
          .from('user_content_completions')
          .upsert(
            { profile_id: user.id, content_id: contentId },
            { onConflict: 'profile_id,content_id' },
          )
        if (!completeErr) {
          completed = true
          revalidatePath('/dashboard')
        }
        // Failures here are intentionally swallowed - the
        // reflection itself saved successfully, so we don't want
        // to surface a confusing error. The footer will still
        // render the standalone Mark CTA next refresh.
      }
    }

    revalidatePath(
      `/phases/${item.year_id}/modules/${item.module_id}/items/${contentId}`,
    )
    return { ok: true, completed }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}

/**
 * Wipe the current user's reflection for a content item AND any
 * completion row that depended on it. Triggered when the fellow
 * clears the reflection textbox - they have to re-submit a fresh
 * reflection (>= MIN_REFLECTION_WORDS) before the lesson can be
 * marked complete again.
 *
 * Idempotent: deleting a row that doesn't exist is a no-op.
 */
export async function deleteReflection(
  contentId: string,
): Promise<ReflectionResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    if (!contentId) return { ok: false, message: 'Missing content id' }

    const visible = await loadVisibleItem(supabase, contentId, user)
    if (!visible.ok) return { ok: false, message: visible.message }
    const { item } = visible

    // Deleting a reflection un-completes its item, and completion is
    // final for fellows: once the item is done they can edit the
    // reflection, not remove it.
    if (item.reflection_enabled && !canUnmarkComplete(user.role)) {
      const completed = isPreviewing(user)
        ? (await readPreviewCompletions(user)).get(contentId) === true
        : !!(
            await supabase
              .from('user_content_completions')
              .select('content_id')
              .eq('profile_id', user.id)
              .eq('content_id', contentId)
              .maybeSingle()
          ).data
      if (completed) {
        return {
          ok: false,
          message: 'This item is completed, so its reflection stays. You can still edit it.',
        }
      }
    }

    // Preview: forget the accepted reflection and the completion that
    // depended on it, mirroring the real delete below.
    if (isPreviewing(user)) {
      await setPreviewReflection(user, contentId, false)
      if (item.reflection_enabled) await setPreviewCompletion(user, contentId, false)
      revalidatePath('/dashboard')
      return { ok: true }
    }

    const { error: refErr } = await supabase
      .from('user_content_reflections')
      .delete()
      .eq('profile_id', user.id)
      .eq('content_id', contentId)
    if (refErr) return { ok: false, message: refErr.message }

    // A completion that was only valid because of the reflection
    // shouldn't outlive it - drop it too so the gate re-engages.
    if (item.reflection_enabled) {
      const { error: compErr } = await supabase
        .from('user_content_completions')
        .delete()
        .eq('profile_id', user.id)
        .eq('content_id', contentId)
      if (compErr) return { ok: false, message: compErr.message }
    }

    revalidatePath('/dashboard')
    revalidatePath(
      `/phases/${item.year_id}/modules/${item.module_id}/items/${contentId}`,
    )
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}
