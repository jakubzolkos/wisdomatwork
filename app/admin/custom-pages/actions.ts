'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateTag } from 'next/cache'
import { revalidatePath } from 'next/cache'
import type { CustomPage, PageBlock } from '@/lib/custom-pages/types'
import { assertAdminArea } from '@/lib/admin-access-server'

/**
 * Get all custom pages with pagination
 */
export async function getCustomPages(page: number = 1, pageSize: number = 20) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content', 'read')
  const admin = createAdminClient()

  try {
    const { data, error, count } = await admin
      .from('custom_pages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (error) throw error

    return {
      pages: data as CustomPage[],
      total: count || 0,
      pageCount: Math.ceil((count || 0) / pageSize),
    }
  } catch (err) {
    console.error('[v0] Failed to get custom pages:', err)
    return { pages: [], total: 0, pageCount: 0 }
  }
}

export async function getCustomPage(pageId: string) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content', 'read')
  const admin = createAdminClient()

  try {
    const { data: page, error: pageError } = await admin
      .from('custom_pages')
      .select('*')
      .eq('id', pageId)
      .single()

    if (pageError) throw pageError

    // Fetch blocks with fallback handling for missing columns
    let blocks: PageBlock[] = []
    try {
      const { data: blocksData, error: blocksError } = await admin
        .from('page_blocks')
        .select('*')
        .eq('page_id', pageId)

      if (blocksError) {
        console.warn('[v0] Failed to fetch page blocks:', blocksError)
        blocks = []
      } else {
        blocks = (blocksData || []) as PageBlock[]
        // Sort by order_number if it exists, otherwise by creation date
        blocks = blocks.sort((a: any, b: any) => {
          if (a.order_number !== undefined && b.order_number !== undefined) {
            return a.order_number - b.order_number
          }
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        })
      }
    } catch (err) {
      console.error('[v0] Error fetching page blocks:', err)
      blocks = []
    }

    return {
      page: page as CustomPage,
      blocks,
    }
  } catch (err) {
    console.error('[v0] Error fetching page:', err)
    return { page: null, blocks: [] }
  }
}

/**
 * Create a new custom page
 */
export async function createCustomPage(data: { title: string; slug: string; description?: string }) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content')
  const admin = createAdminClient()

  try {
    const { data: page, error } = await admin
      .from('custom_pages')
      .insert({
        title: data.title,
        slug: data.slug,
        description: data.description,
        is_published: false,
      })
      .select()
      .single()

    if (error) throw error

    // Create default template blocks for new page
    const defaultBlocks = [
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 1,
        title: data.title,
        content: data.title,
        metadata: { heading: true, size: 'large' },
      },
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 2,
        title: null,
        content: 'Add your introduction here. This is the perfect place to welcome visitors and explain the purpose of this page.',
        metadata: { size: 'medium' },
      },
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 3,
        title: null,
        content: 'Start creating your content by adding more text blocks, images, or combining them for a rich page layout.',
        metadata: { size: 'small' },
      },
    ]

    const { error: blocksError } = await admin
      .from('page_blocks')
      .insert(defaultBlocks)

    if (blocksError) {
      console.warn('[v0] Failed to create default blocks:', blocksError)
      // Don't fail the whole operation if blocks fail
    }

    revalidateTag('custom-pages', 'max')
    return { success: true, page: page as CustomPage }
  } catch (err) {
    console.error('[v0] Failed to create custom page:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create page' }
  }
}

/**
 * Update a custom page
 */
export async function updateCustomPage(
  pageId: string,
  data: {
    title?: string
    slug?: string
    description?: string
    is_published?: boolean
    show_in_menu?: boolean
  }
) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content')
  const admin = createAdminClient()

  try {
    const { data: page, error } = await admin
      .from('custom_pages')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .select()
      .single()

    if (error) throw error

    // Invalidate cache for both admin and public pages
    revalidateTag('custom-pages', 'max')
    // Revalidate the public page route if it was published/unpublished
    if (page?.slug) {
      revalidatePath(`/pages/${page.slug}`)
    }
    // Revalidate the pages list layout which shows in the menu
    revalidatePath('/', 'layout')

    return { success: true, page: page as CustomPage }
  } catch (err) {
    console.error('[v0] Failed to update custom page:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update page' }
  }
}

