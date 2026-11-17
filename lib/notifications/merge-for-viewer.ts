import { createClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/site'
import { renderMerge, type MergeData } from './merge-fields'
import { loadSessionInfo, recipientMergeData, sessionMergeData } from './session-info'

/**
 * Fills merge fields for the in-app feed, as the signed-in person sees it
 * ("Hi Jane" instead of "Hi {{first_name}}"). Emails are filled per
 * recipient when they send (dispatch.ts); this is the same fill for the
 * copy shown in the portal.
 *
 * Returns a function that fills one piece of text for a notification,
 * given the curriculum item it is pinned to (for the session fields).
 */
export async function createViewerMerger(
  userId: string,
  contentIds: Array<string | null | undefined>,
): Promise<(text: string, contentId: string | null | undefined) => string> {
  const supabase = await createClient()

  let person: { full_name: string | null; cohort: string | null } = { full_name: null, cohort: null }
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, cohort')
      .eq('id', userId)
      .maybeSingle<{ full_name: string | null; cohort: string | null }>()
    if (data) person = data
  } catch {
    // Preview users have no profile row: greet as "there".
  }

  const portalUrl = await siteUrl('/dashboard')
  const ids = [...new Set(contentIds.filter((id): id is string => !!id))]
  const sessions = new Map<string, MergeData>()
  await Promise.all(
    ids.map(async (id) => {
      sessions.set(id, sessionMergeData(await loadSessionInfo(supabase, id)))
    }),
  )

  const base = recipientMergeData(person, portalUrl)
  return (text, contentId) => renderMerge(text, { ...base, ...(contentId ? sessions.get(contentId) : {}) })
}
