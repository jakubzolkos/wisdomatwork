'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth-server'
import { canAdmin } from '@/lib/admin-access'

interface AdminPageContentItem {
  id: string
  page_id: string
  slot_name: string
  order_index: number
  block_type: 'text' | 'image' | 'text_image'
  title: string | null
  content: string
  image_url: string | null
  image_alt: string | null
  created_at: string
}

/**
 * Fetch all editable content for a given admin page and slot
 */
export async function getAdminPageContent(pageId: string, slotName?: string) {
  const user = await getCurrentUser()
  
  if (!user || !canAdmin(user, 'content', 'read')) {
    return { ok: false, message: 'Unauthorized', data: [] }
  }

  const supabase = await createClient()

  let query = supabase
    .from('admin_page_content')
    .select('*')
    .eq('page_id', pageId)
    .order('order_index', { ascending: true })

  if (slotName) {
    query = query.eq('slot_name', slotName)
  }

  const { data, error } = await query

  if (error) {
    console.error('[v0] Failed to fetch admin page content:', error)
    return { ok: false, message: error.message, data: [] }
  }

  return { ok: true, data: data || [] }
}

/**
 * Create a new editable content item
 */
export async function createAdminPageContent(payload: {
  page_id: string
  slot_name: string
  block_type?: 'text' | 'image' | 'text_image'
  title?: string
  content: string
  image_url?: string
  image_alt?: string
}) {
  const user = await getCurrentUser()
  if (!user || !canAdmin(user, 'content', 'write')) {
    return { ok: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Get max order_index for this slot
  const { data: existing } = await supabase
    .from('admin_page_content')
    .select('order_index', { count: 'exact' })
    .eq('page_id', payload.page_id)
    .eq('slot_name', payload.slot_name)
    .order('order_index', { ascending: false })
    .limit(1)

  const order_index = existing && existing.length > 0 ? existing[0].order_index + 1 : 0

  const { error } = await supabase.from('admin_page_content').insert({
    page_id: payload.page_id,
    slot_name: payload.slot_name,
    block_type: payload.block_type || 'text',
    title: payload.title || null,
    content: payload.content,
    image_url: payload.image_url || null,
    image_alt: payload.image_alt || null,
    order_index,
    created_by: user.id,
  })

  if (error) {
    console.error('[v0] Failed to create admin page content:', error)
    return { ok: false, message: error.message }
  }

  revalidatePath(`/admin`)
  return { ok: true, message: 'Content created' }
}

/**
 * Update an existing content item
 */
export async function updateAdminPageContent(
  id: string,
  updates: {
    block_type?: 'text' | 'image' | 'text_image'
    title?: string
    content?: string
    image_url?: string
    image_alt?: string
  }
) {
  const user = await getCurrentUser()
  if (!user || !canAdmin(user, 'content', 'write')) {
    return { ok: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('admin_page_content')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[v0] Failed to update admin page content:', error)
    return { ok: false, message: error.message }
  }

  revalidatePath(`/admin`)
  return { ok: true, message: 'Content updated' }
}

/**
 * Delete a content item
 */
export async function deleteAdminPageContent(id: string) {
  const user = await getCurrentUser()
  if (!user || !canAdmin(user, 'content', 'write')) {
    return { ok: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('admin_page_content').delete().eq('id', id)

  if (error) {
    console.error('[v0] Failed to delete admin page content:', error)
    return { ok: false, message: error.message }
  }

  revalidatePath(`/admin`)
  return { ok: true, message: 'Content deleted' }
}

/**
 * Reorder content items within a slot
 */
export async function reorderAdminPageContent(
  pageId: string,
  slotName: string,
  orderedIds: string[]
) {
  const user = await getCurrentUser()
  if (!user || !canAdmin(user, 'content', 'write')) {
    return { ok: false, message: 'Unauthorized' }
  }

  const supabase = await createClient()

  try {
    // Update all items in batch
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('admin_page_content')
        .update({ order_index: i })
        .eq('id', orderedIds[i])

      if (error) throw error
    }

    revalidatePath(`/admin`)
    return { ok: true, message: 'Items reordered' }
  } catch (error) {
    console.error('[v0] Failed to reorder admin page content:', error)
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Reorder failed',
    }
  }
}
