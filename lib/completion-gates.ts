import { MIN_REFLECTION_WORDS, reflectionMeetsMinimum } from '@/lib/reflections'

/**
 * Whether an item can be marked complete right now - the one place the
 * rule lives. The completion action enforces it; the curriculum tree
 * and the item footer use it to disable the control up front, so a
 * click never ticks and then bounces back.
 *
 * Only incomplete -> complete is gated; unticking always works.
 * Pure: safe on the client (for the messages) and the server.
 */
export type CompletionGate = 'session_not_ended' | 'not_available' | 'link' | 'reflection'

export interface GateItem {
  url: string | null
  resource_type: string | null
  scheduled_at: string | null
  duration_minutes: number | null
  reflection_enabled: boolean
}

/**
 * A survey with no link yet: a placeholder for a form the WaW team
 * publishes later (Reflections on Practice, sign-ups, post-program
 * surveys). It can't be completed, and it doesn't hold back the module
 * sequence or count toward progress until the link is added.
 */
export function isPendingSurvey(item: { resource_type: string | null; url: string | null }): boolean {
  return item.resource_type === 'survey' && !item.url
}

export function completionGate(
  item: GateItem,
  state: {
    linkClicked: boolean
    reflection: string | null
    /** Admin preview: a reflection passed validation but wasn't saved. */
    reflectionAccepted?: boolean
  },
  now: number = Date.now(),
): CompletionGate | null {
  // A scheduled session can't be attended before it has happened.
  if (item.resource_type === 'live_session' && item.scheduled_at) {
    const start = new Date(item.scheduled_at).getTime()
    if (Number.isFinite(start) && now < start + (item.duration_minutes ?? 60) * 60 * 1000) {
      return 'session_not_ended'
    }
  }
  if (isPendingSurvey(item)) return 'not_available'
  // Live sessions are exempt from the link gate: fellows often join
  // from the calendar invite instead of the in-app button.
  if (item.url && item.resource_type !== 'live_session' && !state.linkClicked) return 'link'
  if (
    item.reflection_enabled &&
    !state.reflectionAccepted &&
    !reflectionMeetsMinimum(state.reflection)
  ) {
    return 'reflection'
  }
  return null
}

export const COMPLETION_GATE_MESSAGES: Record<CompletionGate, string> = {
  session_not_ended: 'You can mark this complete once the session has ended.',
  not_available: "The survey link isn't available yet. It will be shared here when it's ready.",
  link: 'Open the linked resource before marking complete.',
  reflection: `Submit your reflection (at least ${MIN_REFLECTION_WORDS} words) before marking complete.`,
}
