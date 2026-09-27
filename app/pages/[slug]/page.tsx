import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-server'
import { PageRenderer } from '@/components/custom-pages/page-renderer'
import { InlinePageEditor } from '@/components/custom-pages/inline-page-editor'
import { getSessionUser } from '@/lib/auth-server'
import { CustomPageTemplate } from '@/components/custom-pages/page-template'

// Skip prerendering since this page requires authentication
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Revalidate every 10 seconds to ensure changes appear immediately
export const revalidate = 10

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: page } = await supabase
    .from('custom_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!page) {
    return { title: 'Page Not Found' }
  }

  return {
    title: `${page.title} | WaW`,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      type: 'website',
    },
  }
}

export default async function PublicPage({ params }: PageProps) {
  await requireUser()
  
  const { slug } = await params
  const supabase = await createClient()

  // Fetch published page with blocks
  const { data: page, error: pageError } = await supabase
    .from('custom_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (pageError || !page) {
    notFound()
  }

  // Fetch page blocks separately
  const { data: blocks = [] } = await supabase
    .from('page_blocks')
    .select('*')
    .eq('page_id', page.id)
    .order('order_number', { ascending: true })

  // Check if user is admin for inline editing
  let userIsAdmin = false
  try {
    const user = await getSessionUser()
    if (user) {
      // Check if user has admin role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      userIsAdmin = profile?.role === 'admin'
    }
  } catch {
    // User not authenticated or profile check failed
  }

  const pageWithBlocks = { ...page, blocks }

  return (
    <CustomPageTemplate>
      {userIsAdmin ? (
        <InlinePageEditor page={pageWithBlocks} />
      ) : (
        <PageRenderer page={pageWithBlocks} />
      )}
    </CustomPageTemplate>
  )
}
