import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminRouteGuard } from '@/lib/admin-access-server'

export const runtime = 'nodejs'

/**
 * DELETE /api/admin/custom-pages/images/[id]
 * Delete an image from both database and Supabase Storage
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await adminRouteGuard('content')
    if (denied) return denied
    const supabase = await createClient()
    const { id: imageId } = await params

    // Get image details
    const { data: image, error: fetchError } = await supabase
      .from('page_images')
      .select('*')
      .eq('id', imageId)
      .single()

    if (fetchError || !image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Check if image is in use
    const { data: usageCount } = await supabase
      .from('page_blocks')
      .select('id', { count: 'exact', head: true })
      .eq('image_id', imageId)

    if (usageCount && usageCount.length > 0) {
      return NextResponse.json(
        { error: 'Image is in use. Remove it from all pages before deleting.' },
        { status: 400 }
      )
    }

    // Delete from Supabase Storage
    try {
      // Extract filename from URL (everything after /object/public/custom-page-images/)
      const url = new URL(image.url)
      const pathname = url.pathname
      const pathParts = pathname.split('/object/public/custom-page-images/')
      if (pathParts.length === 2) {
        const filename = pathParts[1]
        const { error: storageError } = await supabase.storage
          .from('custom-page-images')
          .remove([filename])
        
        if (storageError) {
          console.warn('[v0] Error deleting from Supabase Storage:', storageError)
        }
      }
    } catch (err) {
      console.warn('[v0] Error processing storage deletion:', err)
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('page_images')
      .delete()
      .eq('id', imageId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error deleting image:', error)
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/custom-pages/images/[id]
 * Update image metadata (alt_text)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await adminRouteGuard('content')
    if (denied) return denied
    const supabase = await createClient()
    const { id: imageId } = await params
    const body = await request.json()
    const { alt_text } = body

    const { data: image, error: updateError } = await supabase
      .from('page_images')
      .update({ alt_text })
      .eq('id', imageId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(image)
  } catch (error) {
    console.error('[v0] Error updating image:', error)
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    )
  }
}
