import { createClient } from '@/lib/supabase/server'

/**
 * The signed-in fellow's research participant ID (the "Unique ID" they
 * paste into survey forms), or null when none is on file. RLS limits
 * the row to its owner and staff (scripts/062_profile_research_ids.sql).
 */
export async function getResearchId(profileId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profile_research_ids')
    .select('research_id')
    .eq('profile_id', profileId)
    .maybeSingle<{ research_id: string }>()
  return data?.research_id ?? null
}
