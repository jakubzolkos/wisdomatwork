import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import {
  canFellowSeeContent,
  canFellowSeePhase,
  type ContentCategory,
} from '@/lib/curriculum'
import type { CurrentUser } from '@/lib/user-context'
import type { FeedItemView } from '@/components/notifications/notifications-feed'
import type { NotificationKind } from '@/lib/notifications/types'
import { hasMergeFields, safeCtaUrl } from '@/lib/notifications/merge-fields'
import { createViewerMerger } from '@/lib/notifications/merge-for-viewer'

// ============================================================================
// Types
// ============================================================================

export interface DashboardPhase {
  id: string
  orderIndex: number
  title: string
  description: string | null
  contentCount: number
}

export interface DashboardSessionFacilitator {
  id: string
  name: string
  initials: string
}

export interface DashboardSession {
  id: string
  title: string
  startTime: string
  endTime: string
  joinUrl: string | null
  facilitators: DashboardSessionFacilitator[]
}

/**
 * Backwards-compat alias - the dashboard now renders the unified
 * notifications feed but other callers still import this type name.
 */
export type DashboardAnnouncement = FeedItemView

export interface DashboardData {
  user: CurrentUser
  phases: DashboardPhase[]
  upcomingSession: DashboardSession | null
  notifications: FeedItemView[]
}

// ============================================================================
// Helpers
// ============================================================================

