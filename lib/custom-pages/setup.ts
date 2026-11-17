'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Initialize custom pages database tables and seed the About page
 * Call this once to set up the database
 */
export async function setupCustomPagesDatabase() {
  const supabase = await createClient()

  try {
    console.log('[v0] Setting up custom pages database...')

    // First, ensure the custom-page-images storage bucket exists
    console.log('[v0] Checking for custom-page-images bucket...')
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('[v0] Error listing buckets:', listError)
      return {
        success: false,
        message: 'Failed to list storage buckets',
        error: listError.message,
      }
    }

    const bucketExists = buckets?.some((b: any) => b.name === 'custom-page-images')

    if (!bucketExists) {
      console.log('[v0] Creating custom-page-images bucket...')
      const { error: createError } = await supabase.storage.createBucket('custom-page-images', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      })

      if (createError && !createError.message.includes('already exists')) {
        console.error('[v0] Error creating bucket:', createError)
        return {
          success: false,
          message: 'Failed to create storage bucket',
          error: createError.message,
        }
      }
      console.log('[v0] custom-page-images bucket is ready')
    } else {
      console.log('[v0] custom-page-images bucket already exists')
    }

    // Check if custom_pages table exists by trying to query it
    const { data: existingPages, error: queryError } = await supabase
      .from('custom_pages')
      .select('id')
      .limit(1)

    if (queryError && queryError.code === 'PGRST116') {
      console.log('[v0] Tables do not exist yet, creating...')
      // Tables don't exist, need to create them manually via SQL
      return {
        success: false,
        message: 'Tables need to be created. Please run the migrations in your Supabase SQL editor.',
        error: queryError.message,
      }
    }

    // Tables exist, check if About page already exists
    const { data: aboutPage, error: aboutError } = await supabase
      .from('custom_pages')
      .select('id')
      .eq('slug', 'about')
      .single()

    if (aboutPage) {
      console.log('[v0] About page already exists')
      return { success: true, message: 'About page already exists' }
    }

    if (aboutError && aboutError.code !== 'PGRST116') {
      // Some other error occurred
      console.log('[v0] Error checking for About page:', aboutError)
    }

    // Create the About page
    console.log('[v0] Creating About page...')
    const { data: page, error: insertError } = await supabase
      .from('custom_pages')
      .insert({
        title: 'About the WaW Fellows Portal',
        slug: 'about',
        description: 'Learn about the WaW Fellows Portal and the curriculum',
        is_published: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[v0] Error creating About page:', insertError)
      return { success: false, message: 'Failed to create About page', error: insertError.message }
    }

    // Create content blocks
    const blocks = [
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 1,
        content: 'Welcome to the WaW Fellows\' Portal',
        metadata: { heading: true, size: 'large' },
      },
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 2,
        content: 'Congratulations and welcome to the WaW Fellowship!',
        metadata: { size: 'medium' },
      },
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 3,
        content: 'This site is your dashboard for the WAW Syllabus, Toolkit, Calendar, and Additional Resources.',
        metadata: { size: 'small' },
      },
      {
        page_id: page.id,
        block_type: 'image',
        order_number: 4,
        content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-yk9hNgyQQIeZ2sMEpmaQzrCr1BlN8x.png',
        metadata: { alt: 'WaW Fellows in collaborative discussion' },
      },
      {
        page_id: page.id,
        block_type: 'text',
        order_number: 5,
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nSed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
        metadata: {},
      },
      {
        page_id: page.id,
        block_type: 'image',
        order_number: 6,
        content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Q4wysyC8JWLi02dGNyrSqptIHF6gYQ.png',
        metadata: { alt: 'WaW Three-Year Curriculum Structure' },
      },
      {
        page_id: page.id,
        block_type: 'image',
        order_number: 7,
        content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-kCoiFTogFnqrrOloeNsvOSi9SOMEDN.png',
        metadata: { alt: 'John Templeton Foundation' },
      },
    ]

    const { error: blocksError } = await supabase
      .from('page_blocks')
      .insert(blocks)

    if (blocksError) {
      console.error('[v0] Error creating blocks:', blocksError)
      return { success: false, message: 'Failed to create page blocks', error: blocksError.message }
    }

    console.log('[v0] About page setup complete!')
    return { success: true, message: 'About page created successfully' }
  } catch (err) {
    console.error('[v0] Setup error:', err)
    return {
      success: false,
      message: 'Setup failed',
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
