import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Lightweight shape passed through to the Wins composer's framework
 * dropdown. Keeping this narrow means we don't accidentally ship
 * heavier columns (resource bodies, blob URLs) to the client.
 */
export interface FrameworkOption {
  /** community_resources.id - persisted as community_posts.framework_resource_id. */
  id: string
  /** Display label for the dropdown and the "Used:" chip on the feed card. */
  title: string
}

/**
 * Fetch every "PWF Protocol" library resource so the Wins composer
 * can offer them as a curated dropdown. Marked via the
 * `is_pwf_protocol` flag set by admins on /admin/library entries.
 *
 * Sorted by title so the dropdown is alphabetical and stable.
 * Returns at most 200 rows - we don't anticipate the curated list
 * growing past that.
 */
export async function loadPwfProtocols(): Promise<FrameworkOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('community_resources')
    .select('id, title')
    .eq('is_pwf_protocol', true)
    .eq('staff_only', false)
    .order('title', { ascending: true })
    .limit(200)

  if (error) {
    console.error('[v0] loadPwfProtocols error:', error.message)
    return []
  }

  return data ?? []
}
