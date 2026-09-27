import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { requireAdmin } from '@/lib/auth-server'
import { getAdminPageContent } from '@/app/admin/actions'
import { AdminAboutClient } from '@/components/admin/admin-about-client'

export default async function AdminAboutPage() {
  await requireAdmin()
  
  const bodyContent = await getAdminPageContent('about', 'body')

  return (
    <div className="flex flex-col gap-6">
      {/* Header with back button */}
      <div className="flex flex-col gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href="/admin" aria-label="Back to admin">
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Link>
          </Button>
        </div>
        <PageHeader
          className="mb-2"
          eyebrow="Admin console"
          title="About Page"
          description="Manage editable content blocks on the public about page"
        />
      </div>

      {/* Main content section with flexible editor */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <h2 className="mb-1">Page Content</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Add, edit, and reorder content blocks (text, images, or both) that appear in the main body of the about page. Drag blocks to rearrange them.
        </p>
        <AdminAboutClient
          pageId="about"
          slotName="body"
          initialItems={bodyContent.ok ? bodyContent.data : []}
        />
      </section>
    </div>
  )
}
