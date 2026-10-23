import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { adminRouteGuard } from '@/lib/admin-access-server'

export async function POST(request: NextRequest) {
  try {
    const denied = await adminRouteGuard('content')
    if (denied) return denied
    
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Upload to public Blob storage
    const blob = await put(file.name, file, {
      access: 'public',
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('[v0] Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
