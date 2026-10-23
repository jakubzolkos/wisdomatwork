import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminRouteGuard } from '@/lib/admin-access-server'

/**
 * Seed the About page with original content structure
 * POST /api/admin/seed-about-page
 * 
 * This endpoint creates the About custom page with the original layout
 * including: welcome header, images, lorem ipsum text, curriculum structure,
 * and Templeton Foundation attribution.
 */
export async function POST() {
  try {
    // Require admin authentication
    const denied = await adminRouteGuard('system')
    if (denied) return denied

    const supabase = await createClient()

    // Check if about page already exists
    const { data: existingPage } = await supabase
      .from('custom_pages')
      .select('id')
      .eq('slug', 'about')
      .single()

    if (existingPage) {
      return NextResponse.json(
        { message: 'About page already exists', pageId: existingPage.id },
        { status: 409 }
      )
    }

    // Create the About page
    const { data: page, error: pageError } = await supabase
      .from('custom_pages')
      .insert({
        title: 'About the WaW Fellows Portal',
        slug: 'about',
        description: 'Learn about the Wisdom at Work Fellowship Portal and the curriculum',
        header1: null,
        header2: null,
        header3: null,
        cover_image_url: null,
        is_published: true,
        show_in_menu: true,
      })
      .select()
      .single()

    if (pageError || !page) {
      return NextResponse.json(
        { error: 'Failed to create About page', details: pageError },
        { status: 500 }
      )
    }

    // Create the original About page blocks in the exact original structure
    const blocks = [
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 1,
        title: null,
        content: 'Welcome to the Wisdom at Work Fellows\' Portal',
        metadata: { heading: true, size: 'large' },
      },
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 2,
        title: null,
        content: 'Congratulations and welcome to the Wisdom at Work Fellowship!',
        metadata: { size: 'medium' },
      },
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 3,
        title: null,
        content: 'This site is your dashboard for the WAW Syllabus, Learning Journals, Additional Resources.',
        metadata: { size: 'small' },
      },
      {
        page_id: page.id,
        block_type: 'image',
        order_number: 4,
        title: null,
        content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-yk9hNgyQQIeZ2sMEpmaQzrCr1BlN8x.png',
        metadata: { alt: 'Wisdom at Work Fellows in collaborative discussion' },
      },
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 5,
        title: null,
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nSed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
        metadata: {},
      },
      {
        page_id: page.id,
        block_type: 'image',
        order_number: 6,
        title: null,
        content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Q4wysyC8JWLi02dGNyrSqptIHF6gYQ.png',
        metadata: { alt: 'Wisdom at Work Three-Year Curriculum Structure' },
      },
      {
        page_id: page.id,
        block_type: 'image',
        order_number: 7,
        title: null,
        content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-kCoiFTogFnqrrOloeNsvOSi9SOMEDN.png',
        metadata: { alt: 'John Templeton Foundation' },
      },
    ]

    const { error: blocksError } = await supabase
      .from('page_blocks')
      .insert(blocks)

    if (blocksError) {
      // Delete the page if blocks creation fails
      await supabase.from('custom_pages').delete().eq('id', page.id)
      return NextResponse.json(
        { error: 'Failed to create page blocks', details: blocksError },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: 'About page seeded successfully',
        pageId: page.id,
        blockCount: blocks.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[v0] Error seeding about page:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