/**
 * Delete a custom page
 */
export async function deleteCustomPage(pageId: string) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content')
  const admin = createAdminClient()

  try {
    // Fetch the page first to get the slug for revalidation
    const { data: page } = await admin
      .from('custom_pages')
      .select('slug')
      .eq('id', pageId)
      .single()

    const { error } = await admin.from('custom_pages').delete().eq('id', pageId)

    if (error) throw error

    // Invalidate cache
    revalidateTag('custom-pages', 'max')
    // Revalidate the deleted page route
    if (page?.slug) {
      revalidatePath(`/pages/${page.slug}`)
    }
    // Revalidate the pages list layout which shows in the menu
    revalidatePath('/', 'layout')

    return { success: true }
  } catch (err) {
    console.error('[v0] Failed to delete custom page:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete page' }
  }
}

/**
 * Add a block to a page
 */
export async function addPageBlock(
  pageId: string,
  block: Omit<PageBlock, 'id' | 'created_at' | 'updated_at'>
) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content')
  const admin = createAdminClient()

  try {
    // Build insert object, excluding image_id if not provided
    const insertData: any = {
      page_id: pageId,
      block_type: block.block_type,
      order_number: block.order_number,
      title: block.title ?? null,
      content: block.content ?? null,
      metadata: block.metadata ?? null,
    }

    // Only include image_id if it's provided and not null
    if (block.image_id) {
      insertData.image_id = block.image_id
    }

    const { data, error } = await admin
      .from('page_blocks')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    revalidateTag('custom-pages', 'max')
    return { success: true, block: data as PageBlock }
  } catch (err) {
    console.error('[v0] Failed to add page block:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to add block' }
  }
}

/**
 * Update a page block
 */
export async function updatePageBlock(
  blockId: string,
  block: Partial<Omit<PageBlock, 'id' | 'created_at' | 'updated_at'>>
) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content')
  const admin = createAdminClient()

  try {
    // Build update object, only including fields that are provided
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (block.block_type !== undefined) updateData.block_type = block.block_type
    if (block.order_number !== undefined) updateData.order_number = block.order_number
    if (block.title !== undefined) updateData.title = block.title
    if (block.content !== undefined) updateData.content = block.content
    if (block.metadata !== undefined) updateData.metadata = block.metadata
    if (block.image_id !== undefined) updateData.image_id = block.image_id

    const { data, error } = await admin
      .from('page_blocks')
      .update(updateData)
      .eq('id', blockId)
      .select()
      .single()

    if (error) throw error

    revalidateTag('custom-pages', 'max')
    return { success: true, block: data as PageBlock }
  } catch (err) {
    console.error('[v0] Failed to update page block:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update block' }
  }
}

/**
 * Delete a page block
 */
export async function deletePageBlock(blockId: string) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content')
  const admin = createAdminClient()

  try {
    const { error } = await admin.from('page_blocks').delete().eq('id', blockId)

    if (error) throw error

    revalidateTag('custom-pages', 'max')
    return { success: true }
  } catch (err) {
    console.error('[v0] Failed to delete page block:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete block' }
  }
}

/**
 * Reorder page blocks
 */
export async function reorderPageBlocks(pageId: string, blockIds: string[]) {
  // Server actions are public endpoints: check the caller first.
  await assertAdminArea('content')
  const admin = createAdminClient()

  try {
    // Update each block with new order number
    const updates = blockIds.map((blockId, index) => ({
      id: blockId,
      order_number: index + 1,
      updated_at: new Date().toISOString(),
    }))

    const promises = updates.map((update) =>
      admin
        .from('page_blocks')
        .update({ order_number: update.order_number, updated_at: update.updated_at })
        .eq('id', update.id)
    )

    await Promise.all(promises)

    revalidateTag('custom-pages', 'max')
    return { success: true }
  } catch (err) {
    console.error('[v0] Failed to reorder page blocks:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to reorder blocks' }
  }
}
