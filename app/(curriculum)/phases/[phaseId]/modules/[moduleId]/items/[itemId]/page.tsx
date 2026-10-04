import { notFound } from 'next/navigation'
import { Clock, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { LessonFooter } from '@/components/curriculum/lesson-footer'
import { LinkOpenButton } from '@/components/curriculum/link-open-button'
import { LiveSessionStatus } from '@/components/curriculum/live-session-status'
import { ReflectionForm } from '@/components/curriculum/reflection-form'
import { ReflectionDisplay } from '@/components/curriculum/reflection-display'
import { VideoEmbed } from '@/components/curriculum/video-embed'
// Detector is server-safe (pure URL parsing) and lives in a
// non-client module so this server component can call it without
// crossing the RSC client boundary.
import { isEmbeddableVideo } from '@/lib/video-embed'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import {
  getResourceType,
  type ContentCategory,
  type ResourceType,
} from '@/lib/curriculum'
import { canUserSeeItem } from '@/lib/content-access'
import {
  findAdjacentItems,
  findCurriculumItem,
  loadFullCurriculum,
} from '@/lib/curriculum-tree'
import { LockedModuleNotice } from '@/components/curriculum/locked-module-notice'
import { ResearchIdCard } from '@/components/profile/research-id-card'
import { getResearchId } from '@/lib/research-id'
import { readPreviewReflections } from '@/lib/preview-completions'
import { COMPLETION_GATE_MESSAGES, completionGate, isPendingSurvey } from '@/lib/completion-gates'
import { reflectionMeetsMinimum } from '@/lib/reflections'
import { hasSessionLinkClick } from '@/lib/session-link-clicks'

export const dynamic = 'force-dynamic'

interface PhaseRow {
  id: string
  cohorts: string[] | null
}

interface ModuleRow {
  id: string
  cohorts: string[] | null
}

interface ContentRow {
  id: string
  module_id: string
  title: string
  description: string | null
  body: string | null
  url: string | null
  category: ContentCategory | null
  resource_type: ResourceType | null
  cohorts: string[] | null
  duration_minutes: number | null
  reflection_enabled: boolean
  reflection_prompt: string | null
  /**
   * UTC ISO start time for live-session items. NULL for any other
   * resource type or for live items the admin hasn't scheduled.
   */
  scheduled_at: string | null
}

function formatDuration(mins: number | null): string | null {
  if (!mins || mins <= 0) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/**
 * Pure right-pane content for a single curriculum item. The
 * surrounding chrome (top bar + curriculum tree on the left) lives
 * in app/(curriculum)/layout.tsx; this page just renders the
 * article. That mirrors the design brief: clicking a row in the tree
 * repaints only the right side.
 */
export default async function ContentItemPage({
  params,
}: {
  params: Promise<{ phaseId: string; moduleId: string; itemId: string }>
}) {
  const { phaseId, moduleId, itemId } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: phase }, { data: module }, { data: item }] = await Promise.all([
    supabase
      .from('years')
      .select('id, cohorts')
      .eq('id', phaseId)
      .maybeSingle<PhaseRow>(),
    supabase
      .from('modules')
      .select('id, cohorts')
      .eq('id', moduleId)
      .eq('phase_id', phaseId)
      .maybeSingle<ModuleRow>(),
    supabase
      .from('labs')
      .select(
        'id, module_id, title, description, body, url, category, resource_type, cohorts, duration_minutes, reflection_enabled, reflection_prompt, scheduled_at',
      )
      .eq('id', itemId)
      .eq('module_id', moduleId)
      .maybeSingle<ContentRow>(),
  ])

  if (!phase || !module || !item) notFound()
  // The tree decides what this user sees (React.cache makes this the
  // same load as the layout's).
  const placement = findCurriculumItem(await loadFullCurriculum(), item.id)
  if (!placement) notFound()
  // A finished phase (Cohort A's Deep Learning year) shows as done and
  // still lists its sessions, which this year belong to the other
  // cohort; everything else must pass the cohort rule shared with the
  // stored-file route.
  const isPast = placement.item.isPast
  if (!isPast && !canUserSeeItem(user, phase, module, item)) notFound()

  // Sequence lock: a deep link (notification, bookmark, dashboard
  // card) into a module that isn't open yet shows why instead of the
  // content.
  if (placement.module.isLocked) {
    return (
      <LockedModuleNotice
        moduleTitle={placement.module.title}
        opensAt={placement.module.opensAt}
        blockedBy={placement.module.blockedBy}
      />
    )
  }

  // Look up per-user state for the gates and the completion radio.
  // Completion + reflection are persisted in Postgres (scoped to the
  // user via RLS). The link-click gate, however, is intentionally
  // *session-scoped*: it lives in a per-login cookie ledger
  // (`hasSessionLinkClick`) so logging out and back in re-engages
  // the gate. The legacy `user_content_link_clicks` table is still
  // written for audit, but is no longer consulted for the gate.
  const [
    { data: completion },
    linkClicked,
    { data: reflection },
    curriculum,
  ] = await Promise.all([
    supabase
      .from('user_content_completions')
      .select('content_id')
      .eq('profile_id', user.id)
      .eq('content_id', item.id)
      .maybeSingle<{ content_id: string }>(),
    hasSessionLinkClick(item.id),
    supabase
      .from('user_content_reflections')
      .select('response')
      .eq('profile_id', user.id)
      .eq('content_id', item.id)
      .maybeSingle<{ response: string }>(),
    // Used only to compute the "Continue" target. Wrapped in
    // React.cache so the layout's call doesn't double-fetch.
    loadFullCurriculum(),
  ])

  // Preview completions live in a cookie (lib/preview-completions.ts),
  // which the tree already overlays onto the real ones.
  let isCompleted = isPast || (user.preview ? placement.item.isCompleted : !!completion)
  const reflectionResponse = reflection?.response ?? null
  const resource = item.resource_type ? getResourceType(item.resource_type) : null
  // "External link" says nothing the link button doesn't already show.
  const showResourceBadge = !!resource && item.resource_type !== 'external_link'
  const duration = formatDuration(item.duration_minutes)
  const hasBody = !!item.body && item.body.trim().length > 0
  const hasUrl = !!item.url
  const isLiveSession = item.resource_type === 'live_session'
  // Last year's session: this year's date and Zoom are the other
  // cohort's, so neither is shown.
  const isHeldSession = isPast && isLiveSession
  // Survey forms ask for the fellow's research ID, so show it right
  // above the link.
  const researchId =
    item.resource_type === 'survey' && hasUrl ? await getResearchId(user.id) : null
  // Reflection is required as soon as the admin toggles it on. The
  // prompt is enforced separately at admin save time, so it'll
  // always be present here in practice - but we don't bypass the
  // gate just because the prompt happens to be missing.
  const reflectionRequired = item.reflection_enabled === true

  // Live-session schedule + auto-completion. When the admin set a
  // start time we replace the Join button with a smart status block
  // that runs the countdown client-side. Once the session has ended
  // (start + duration < now) we mark this item complete on the
  // user's behalf - no manual click needed - and the rest of the
  // page renders the standard "completed" state. The upsert is
  // idempotent so a repeated visit after the session ended is a
  // no-op. We only auto-complete when the reflection gate isn't
  // active, since a reflection is a fellow-authored artefact we
  // shouldn't synthesise on their behalf.
  const scheduledAt = item.scheduled_at
  const liveSessionScheduled = isLiveSession && !!scheduledAt
  if (liveSessionScheduled && !isCompleted && !reflectionRequired && !user.preview) {
    const startMs = new Date(scheduledAt!).getTime()
    if (Number.isFinite(startMs)) {
      const durationMs = (item.duration_minutes ?? 60) * 60 * 1000
      const endMs = startMs + durationMs
      if (Date.now() >= endMs) {
        const { error: completeErr } = await supabase
          .from('user_content_completions')
          .upsert(
            { profile_id: user.id, content_id: item.id },
            { onConflict: 'profile_id,content_id' },
          )
        if (!completeErr) isCompleted = true
      }
    }
  }

  const { next, nextLocked } = findAdjacentItems(curriculum, item.id)

  // Gate states. Only block the FIRST completion - once an item is
  // already complete the fellow can freely uncheck/redo. Reflection
  // gate uses the shared 50-word rule so client-side disabled state
  // matches server-side validation. Live sessions are exempt from
  // the click-the-link gate (calendar invites, email RSVPs etc.
  // make the in-app click unnecessary friction).
  const needsLinkClick =
    !isCompleted && hasUrl && !linkClicked && !isLiveSession
  // In preview a reflection is validated but not saved; the preview
  // cookie remembers that it was accepted.
  const reflectionAccepted =
    !!user.preview && (await readPreviewReflections(user)).has(item.id)
  const needsReflection =
    !isCompleted &&
    reflectionRequired &&
    !reflectionAccepted &&
    !reflectionMeetsMinimum(reflectionResponse)
  // Gates the fellow can only wait out: a scheduled session that
  // hasn't ended, or a survey whose link isn't published yet. Same
  // rule as the action and the sidebar (lib/completion-gates.ts),
  // preview included.
  const gate = isCompleted
    ? null
    : completionGate(item, { linkClicked, reflection: reflectionResponse, reflectionAccepted })
  const waitMessage =
    gate === 'session_not_ended' || gate === 'not_available'
      ? COMPLETION_GATE_MESSAGES[gate]
      : null

  return (
    <article className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="space-y-3 border-b border-border px-5 py-6 sm:px-8 sm:py-8">
        {(showResourceBadge || duration) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {showResourceBadge && <Badge variant="secondary">{resource.label}</Badge>}
            {duration && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {duration}
              </span>
            )}
          </div>
        )}
        <h1 className="text-pretty text-2xl sm:text-3xl">{item.title}</h1>
        {item.description && (
          <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        )}
      </header>

      <div className="space-y-8 px-5 py-6 sm:px-8 sm:py-8">
      {/* Body */}
      {hasBody && !isHeldSession && (
        <div className="rich-text">
          {item.body!.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {para}
            </p>
          ))}
        </div>
      )}

      {/* External resource. Three branches:
          - Scheduled live sessions: smart status block with a live
            countdown + adaptive Join button + auto-complete handoff.
          - Embeddable videos: inline 16:9 player; reaching the
            embed counts as the "open" for the completion gate.
          - Everything else: single CTA whose label is the article
            title so the click target reads as the thing the fellow
            is opening. Live sessions without a scheduled_at fall
            through to this branch and use the legacy Join button. */}
      {researchId && (
        <ResearchIdCard
          researchId={researchId}
          hint="The survey will ask for this. Copy it before you open the form."
        />
      )}

      {isHeldSession && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-5">
          <History className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">This session has already taken place</p>
            <p className="text-sm text-muted-foreground">
              Your cohort held this Wisdom Lab during your Deep Learning year.
            </p>
          </div>
        </div>
      )}

      {hasUrl &&
        !isHeldSession &&
        (liveSessionScheduled ? (
          <LiveSessionStatus
            contentId={item.id}
            url={item.url!}
            scheduledAt={scheduledAt!}
            durationMinutes={item.duration_minutes}
            isCompleted={isCompleted}
            serverNow={Date.now()}
          />
        ) : item.resource_type === 'video' &&
          isEmbeddableVideo(item.url!) ? (
          <VideoEmbed
            contentId={item.id}
            url={item.url!}
            alreadyClicked={linkClicked}
          />
        ) : (
          <div className="flex">
            <LinkOpenButton
              contentId={item.id}
              url={item.url!}
              isLiveSession={isLiveSession}
              label={isLiveSession ? 'Join live session' : item.title}
              alreadyClicked={linkClicked}
            />
          </div>
        ))}

      {!isHeldSession && !hasBody && !hasUrl && !reflectionRequired && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {isPendingSurvey(item)
              ? 'The survey link will be shared here when it’s ready.'
              : 'This item has no content attached yet.'}
          </p>
        </div>
      )}

      {/* Reflection prompt + response. Required to complete the
          item when enabled. */}
      {reflectionRequired && !isHeldSession && (
        <>
          <ReflectionForm
            contentId={item.id}
            prompt={item.reflection_prompt!.trim()}
            initialResponse={reflectionResponse}
          />
          <ReflectionDisplay
            reflection={reflectionResponse}
            contentTitle={item.title}
            nextHref={next?.href ?? null}
          />
        </>
      )}
      </div>

      {/* Footer pairs Mark-complete with Continue.
          - Scheduled live sessions hide the manual "Mark complete"
            button entirely (autoComplete=true) because
            completion is driven by the schedule: the page upserts a
            completion row once the session has ended. The "Continue
            to next item" CTA still appears once the lesson is
            complete.
          - Unscheduled live sessions keep the legacy hint reminding
            fellows they can mark complete after attending.
          - Reflection-gated live sessions also keep the manual
            button; we don't want to synthesise a reflection for
            them. */}
      <LessonFooter
        contentId={item.id}
        isCompleted={isCompleted}
        needsLinkClick={needsLinkClick}
        needsReflection={needsReflection}
        nextHref={next?.href ?? null}
        nextLockedMessage={nextLocked}
        waitMessage={waitMessage}
        autoComplete={liveSessionScheduled && !reflectionRequired}
        incompleteHint={
          isLiveSession && !liveSessionScheduled && !needsReflection
            ? 'Mark this complete once you have attended the live session.'
            : null
        }
      />
    </article>
  )
}
