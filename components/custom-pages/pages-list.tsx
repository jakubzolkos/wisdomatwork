'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, Eye, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { CustomPage } from '@/lib/custom-pages/types'

interface PagesListProps {
  pages: CustomPage[]
  onDelete: (pageId: string) => Promise<{ success: boolean; error?: string }>
}

export function PagesList({ pages, onDelete }: PagesListProps) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const result = await onDelete(deleteId)
      if (result.success) {
        setDeleteId(null)
        router.refresh()
      } else {
        alert(result.error || 'Failed to delete page')
      }
    } catch (err) {
      alert('An error occurred while deleting the page')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card className="overflow-hidden pb-0">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Custom Pages</CardTitle>
            <CardDescription>
              {pages.length} page{pages.length !== 1 ? 's' : ''} created
            </CardDescription>
          </div>
          <Link href="/admin/custom-pages/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Page
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="px-0">
          {pages.length === 0 ? (
            <div className="mx-6 mb-6 rounded-xl border border-dashed p-10 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                No custom pages yet. Create one to get started.
              </p>
              <Link href="/admin/custom-pages/new">
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Page
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-accent/60"
                >
                  {/* Page Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/custom-pages/${page.id}`}
                      className="hover:underline"
                    >
                      <h3 className="truncate text-sm font-medium">{page.title}</h3>
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">/pages/{page.slug}</span>
                      <Badge
                        variant={page.is_published ? 'outline' : 'secondary'}
                        className={page.is_published ? 'border-success/30 bg-success-soft text-success' : undefined}
                      >
                        {page.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    {page.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {page.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {page.is_published && (
                      <Link href={`/pages/${page.slug}`} target="_blank">
                        <Button size="sm" variant="ghost" title="View public page">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}

                    <Link href={`/admin/custom-pages/${page.id}`}>
                      <Button size="sm" variant="ghost" title="Edit page">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteId(page.id)}
                      disabled={isDeleting}
                      className="text-destructive hover:bg-destructive/10"
                      title="Delete page"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this page? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
