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
export type CompletionGate = 'session_not_ended' | 'link' | 'reflection'

export interface GateItem {
  url: string | null
  resource_type: string | null
  scheduled_at: string | null
  duration_minutes: number | null
  reflection_enabled: boolean
}

export function completionGate(
  item: GateItem,
  state: { linkClicked: boolean; reflection: string | null },
  now: number = Date.now(),
): CompletionGate | null {
  // A scheduled session can't be attended before it has happened.
  if (item.resource_type === 'live_session' && item.scheduled_at) {
    const start = new Date(item.scheduled_at).getTime()
    if (Number.isFinite(start) && now < start + (item.duration_minutes ?? 60) * 60 * 1000) {
      return 'session_not_ended'
    }
  }
  // Live sessions are exempt from the link gate: fellows often join
  // from the calendar invite instead of the in-app button.
  if (item.url && item.resource_type !== 'live_session' && !state.linkClicked) return 'link'
  if (item.reflection_enabled && !reflectionMeetsMinimum(state.reflection)) return 'reflection'
  return null
}

export const COMPLETION_GATE_MESSAGES: Record<CompletionGate, string> = {
  session_not_ended: 'You can mark this complete once the session has ended.',
  link: 'Open the linked resource before marking complete.',
  reflection: `Submit your reflection (at least ${MIN_REFLECTION_WORDS} words) before marking complete.`,
}
