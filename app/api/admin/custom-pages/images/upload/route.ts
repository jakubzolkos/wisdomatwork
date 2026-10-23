import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAdminArea } from '@/lib/admin-access-server'

export const runtime = 'nodejs'

/**
 * POST /api/admin/custom-pages/images/upload
 * Upload an image for custom pages to Supabase Storage
 */
export async function POST(request: NextRequest) {
  try {
    const user = await assertAdminArea('content')
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validation
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 5MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB` },
        { status: 400 }
      )
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      )
    }

    // Generate unique filename using crypto.randomUUID
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${crypto.randomUUID()}.${ext}`
    const filePath = `custom-page-images/${filename}`

    console.log('[v0] Uploading image to Supabase Storage:', filePath)

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('custom-page-images')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[v0] Supabase Storage upload failed:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload image to storage' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('custom-page-images')
      .getPublicUrl(filePath)

    const imageUrl = publicUrlData.publicUrl

    console.log('[v0] Image uploaded to Supabase Storage:', imageUrl)

    // Log to database
    console.log('[v0] Logging image metadata to database...')

    const { data: imageRecord, error: dbError } = await supabase
      .from('page_images')
      .insert({
        url: imageUrl,
        filename: file.name,
        size_bytes: file.size,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[v0] Error logging image to database:', dbError)
      // If we can't log to DB, at least return the storage URL
      return NextResponse.json({
        id: `temp-${Date.now()}`,
        url: imageUrl,
        filename: file.name,
        width: null,
        height: null,
        size_bytes: file.size,
        warning: 'Image uploaded but database logging failed',
      })
    }

    console.log('[v0] Image record created:', imageRecord.id)

    return NextResponse.json({
      id: imageRecord.id,
      url: imageRecord.url,
      filename: imageRecord.filename,
      width: null,
      height: null,
      size_bytes: imageRecord.size_bytes,
    })
  } catch (error) {
    console.error('[v0] Image upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

