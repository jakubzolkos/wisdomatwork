import type { SupabaseClient } from '@supabase/supabase-js'
import { COHORT_NAMES, isCohort } from '@/lib/cohorts'
import { firstNameOf } from '@/lib/email/templates/notification'
import type { MergeData } from './merge-fields'

/**
 * The data behind merge fields: who is receiving (name, program) and,
 * when the notification is pinned to a curriculum item that is a
 * scheduled live session, that session (name, date, time, Zoom link).
 */

export interface SessionInfo {
  id: string
  /** Module title up to the first colon, e.g. "Wisdom Lab One". */
  name: string
  start: Date
  minutes: number
  /** Zoom link; only a full http(s) URL counts. */
  url: string | null
}

/** The live session a notification is pinned to, or null (any lookup problem is also null). */
export async function loadSessionInfo(
  supabase: SupabaseClient,
  contentId: string | null,
): Promise<SessionInfo | null> {
  if (!contentId) return null
  try {
    const { data: item } = await supabase
      .from('labs')
      .select('id, module_id, url, resource_type, scheduled_at, duration_minutes')
      .eq('id', contentId)
      .maybeSingle<{
        id: string
        module_id: string | null
        url: string | null
        resource_type: string | null
        scheduled_at: string | null
        duration_minutes: number | null
      }>()
    if (!item || item.resource_type !== 'live_session' || !item.scheduled_at) return null
    const start = new Date(item.scheduled_at)
    if (Number.isNaN(start.getTime())) return null

    let name = 'Wisdom at Work session'
    if (item.module_id) {
      const { data: module } = await supabase
        .from('modules')
        .select('title')
        .eq('id', item.module_id)
        .maybeSingle<{ title: string }>()
      if (module?.title) name = module.title.split(': ')[0]
    }
    return {
      id: item.id,
      name,
      start,
      minutes: item.duration_minutes ?? 60,
      url: item.url && /^https?:\/\//.test(item.url) ? item.url : null,
    }
  } catch {
    return null
  }
}

const DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})
const TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
})

export function sessionMergeData(session: SessionInfo | null): MergeData {
  if (!session) return {}
  return {
    session_name: session.name,
    session_date: DATE.format(session.start),
    session_time: `${TIME.format(session.start)} ET`,
    zoom_link: session.url,
  }
}

export function recipientMergeData(
  person: { full_name: string | null; cohort: string | null },
  portalUrl: string | null,
): MergeData {
  return {
    first_name: firstNameOf(person.full_name) ?? 'there',
    full_name: person.full_name?.trim() || 'there',
    program: isCohort(person.cohort) ? COHORT_NAMES[person.cohort] : '',
    portal_link: portalUrl,
  }
}