function initialsFor(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

// ============================================================================
// Loader
// ============================================================================

export async function getDashboardData(): Promise<DashboardData> {
  const user = await requireUser()
  const supabase = await createClient()

  // ---------------------------------------------------------------------------
  // Phases + content (filtered for fellows by cohort access)
  // ---------------------------------------------------------------------------
  const isFellow = user.role === 'fellow'
  const userCohort = user.cohort ?? null

  const [{ data: phaseRows }, { data: moduleRows }, { data: itemRows }] =
    await Promise.all([
      supabase
        .from('years')
        .select('id, order_index, title, description, cohorts')
        .order('order_index', { ascending: true }),
      supabase
        .from('modules')
        .select('id, phase_id, cohorts'),
      supabase
        .from('labs')
        .select('id, year_id, module_id, category, cohorts')
        .returns<
          Array<{
            id: string
            year_id: string
            module_id: string | null
            category: ContentCategory | null
            cohorts: string[] | null
          }>
        >(),
    ])

  const phaseCohortById = new Map<string, string[] | null>()
  for (const p of phaseRows ?? []) {
    phaseCohortById.set(p.id, (p.cohorts as string[] | null) ?? null)
  }

  // For module-level cascading we need quick lookups from module id ->
  // its parent phase id and its own cohort override.
  const moduleCohortById = new Map<string, string[] | null>()
  const modulePhaseById = new Map<string, string>()
  for (const m of (moduleRows ?? []) as Array<{
    id: string
    phase_id: string
    cohorts: string[] | null
  }>) {
    moduleCohortById.set(m.id, m.cohorts)
    modulePhaseById.set(m.id, m.phase_id)
  }

  // Tally a per-phase content count, applying per-fellow cohort
  // visibility through the full Phase -> Module -> Content cascade.
  const countsByPhase = new Map<string, number>()
  console.log('[v0] Phase count:', phaseRows?.length)
  console.log('[v0] Module count:', moduleRows?.length)
  console.log('[v0] Item count:', itemRows?.length)
  console.log('[v0] modulePhaseById:', Object.fromEntries(modulePhaseById))
  
  for (const item of itemRows ?? []) {
    // Skip items without a category (they won't render in the UI anyway).
    // If you want to show items even without a category, change this logic.
    if (!item.category) continue
    if (!item.module_id) {
      console.log('[v0] Item has no module_id:', item.id)
      continue
    }
    
    // Get the phase ID from the module
    const phaseId = modulePhaseById.get(item.module_id)
    console.log('[v0] Lab:', item.id, 'module_id:', item.module_id, 'phaseId from module:', phaseId, 'item.year_id:', item.year_id)
    
    // Use phaseId from module, but fall back to item.year_id for backward compat
    const targetPhaseId = phaseId ?? item.year_id
    if (!targetPhaseId) {
      console.log('[v0] No phase found for item:', item.id)
      continue
    }
    
    const moduleCohorts = moduleCohortById.get(item.module_id) ?? null
    const phaseCohorts = phaseCohortById.get(targetPhaseId) ?? null
    if (isFellow) {
      if (
        !canFellowSeeContent(
          item.cohorts,
          phaseCohorts,
          userCohort,
          moduleCohorts,
        )
      ) {
        continue
      }
    }
    countsByPhase.set(targetPhaseId, (countsByPhase.get(targetPhaseId) ?? 0) + 1)
  }
  console.log('[v0] Final countsByPhase:', Object.fromEntries(countsByPhase))

  // Build the phase list, hiding phases the fellow can't see at all.
  const phases: DashboardPhase[] = []
  for (const p of phaseRows ?? []) {
    if (isFellow && !canFellowSeePhase(p.cohorts as string[] | null, userCohort)) {
      continue
    }
    phases.push({
      id: p.id,
      orderIndex: p.order_index,
      title: p.title,
      description: p.description,
      contentCount: countsByPhase.get(p.id) ?? 0,
    })
  }

  // ---------------------------------------------------------------------------
  // Upcoming session (within 7 days, user's cohort)
  // ---------------------------------------------------------------------------
  const { data: cohortMemberships } = await supabase
    .from('cohort_members')
    .select('cohort_id')
    .eq('profile_id', user.id)

  const cohortIds = (cohortMemberships ?? []).map((r) => r.cohort_id)
  let upcomingSession: DashboardSession | null = null
  if (cohortIds.length > 0) {
    const nowIso = new Date().toISOString()
    const sevenDaysIso = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString()
    const { data: sessionRow } = await supabase
      .from('sessions')
      .select(
        'id, title, starts_at, ends_at, zoom_link, session_facilitators(profile_id, profiles:profiles(id, full_name))',
      )
      .in('cohort_id', cohortIds)
      .gte('starts_at', nowIso)
      .lte('starts_at', sevenDaysIso)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle<{
        id: string
        title: string
        starts_at: string
        ends_at: string | null
        zoom_link: string | null
        session_facilitators: Array<{
          profile_id: string
          profiles: { id: string; full_name: string | null } | null
        }>
      }>()
    if (sessionRow) {
      upcomingSession = {
        id: sessionRow.id,
        title: sessionRow.title,
        startTime: sessionRow.starts_at,
        endTime:
          sessionRow.ends_at ??
          new Date(
            new Date(sessionRow.starts_at).getTime() + 60 * 60 * 1000,
          ).toISOString(),
        joinUrl: sessionRow.zoom_link,
        facilitators: (sessionRow.session_facilitators ?? [])
          .map((sf) => sf.profiles)
          .filter((p): p is { id: string; full_name: string | null } => !!p)
          .map((p) => ({
            id: p.id,
            name: p.full_name ?? 'Facilitator',
            initials: initialsFor(p.full_name),
          })),
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Notifications (RLS already scopes audience)
  // ---------------------------------------------------------------------------
  const { data: notificationRows } = await supabase
    .from('notifications')
    .select(
      'id, kind, title, body, pinned, sent_at, published_at, cta_label, cta_url, author:profiles!author_id(full_name), content:labs!content_id(id, title, year_id, module_id)',
    )
    .eq('status', 'sent')
    .order('pinned', { ascending: false })
    .order('sent_at', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(5)

  // Read state for the dashboard preview - we left-join recipient
  // rows so each item knows whether the user has already read it.
  const ids = (notificationRows ?? []).map((r) => r.id)
  const recipientByNotification = new Map<string, string | null>()
  if (ids.length > 0) {
    const { data: recipients } = await supabase
      .from('notification_recipients')
      .select('notification_id, read_at')
      .eq('profile_id', user.id)
      .in('notification_id', ids)
    for (const r of recipients ?? []) {
      recipientByNotification.set(r.notification_id, r.read_at)
    }
  }

  // Fill merge fields ({{first_name}}, ...) as this person sees them.
  const needsMerge = (notificationRows ?? []).some((r: any) =>
    hasMergeFields(r.title, r.body, r.cta_label, r.cta_url),
  )
  const merge = needsMerge
    ? await createViewerMerger(
        user.id,
        (notificationRows ?? []).map((r: any) => {
          const c = Array.isArray(r.content) ? r.content[0] : r.content
          return c?.id ?? null
        }),
      )
    : null

  const notifications: FeedItemView[] = (notificationRows ?? []).map((row: any) => {
    const authorRecord = Array.isArray(row.author) ? row.author[0] : row.author
    // Supabase returns embedded relations as either a single object
    // or a one-element array depending on the query shape; normalise.
    const contentRecord = Array.isArray(row.content)
      ? row.content[0] ?? null
      : (row.content as
          | { id: string; title: string; year_id: string; module_id: string }
          | null) ?? null
    const ctaUrl: string | null = !row.cta_url
      ? null
      : merge
        ? safeCtaUrl(merge(row.cta_url, contentRecord?.id))
        : row.cta_url
    return {
      id: row.id,
      kind: (row.kind ?? 'announcement') as NotificationKind,
      title: merge ? merge(row.title, contentRecord?.id) : row.title,
      body: merge ? merge(row.body, contentRecord?.id) : row.body,
      pinned: row.pinned,
      publishedAt: row.sent_at ?? row.published_at,
      readAt: recipientByNotification.get(row.id) ?? null,
      author: authorRecord
        ? {
            name: authorRecord.full_name ?? 'Team',
            initials: initialsFor(authorRecord.full_name),
          }
        : null,
      // With merge fields the link must still be a real address after
      // filling; otherwise there is no button.
      ctaLabel: ctaUrl && row.cta_label ? (merge ? merge(row.cta_label, contentRecord?.id) : row.cta_label) : null,
      ctaUrl,
      content: contentRecord
        ? {
            id: contentRecord.id,
            title: contentRecord.title,
            // Mirrors app/(curriculum)/phases/[phaseId]/modules/[moduleId]/items/[itemId]
            href: `/phases/${contentRecord.year_id}/modules/${contentRecord.module_id}/items/${contentRecord.id}`,
          }
        : null,
    }
  })

  return { user, phases, upcomingSession, notifications }
}
