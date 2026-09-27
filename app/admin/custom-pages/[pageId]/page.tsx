'use client'

import { PageHeader } from '@/components/page-header'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageEditor } from '@/components/custom-pages/page-editor'
import { ImageGallery } from '@/components/custom-pages/image-gallery'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { CustomPage, PageImage, PageBlock } from '@/lib/custom-pages/types'

interface PageEditorPageProps {
  params: Promise<{ pageId: string }>
}

export default function PageEditorPageClient({ params: paramPromise }: PageEditorPageProps) {
  const params = use(paramPromise)
  const router = useRouter()
  const isNewPage = params.pageId === 'new'

  const [page, setPage] = useState<CustomPage>({
    id: '',
    title: '',
    slug: '',
    description: '',
    header1: null,
    header1_position: 'before',
    header2: null,
    header2_position: 'before',
    header3: null,
    header3_position: 'before',
    is_published: false,
    show_in_menu: true,
    blocks: [],
    created_by: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const [images, setImages] = useState<PageImage[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(!isNewPage)
  const [error, setError] = useState<string | null>(null)

  // Fetch page data if editing
  useEffect(() => {
    if (params.pageId && params.pageId !== 'new') {
      fetchPage()
    }
  }, [params.pageId])

  const fetchPage = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/admin/custom-pages?pageId=${params.pageId}`)

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to load page')
      }

      const fetchedPage = await response.json()
      setPage({
        ...fetchedPage,
        blocks: fetchedPage.page_blocks || [],
      })

      // Fetch page images
      try {
        const imagesResponse = await fetch(`/api/admin/custom-pages/images?pageId=${params.pageId}`)
        if (imagesResponse.ok) {
          const fetchedImages = await imagesResponse.json()
          setImages(fetchedImages || [])
        }
      } catch (imageErr) {
        console.warn('[v0] Failed to fetch page images:', imageErr)
        // Don't fail the whole page load if images fail
      }
    } catch (err) {
      console.error('[v0] Error fetching page:', err)
      setError(err instanceof Error ? err.message : 'Failed to load page')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePage = async (updates: Partial<CustomPage>) => {
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        ...(isNewPage ? {} : { pageId: page.id }),
        title: updates.title || page.title,
        slug: updates.slug || page.slug,
        description: updates.description || page.description,
        header1: updates.header1 || page.header1,
        header2: updates.header2 || page.header2,
        header3: updates.header3 || page.header3,
        cover_image_url: updates.cover_image_url ?? page.cover_image_url,
        is_published: updates.is_published ?? page.is_published,
        show_in_menu: updates.show_in_menu ?? page.show_in_menu,
        blocks: updates.blocks || page.blocks,
      }

      const method = isNewPage ? 'POST' : 'PATCH'
      const response = await fetch('/api/admin/custom-pages', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save page')
      }

      const savedPage = await response.json()
      setPage({
        ...savedPage,
        blocks: savedPage.page_blocks || updates.blocks || page.blocks,
      })

      // Show success toast
      toast.success('Draft saved successfully')

      if (isNewPage) {
        // Redirect to edit the new page
        router.push(`/admin/custom-pages/${savedPage.id}`)
      } else {
        // Refresh to update UI and enable publish button
        router.refresh()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save page'
      console.error('[v0] Error saving page:', message)
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async (published: boolean) => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/custom-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          title: page.title || 'Untitled Page',
          slug: page.slug || 'untitled-page',
          description: page.description || '',
          header1: page.header1 || null,
          header2: page.header2 || null,
          header3: page.header3 || null,
          cover_image_url: page.cover_image_url || null,
          is_published: published,
          show_in_menu: page.show_in_menu ?? true,
          blocks: page.blocks || [],
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to update publish status')
      }

      const updated = await response.json()
      setPage({
        ...updated,
        blocks: updated.page_blocks || page.blocks,
      })
      
      // Show success toast
      toast.success(published ? 'Page published successfully' : 'Page unpublished successfully')
      
      // Refresh to trigger revalidation and update navigation
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update publish status'
      console.error('[v0] Error publishing:', message)
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUploadImage = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/custom-pages/images/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Upload failed')
      }

      const uploadedImage = await response.json()
      // Use functional setState to avoid stale closure
      setImages((prevImages) => [...prevImages, uploadedImage])
      toast.success('Image uploaded successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      console.error('[v0] Upload error:', message)
      toast.error(message)
      throw new Error(message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    try {
      const response = await fetch(`/api/admin/custom-pages/images/${imageId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Delete failed')
      }

      setImages(images.filter((img) => img.id !== imageId))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      console.error('[v0] Delete error:', message)
      throw new Error(message)
    }
  }

  const handleUpdateImageAlt = async (imageId: string, altText: string) => {
    try {
      const response = await fetch(`/api/admin/custom-pages/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt_text: altText }),
      })

      if (!response.ok) {
        throw new Error('Failed to update image')
      }

      const updated = await response.json()
      setImages(images.map((img) => (img.id === imageId ? updated : img)))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed'
      console.error('[v0] Update error:', message)
      throw new Error(message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading page...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-2"
        eyebrow="Custom pages"
        title={isNewPage ? 'Create Page' : 'Edit Page'}
        description="Build your page with text, images, and custom content blocks"
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-10">
        {/* Page Content Editor */}
        <section>
          <h2 className="mb-4">Page Content</h2>
          <PageEditor
            page={page}
            availableImages={images}
            onSave={handleSavePage}
            onPublish={handlePublish}
            isSaving={isSaving}
            isUploading={isUploading}
            isPublished={page.is_published}
          />
        </section>

        {/* Image Gallery */}
        <section>
          <h2 className="mb-4">Image Library</h2>
          <ImageGallery
            images={images}
            onUpload={handleUploadImage}
            onDelete={handleDeleteImage}
            onUpdateAlt={handleUpdateImageAlt}
            isUploading={isUploading}
          />
        </section>
      </div>
    </div>
  )
}
