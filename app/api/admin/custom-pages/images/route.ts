import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminRouteGuard } from '@/lib/admin-access-server'

export const runtime = 'nodejs'

/**
 * GET /api/admin/custom-pages/images
 * List all uploaded images or images for a specific page
 */
export async function GET(request: NextRequest) {
  try {
    const denied = await adminRouteGuard('content')
    if (denied) return denied
    const supabase = await createClient()

    // Check for pageId query parameter
    const pageId = request.nextUrl.searchParams.get('pageId')

    if (pageId) {
      // If pageId is provided, filter by pages that use these images
      // Get blocks for this page that have image_id
      const { data: blocks } = await supabase
        .from('page_blocks')
        .select('image_id')
        .eq('page_id', pageId)
        .not('image_id', 'is', null)

      const imageIds = blocks?.map((b: any) => b.image_id).filter(Boolean) || []

      // If no images used, return empty array
      if (imageIds.length === 0) {
        return NextResponse.json([])
      }

      // Get those specific images
      const { data: images, error } = await supabase
        .from('page_images')
        .select('*')
        .in('id', imageIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json(images || [])
    }

    // No pageId - return all images (for the image library/picker)
    const { data: images, error } = await supabase
      .from('page_images')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(images || [])
  } catch (error) {
    console.error('[v0] Error fetching images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}
