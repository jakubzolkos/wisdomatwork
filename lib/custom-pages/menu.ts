import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { CustomPage } from '@/lib/custom-pages/types'

/**
 * Fetch published custom pages that should appear in the menu
 * Note: Cannot use unstable_cache here because createClient() accesses cookies()
 * which is dynamic data. Use revalidateTag() in API routes to refresh this data when pages change.
 */
export const getMenuCustomPages = cache(async (): Promise<CustomPage[]> => {
  try {
    const supabase = await createClient()
    const { data: pages, error } = await supabase
      .from('custom_pages')
      .select(`
        id,
        title,
        slug,
        description,
        header1,
        header2,
        header3,
        is_published,
        show_in_menu,
        created_by,
        created_at,
        updated_at
      `)
      .eq('is_published', true)
      .eq('show_in_menu', true)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[v0] Error fetching custom pages:', error)
      return []
    }
    
    return pages || []
  } catch (error) {
    console.error('[v0] Error fetching custom pages:', error)
    return []
  }
})
