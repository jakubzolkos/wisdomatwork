'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageRenderer } from './page-renderer'
import { CustomPage } from '@/lib/custom-pages/types'

interface InlinePageEditorProps {
  page: CustomPage
}

export function InlinePageEditor({ page }: InlinePageEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedPage, setEditedPage] = useState(page)
  const [isSaving, setIsSaving] = useState(false)

  const handleEditToggle = () => {
    if (isEditing) {
      // Reset changes if canceling
      setEditedPage(page)
    }
    setIsEditing(!isEditing)
  }

  const handleFieldChange = (field: string, value: string) => {
    setEditedPage((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/custom-pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          title: editedPage.title,
          slug: editedPage.slug,
          description: editedPage.description,
          header1: editedPage.header1,
          header2: editedPage.header2,
          header3: editedPage.header3,
          blocks: editedPage.blocks,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save changes')
      }

      // Revalidate the page
      await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: page.slug }),
      })

      setIsEditing(false)
      // Show success message
      alert('Page updated successfully!')
    } catch (error) {
      console.error('[v0] Error saving page:', error)
      alert('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isEditing) {
    return (
      <div className="relative">
        <div className="fixed top-4 right-4 z-50">
          <Button
            onClick={handleEditToggle}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>
        <PageRenderer page={page} showCTA={true} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          onClick={handleEditToggle}
          variant="outline"
          size="sm"
          disabled={isSaving}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
        {/* Editable Fields */}
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Edit Page</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={editedPage.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editedPage.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold mb-3">Headers</h3>

              <div>
                <label className="block text-sm font-medium mb-1">Header 1 (Largest)</label>
                <input
                  type="text"
                  value={editedPage.header1 || ''}
                  onChange={(e) => handleFieldChange('header1', e.target.value)}
                  placeholder="Main header"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Header 2 (Medium)</label>
                <input
                  type="text"
                  value={editedPage.header2 || ''}
                  onChange={(e) => handleFieldChange('header2', e.target.value)}
                  placeholder="Secondary header"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Header 3 (Small)</label>
                <input
                  type="text"
                  value={editedPage.header3 || ''}
                  onChange={(e) => handleFieldChange('header3', e.target.value)}
                  placeholder="Tertiary header"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Preview</h2>
          <PageRenderer page={editedPage} showCTA={true} />
        </div>
      </div>
    </div>
  )
}
