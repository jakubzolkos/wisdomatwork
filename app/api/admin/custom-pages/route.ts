import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertAdminArea } from '@/lib/admin-access-server'

export const runtime = 'nodejs'

/**
 * POST /api/admin/custom-pages
 * Create a new custom page
 */
export async function POST(request: NextRequest) {
  try {
    const user = await assertAdminArea('content')
    const supabase = await createClient()
    const body = await request.json()

    const { title, slug, description, header1, header2, header3, cover_image_url, blocks } = body

    if (!title || !slug) {
      return NextResponse.json(
        { error: 'Title and slug are required' },
        { status: 400 }
      )
    }

    // Create the page
    const { data: page, error: pageError } = await supabase
      .from('custom_pages')
      .insert({
        title,
        slug,
        description: description || null,
        header1: header1 || null,
        header2: header2 || null,
        header3: header3 || null,
        cover_image_url: cover_image_url || null,
        is_published: false,
        created_by: user.id,
      })
      .select()
      .single()

    if (pageError) {
      console.error('[v0] Error creating page:', pageError)
      return NextResponse.json(
        { error: pageError.message || 'Failed to create page' },
        { status: 500 }
      )
    }

    // Add blocks if provided
    if (blocks && blocks.length > 0) {
      const { error: blocksError } = await supabase
        .from('page_blocks')
        .insert(
          blocks.map((block: any, index: number) => ({
            page_id: page.id,
            block_type: block.block_type,
            title: block.title || null,
            content: block.content || null,
            metadata: block.metadata || null,
            image_id: block.image_id || null,
            order_number: index,
          }))
        )

      if (blocksError) {
        console.error('[v0] Error creating blocks:', blocksError)
      }
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('[v0] Page creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create page' },
      { status: 500 }
    )
  } finally {
    // Revalidate when a new page is created
    try {
      revalidateTag('custom-pages', 'hours')
      revalidateTag('navigation', 'hours')
      revalidatePath('/', 'layout')
    } catch (e) {
      console.warn('[v0] Revalidation failed:', e)
    }
  }
}

/**
 * PATCH /api/admin/custom-pages
 * Update an existing custom page
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await assertAdminArea('content')
    const supabase = await createClient()
    const body = await request.json()

    const { pageId, title, slug, description, header1, header2, header3, cover_image_url, is_published, show_in_menu, blocks } = body

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    // Update the page
    const { data: page, error: pageError } = await supabase
      .from('custom_pages')
      .update({
        title,
        slug,
        description: description || null,
        header1: header1 || null,
        header2: header2 || null,
        header3: header3 || null,
        cover_image_url: cover_image_url || null,
        is_published,
        show_in_menu: show_in_menu ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .select()
      .single()

    if (pageError) {
      console.error('[v0] Error updating page:', pageError)
      return NextResponse.json(
        { error: pageError.message || 'Failed to update page' },
        { status: 500 }
      )
    }

    // Update blocks if provided
    if (blocks && blocks.length > 0) {
      // Delete existing blocks
      await supabase.from('page_blocks').delete().eq('page_id', pageId)

      // Fetch all images to map image_id to url for content field
      const { data: allImages } = await supabase
        .from('page_images')
        .select('id, url, alt_text')

      const imageMap = new Map((allImages || []).map((img: any) => [img.id, img]))

      // Insert new blocks with image URLs in content field
      const { error: blocksError } = await supabase
        .from('page_blocks')
        .insert(
          blocks.map((block: any, index: number) => {
            let content = block.content || null

            // If this is an image block with image_id, populate content with the image URL
            if (block.block_type === 'image' && block.image_id) {
              const image = imageMap.get(block.image_id)
              if (image) {
                content = image.url
              }
            }

            return {
              page_id: page.id,
              block_type: block.block_type,
              title: block.title || null,
              content,
              metadata: block.metadata || null,
              image_id: block.image_id || null,
              order_number: index,
            }
          })
        )

      if (blocksError) {
        console.error('[v0] Error updating blocks:', blocksError)
      }
    }

    // Fetch the updated page with blocks to return consistent response
    const { data: pageWithBlocks } = await supabase
      .from('custom_pages')
      .select(
        `
        *,
        page_blocks (
          id,
          page_id,
          block_type,
          order_number,
          title,
          content,
          metadata,
          image_id
        )
      `
      )
      .eq('id', pageId)
      .single()

    return NextResponse.json(pageWithBlocks || page)
  } catch (error) {
    console.error('[v0] Page update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update page' },
      { status: 500 }
    )
  } finally {
    // Revalidate navigation and page caches whenever a page is updated
    try {
      revalidateTag('custom-pages', 'hours')
      revalidateTag('navigation', 'hours')
      revalidatePath('/', 'layout')
    } catch (e) {
      console.warn('[v0] Revalidation failed:', e)
    }
  }
}

/**
 * GET /api/admin/custom-pages?pageId=xxx
 * Fetch a specific page with its blocks
 */
export async function GET(request: NextRequest) {
  try {
    const user = await assertAdminArea('content')
    const supabase = await createClient()
    const pageId = request.nextUrl.searchParams.get('pageId')

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    const { data: page, error: pageError } = await supabase
      .from('custom_pages')
      .select(
        `
        *,
        page_blocks (
          id,
          page_id,
          block_type,
          order_number,
          title,
          content,
          metadata,
          image_id
        )
      `
      )
      .eq('id', pageId)
      .single()

    if (pageError) {
      console.error('[v0] Error fetching page:', pageError)
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('[v0] Page fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch page' },
      { status: 500 }
    )
  }
}
