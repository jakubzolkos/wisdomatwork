'use client'

import { useState, useRef } from 'react'
import { Upload, Trash2, Copy, Edit2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { PageImage } from '@/lib/custom-pages/types'

interface ImageGalleryProps {
  images: PageImage[]
  onUpload: (file: File) => Promise<void>
  onDelete: (imageId: string) => Promise<void>
  onUpdateAlt: (imageId: string, altText: string) => Promise<void>
  isUploading?: boolean
}

export function ImageGallery({
  images,
  onUpload,
  onDelete,
  onUpdateAlt,
  isUploading = false,
}: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<PageImage | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingAlt, setEditingAlt] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    setError(null)
    setSuccess(null)

    if (!file) return

    try {
      console.log('[v0] Starting file upload:', file.name)
      await onUpload(file)
      setSuccess(`Image ${file.name} uploaded successfully!`)
      // Clear the input value using ref
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      console.error('[v0] Upload failed:', message)
      setError(message)
      // Clear the input value using ref on error too
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleEditAlt = async (imageId: string) => {
    try {
      await onUpdateAlt(imageId, editingAlt)
      setEditingId(null)
      setEditingAlt('')
      setSuccess('Alt text updated!')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alt text')
    }
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setSuccess('URL copied to clipboard!')
    setTimeout(() => setSuccess(null), 2000)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Image Library</CardTitle>
          <CardDescription>
            {images.length} image{images.length !== 1 ? 's' : ''} uploaded
          </CardDescription>
        </div>
        <label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />
          <Button
            asChild
            disabled={isUploading}
            className="gap-2"
          >
            <span>
              <Upload className="h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload Image'}
            </span>
          </Button>
        </label>
      </CardHeader>

      <CardContent className="space-y-4">
        {isUploading && (
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary-soft p-8 text-center">
            <Loader2 className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-sm font-medium text-foreground">Uploading image...</p>
            <p className="text-xs text-muted-foreground mt-1">Please wait while your image is being processed</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-success-soft border-success/30">
            <AlertDescription className="text-success">{success}</AlertDescription>
          </Alert>
        )}

        {!isUploading && images.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No images uploaded yet. Upload one to get started.
            </p>
            <label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              <Button variant="outline" asChild>
                <span className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload First Image
                </span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-lg border transition hover:border-border-strong hover:shadow-md"
              >
                {/* Image Preview */}
                <button
                  onClick={() => {
                    setSelectedImage(image)
                    setIsOpen(true)
                  }}
                  className="w-full aspect-square bg-muted overflow-hidden group"
                >
                  <img
                    src={image.url}
                    alt={image.alt_text || image.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                    loading="lazy"
                  />
                </button>

                {/* Image Info */}
                <div className="p-3 space-y-2">
                  <div className="truncate">
                    <p className="text-sm font-medium truncate">{image.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {image.width && image.height
                        ? `${image.width} × ${image.height}px`
                        : 'Dimensions unknown'}
                    </p>
                  </div>

                  {image.alt_text && (
                    <p className="text-xs text-muted-foreground italic line-clamp-1">
                      {image.alt_text}
                    </p>
                  )}

                  <Badge variant="secondary" className="text-xs">
                    {(image.size_bytes / 1024).toFixed(1)}KB
                  </Badge>

                  {/* Actions */}
                  <div className="flex gap-1 pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyUrl(image.url)}
                      title="Copy URL"
                      className="flex-1"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(image.id)
                        setEditingAlt(image.alt_text || '')
                        setIsOpen(true)
                      }}
                      title="Edit alt text"
                      className="flex-1"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(image.id)}
                      className="flex-1 text-destructive hover:bg-destructive/10"
                      title="Delete image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isOpen && editingId !== null} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={selectedImage.url}
                alt={selectedImage.filename}
                className="w-full rounded-lg"
              />
              <div>
                <label className="mb-2 block text-sm font-medium">Alt Text</label>
                <textarea
                  value={editingAlt}
                  onChange={(e) => setEditingAlt(e.target.value)}
                  placeholder="Describe the image..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <Button
                onClick={() => handleEditAlt(selectedImage.id)}
                className="w-full"
              >
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isOpen && editingId === null} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={selectedImage.url}
                alt={selectedImage.alt_text || selectedImage.filename}
                className="w-full rounded-lg"
              />
              <div className="space-y-2">
                <p className="text-sm font-medium">{selectedImage.filename}</p>
                {selectedImage.alt_text && (
                  <p className="text-sm text-muted-foreground">{selectedImage.alt_text}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
