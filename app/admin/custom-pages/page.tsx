import { PageHeader } from '@/components/page-header'
import { requireAdmin } from '@/lib/auth-server'
import { PagesList } from '@/components/custom-pages/pages-list'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getCustomPages, deleteCustomPage } from './actions'

export const metadata = {
  title: 'Custom Pages | Admin',
  description: 'Create and manage custom pages with images and content blocks',
}

export default async function CustomPagesPage() {
  await requireAdmin()

  // Fetch pages using server action
  const { pages, total, pageCount } = await getCustomPages(1, 20)
  const isTableMissing = total === 0 && !pages

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <PageHeader
        className="mb-0"
        eyebrow="Admin console"
        title="Custom Pages"
        description="Create custom pages with image support, text content, and block-based layouts. Publish pages to make them available to all users."
        actions={
          <Button asChild>
            <Link href="/admin/custom-pages/new">
              <Plus className="h-4 w-4" />
              New Page
            </Link>
          </Button>
        }
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pages</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold tabular-nums">{pages?.length || 0}</p>
          </CardContent>
        </Card>

        <Card className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold tabular-nums">
              {pages?.filter((p) => p.is_published).length || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-2xl font-semibold tabular-nums">
              {pages?.filter((p) => !p.is_published).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pages List */}
      <PagesList pages={pages || []} onDelete={deleteCustomPage} />
    </div>
  )
}
