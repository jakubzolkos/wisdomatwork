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
  reflectionMeetsMinimum,
} from '@/lib/reflections'
import {
  hasSessionLinkClick,
  recordSessionLinkClick,
} from '@/lib/session-link-clicks'

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
      'id, year_id, module_id, url, resource_type, reflection_enabled, cohorts, modules:module_id (cohorts), years:year_id (cohorts)',
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
  }
  return { ok: true, item }
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
 * Going from incomplete -> complete enforces the per-item gates the
 * admin configured:
 *
 *   - If the item has a URL, the fellow must have opened it (a row
 *     in `user_content_link_clicks`).
 *   - If `reflection_enabled` is true, the fellow must have submitted
 *     a reflection (a row in `user_content_reflections`).
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

    // Preview: report success so "Mark complete" / "Go to next item"
    // behave normally, but persist nothing.
    if (isPreviewing(user)) return { ok: true, completed: nextCompleted }

    if (nextCompleted) {
      // Gate 1: link click. Live sessions are exempt - the fellow
      // may have joined via Google Calendar or the email invite, so
      // forcing them to also click the in-app link before marking
      // the session attended is needlessly clunky. The reflection
      // gate (gate 2) still applies if the admin enabled one.
      const linkGated = !!item.url && item.resource_type !== 'live_session'
      if (linkGated) {
        // Session-scoped: the gate clears only after the fellow
        // opens the link in *this* login session. A persisted DB
        // click from a previous login no longer counts.
        const clicked = await hasSessionLinkClick(contentId)
        if (!clicked) {
          return {
            ok: false,
            message: 'Open the linked resource before marking complete.',
          }
        }
      }
      // Gate 2: reflection submitted AND long enough (if required).
      // Mirrors the client-side disable on the combined CTA so a
      // motivated tab-clicker can't bypass the word-count rule.
      if (item.reflection_enabled) {
        const { data: reflectionRow } = await supabase
          .from('user_content_reflections')
          .select('response')
          .eq('profile_id', user.id)
          .eq('content_id', contentId)
          .maybeSingle<{ response: string }>()
        if (!reflectionRow) {
          return {
            ok: false,
            message: 'Submit your reflection before marking complete.',
          }
        }
        if (!reflectionMeetsMinimum(reflectionRow.response)) {
          return {
            ok: false,
            message: `Your reflection needs at least ${MIN_REFLECTION_WORDS} words before you can mark this complete.`,
          }
        }
      }

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
    if (isPreviewing(user)) {
      return { ok: false, message: 'Reflections are not saved while previewing.' }
    }

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
    // for it AND the link gate is either absent or already cleared.
    // We mirror the live-session exemption here so the rules stay
    // consistent across actions.
    let completed = false
    if (opts?.markComplete) {
      const linkGated = !!item.url && item.resource_type !== 'live_session'
      let linkOk = !linkGated
      if (linkGated) {
        // Same session-scoped check as `toggleContentCompletion`:
        // we trust the per-login cookie, not the DB audit row.
        linkOk = await hasSessionLinkClick(contentId)
      }
      if (linkOk) {
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

    if (isPreviewing(user)) return { ok: true }

    const visible = await loadVisibleItem(supabase, contentId, user)
    if (!visible.ok) return { ok: false, message: visible.message }
    const { item } = visible

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
